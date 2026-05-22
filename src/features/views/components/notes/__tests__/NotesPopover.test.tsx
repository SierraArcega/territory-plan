import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock TipTap so the embedded NoteComposer/NoteBody don't depend on ProseMirror
// in jsdom. We assert on NoteEntry's own DOM (author, header, empty state),
// which renders outside the editor.
const chainStub = {
  focus: () => chainStub, toggleBold: () => chainStub, toggleItalic: () => chainStub,
  toggleBulletList: () => chainStub, toggleOrderedList: () => chainStub, setLink: () => chainStub, run: () => {},
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({ isEmpty: true, isActive: () => false, chain: () => chainStub, getJSON: () => ({}), getText: () => "", commands: { clearContent: () => {} } }),
  EditorContent: () => null,
}));
vi.mock("@/lib/api", () => ({ useProfile: () => ({ data: { id: "me" } }) }));

import { NotesPopover } from "../NotesPopover";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => vi.restoreAllMocks());

describe("NotesPopover", () => {
  it("loads and lists the district's notes (author + header)", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({
      notes: [{
        id: "n1", bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "newest" }] }] },
        bodyText: "newest", createdAt: "2026-05-21T13:00:00Z", updatedAt: "2026-05-21T13:00:00Z",
        author: { id: "me", fullName: "Sierra", email: "s@fm.com", avatarUrl: null },
      }],
    }), { status: 200, headers: { "Content-Type": "application/json" } })));
    wrap(<NotesPopover leaid="3601234" districtName="Lincoln Elem SD" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText("Sierra")).toBeInTheDocument());
    expect(screen.getByText(/Lincoln Elem SD · Notes/)).toBeInTheDocument();
    vi.unstubAllGlobals();
  });

  it("renders an empty state when there are no notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ notes: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
    wrap(<NotesPopover leaid="3601234" districtName="Lincoln Elem SD" onClose={vi.fn()} />);
    await waitFor(() => expect(screen.getByText(/no notes yet/i)).toBeInTheDocument());
    vi.unstubAllGlobals();
  });
});
