import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useMapV2Store } from "@/features/map/lib/store";
import { PlanMapSelectionBar } from "../PlanMapSelectionBar";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

const JSON_HEADERS = { "Content-Type": "application/json" };

beforeEach(() => {
  useMapV2Store.setState({
    viewsPlanId: "plan-1",
    viewsPlanHighlightLeaids: new Set<string>(),
    viewsPlanSelectedLeaids: new Set<string>(),
  });
});

describe("PlanMapSelectionBar", () => {
  it("renders nothing when no districts are selected", () => {
    const { container } = render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the pending-add count", () => {
    useMapV2Store.setState({ viewsPlanSelectedLeaids: new Set(["0601234", "0699999"]) });
    render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    expect(screen.getByText("2 districts selected")).toBeInTheDocument();
  });

  it("posts the selected leaids, then clears selection and highlights them", async () => {
    const fetchMock = vi.fn((url: string, init: RequestInit) =>
      Promise.resolve(
        new Response(JSON.stringify({ added: 2, planId: "plan-1" }), {
          status: 200,
          headers: JSON_HEADERS,
        }),
      ),
    );
    vi.stubGlobal("fetch", fetchMock);
    useMapV2Store.setState({ viewsPlanSelectedLeaids: new Set(["0601234", "0699999"]) });

    render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /add to plan/i }));

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/territory-plans/plan-1/districts");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body)).leaids.sort()).toEqual(["0601234", "0699999"]);

    await waitFor(() => {
      const s = useMapV2Store.getState();
      expect(s.viewsPlanSelectedLeaids.size).toBe(0);
      expect(s.viewsPlanHighlightLeaids.has("0601234")).toBe(true);
    });
    vi.unstubAllGlobals();
  });

  it("clears the selection without posting when Clear is pressed", () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);
    useMapV2Store.setState({ viewsPlanSelectedLeaids: new Set(["0601234"]) });

    render(<PlanMapSelectionBar planId="plan-1" />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /clear/i }));

    expect(fetchMock).not.toHaveBeenCalled();
    expect(useMapV2Store.getState().viewsPlanSelectedLeaids.size).toBe(0);
    vi.unstubAllGlobals();
  });
});
