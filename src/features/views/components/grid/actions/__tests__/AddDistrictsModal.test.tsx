import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import { AddDistrictsModal } from "../AddDistrictsModal";

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return function Wrapper({ children }: { children: ReactNode }) {
    return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
  };
}

const searchResults = {
  items: [
    { leaid: "0601234", name: "Fresno Unified", stateAbbrev: "CA" },
    { leaid: "4802030", name: "Frisco ISD", stateAbbrev: "TX" },
  ],
};

beforeEach(() => {
  vi.useFakeTimers();
  vi.stubGlobal("fetch", vi.fn());
});
afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllGlobals();
});

describe("AddDistrictsModal", () => {
  it("does not render when closed", () => {
    render(
      <AddDistrictsModal planId="plan-1" open={false} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    expect(screen.queryByText("Add districts to plan")).not.toBeInTheDocument();
  });

  it("renders search input and title when open", () => {
    render(
      <AddDistrictsModal planId="plan-1" open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText("Add districts to plan")).toBeInTheDocument();
    expect(
      screen.getByPlaceholderText(/search by name or state/i),
    ).toBeInTheDocument();
  });

  it("shows a hint message when fewer than 2 characters are typed", () => {
    render(
      <AddDistrictsModal planId="plan-1" open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    expect(screen.getByText(/type at least 2 characters/i)).toBeInTheDocument();
    fireEvent.change(screen.getByPlaceholderText(/search by name or state/i), {
      target: { value: "f" },
    });
    expect(screen.getByText(/type at least 2 characters/i)).toBeInTheDocument();
  });

  it("fetches and displays results after debounce fires", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify(searchResults), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(
      <AddDistrictsModal planId="plan-1" open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText(/search by name or state/i), {
      target: { value: "fres" },
    });
    // Advance past the 300 ms debounce, then switch to real timers so waitFor
    // can poll using real setInterval (fake timers swallow waitFor's intervals).
    await act(async () => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();
    await waitFor(() =>
      expect(screen.getByText("Fresno Unified")).toBeInTheDocument(),
    );
    expect(screen.getByText("Frisco ISD")).toBeInTheDocument();
  });

  it("shows No matches when the API returns an empty items array", async () => {
    (fetch as ReturnType<typeof vi.fn>).mockResolvedValue(
      new Response(JSON.stringify({ items: [] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    render(
      <AddDistrictsModal planId="plan-1" open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText(/search by name or state/i), {
      target: { value: "zzzzz" },
    });
    await act(async () => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();
    await waitFor(() =>
      expect(screen.getByText(/no matches/i)).toBeInTheDocument(),
    );
  });

  it("disables the Add button and shows ✓ Added after a successful POST", async () => {
    (fetch as ReturnType<typeof vi.fn>)
      .mockResolvedValueOnce(
        new Response(JSON.stringify(searchResults), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ added: 1 }), {
          status: 200,
          headers: { "Content-Type": "application/json" },
        }),
      );
    render(
      <AddDistrictsModal planId="plan-1" open={true} onClose={vi.fn()} />,
      { wrapper: makeWrapper() },
    );
    fireEvent.change(screen.getByPlaceholderText(/search by name or state/i), {
      target: { value: "fres" },
    });
    await act(async () => { vi.advanceTimersByTime(300); });
    vi.useRealTimers();
    await waitFor(() =>
      expect(screen.getByText("Fresno Unified")).toBeInTheDocument(),
    );
    // Click the first "+ Add" button.
    const addBtns = screen.getAllByRole("button", { name: /\+ add/i });
    fireEvent.click(addBtns[0]);
    await waitFor(() =>
      expect(
        screen.getByRole("button", { name: /✓ added/i }),
      ).toBeDisabled(),
    );
  });

  it("calls onClose when the × button is clicked", () => {
    const onClose = vi.fn();
    render(
      <AddDistrictsModal planId="plan-1" open={true} onClose={onClose} />,
      { wrapper: makeWrapper() },
    );
    fireEvent.click(screen.getByRole("button", { name: /close/i }));
    expect(onClose).toHaveBeenCalledTimes(1);
  });
});
