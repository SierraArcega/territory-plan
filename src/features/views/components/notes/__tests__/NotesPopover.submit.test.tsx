import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock the composer to emit a draft (with a chosen noteType) on click — this
// isolates the popover's submit→mutation forwarding from TipTap, and guards the
// regression where draft.noteType was dropped before create.mutate.
vi.mock("../NoteComposer", () => ({
  NoteComposer: ({ onSubmit }: { onSubmit: (d: { bodyJson: unknown; bodyText: string; noteType: string }) => void }) => (
    <button onClick={() => onSubmit({ bodyJson: { type: "doc" }, bodyText: "called", noteType: "risk_flag" })}>
      mock-add
    </button>
  ),
}));
vi.mock("@/lib/api", () => ({ useProfile: () => ({ data: { id: "me" } }) }));

import { NotesPopover } from "../NotesPopover";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false }, mutations: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.restoreAllMocks());

describe("NotesPopover submit", () => {
  it("forwards the composer's chosen noteType into the create POST", async () => {
    const fetchMock = vi
      .fn()
      // initial GET list (useDistrictNotes on mount)
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ notes: [] }), { status: 200, headers: { "Content-Type": "application/json" } }),
      )
      // POST create
      .mockResolvedValue(
        new Response(JSON.stringify({ id: "n1", noteType: "risk_flag" }), { status: 200, headers: { "Content-Type": "application/json" } }),
      );
    vi.stubGlobal("fetch", fetchMock);

    wrap(<NotesPopover leaid="3601234" districtName="Lincoln" onClose={vi.fn()} />);
    fireEvent.click(await screen.findByText("mock-add"));

    await waitFor(() => {
      const post = fetchMock.mock.calls.find(([, init]) => init?.method === "POST");
      expect(post).toBeTruthy();
      expect(JSON.parse(String(post![1].body))).toMatchObject({ noteType: "risk_flag", bodyText: "called" });
    });
    vi.unstubAllGlobals();
  });
});
