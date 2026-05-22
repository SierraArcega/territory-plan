import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useRef } from "react";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { SetTargetsPopover } from "../SetTargetsPopover";

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>;
}

// Renders a real anchor + the popover (open) so AnchoredPopover has an anchorRef.
function Harness({ onClose = () => {} }: { onClose?: () => void }) {
  const ref = useRef<HTMLButtonElement>(null);
  return (
    <>
      <button ref={ref}>anchor</button>
      <SetTargetsPopover planId="plan-1" leaid="0601234" districtName="Tedesco USD"
        anchorRef={ref} open onClose={onClose} />
    </>
  );
}

const detail = {
  renewalTarget: 24000, expansionTarget: 12000,
  winbackTarget: null, newBusinessTarget: 12000,
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn((_url: string, _init?: RequestInit) =>
    Promise.resolve(new Response(JSON.stringify(detail), {
      status: 200, headers: { "Content-Type": "application/json" } }))));
});
afterEach(() => vi.unstubAllGlobals());

describe("SetTargetsPopover", () => {
  it("prefills the four targets from the GET", async () => {
    render(<Harness />, { wrapper });
    expect(await screen.findByDisplayValue("24000")).toBeInTheDocument();
    expect(screen.getByLabelText(/winback/i)).toHaveValue(""); // null → blank
  });

  it("saves all four fields via PUT (blank → null)", async () => {
    const onClose = vi.fn();
    render(<Harness onClose={onClose} />, { wrapper });
    await screen.findByDisplayValue("24000");
    fireEvent.change(screen.getByLabelText(/winback/i), { target: { value: "5,000" } });
    fireEvent.click(screen.getByRole("button", { name: /save targets/i }));

    await waitFor(() => {
      const putCall = (globalThis.fetch as any).mock.calls.find(
        (c: any[]) => c[1]?.method === "PUT");
      expect(putCall).toBeTruthy();
      const body = JSON.parse(String(putCall[1].body));
      expect(body).toMatchObject({
        renewalTarget: 24000, expansionTarget: 12000,
        winbackTarget: 5000, newBusinessTarget: 12000,
      });
    });
    await waitFor(() => expect(onClose).toHaveBeenCalled());
  });
});
