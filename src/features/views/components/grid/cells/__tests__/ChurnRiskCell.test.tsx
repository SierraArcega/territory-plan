import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { ChurnRiskCell } from "../ChurnRiskCell";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("ChurnRiskCell", () => {
  it("shows '—' when value is null and disabled is false", () => {
    render(
      <ChurnRiskCell value={null} planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("renders the pill label when value is set", () => {
    render(
      <ChurnRiskCell value="medium" planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText("Medium")).toBeInTheDocument();
  });

  it("renders read-only span when disabled", () => {
    render(
      <ChurnRiskCell value="high" planId="p1" leaid="123" disabled={true} />,
      { wrapper },
    );
    // No select element when disabled — just a styled span.
    expect(screen.queryByRole("combobox")).toBeNull();
    expect(screen.getByText("High")).toBeInTheDocument();
  });

  it("fires the mutation when the select value changes", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ churnRisk: "high", notes: null });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      fetchMock(url, init);
      return Promise.resolve(
        new Response(JSON.stringify({ churnRisk: "high", notes: null }), { status: 200 }),
      );
    });

    render(
      <ChurnRiskCell value={null} planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );

    // Open the editor.
    fireEvent.click(screen.getByText("—"));
    const select = await screen.findByRole("combobox");
    fireEvent.change(select, { target: { value: "high" } });

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ churnRisk: "high" });

    vi.unstubAllGlobals();
  });
});
