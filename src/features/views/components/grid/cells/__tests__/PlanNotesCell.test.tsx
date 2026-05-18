import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { PlanNotesCell } from "../PlanNotesCell";

const wrapper = ({ children }: { children: React.ReactNode }) => {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
};

describe("PlanNotesCell", () => {
  it("shows '—' when value is null", () => {
    render(<PlanNotesCell value={null} planId="p1" leaid="123" disabled={false} />, { wrapper });
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows the value as truncated text when not editing", () => {
    render(
      <PlanNotesCell value="hello world" planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );
    expect(screen.getByText("hello world")).toBeInTheDocument();
  });

  it("enters edit mode on click and saves on blur with mutation call", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ churnRisk: null, notes: "new note" });
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      fetchMock(url, init);
      return Promise.resolve(
        new Response(JSON.stringify({ churnRisk: null, notes: "new note" }), { status: 200 }),
      );
    });

    render(<PlanNotesCell value={null} planId="p1" leaid="123" disabled={false} />, { wrapper });

    fireEvent.click(screen.getByText("—"));
    const editor = await screen.findByRole("textbox");
    fireEvent.change(editor, { target: { value: "new note" } });
    fireEvent.blur(editor);

    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const [, init] = fetchMock.mock.calls[0];
    expect(init.method).toBe("PUT");
    expect(JSON.parse(String(init.body))).toEqual({ notes: "new note" });

    vi.unstubAllGlobals();
  });

  it("reverts on Esc and does NOT call mutation", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", (url: string, init: RequestInit) => {
      fetchMock(url, init);
      return Promise.resolve(new Response("{}", { status: 200 }));
    });

    render(
      <PlanNotesCell value="original" planId="p1" leaid="123" disabled={false} />,
      { wrapper },
    );

    fireEvent.click(screen.getByText("original"));
    const editor = await screen.findByRole("textbox");
    fireEvent.change(editor, { target: { value: "edited" } });
    fireEvent.keyDown(editor, { key: "Escape" });

    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText("original")).toBeInTheDocument();

    vi.unstubAllGlobals();
  });
});
