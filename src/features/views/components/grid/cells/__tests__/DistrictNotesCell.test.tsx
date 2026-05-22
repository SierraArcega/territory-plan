import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// Mock TipTap (popover embeds the editor) and useProfile so clicking the cell
// can mount NotesPopover in jsdom without ProseMirror or a real session.
const chainStub = {
  focus: () => chainStub, toggleBold: () => chainStub, toggleItalic: () => chainStub,
  toggleBulletList: () => chainStub, toggleOrderedList: () => chainStub, setLink: () => chainStub, run: () => {},
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({ isEmpty: true, isActive: () => false, chain: () => chainStub, getJSON: () => ({}), getText: () => "", commands: { clearContent: () => {} } }),
  EditorContent: () => null,
}));
vi.mock("@/lib/api", () => ({ useProfile: () => ({ data: { id: "me" } }) }));

import { DistrictNotesCell } from "../DistrictNotesCell";

function wrap(ui: React.ReactNode) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ notes: [] }), { status: 200, headers: { "Content-Type": "application/json" } })));
});

describe("DistrictNotesCell", () => {
  it("shows '+ Add note' when empty", () => {
    wrap(<DistrictNotesCell leaid="3601234" districtName="Lincoln" latest={null} count={0} latestType={null} />);
    expect(screen.getByText(/add note/i)).toBeInTheDocument();
  });

  it("shows snippet + count badge when notes exist", () => {
    wrap(<DistrictNotesCell leaid="3601234" districtName="Lincoln" latest="Sent renewal proposal" count={3} latestType="risk_flag" />);
    expect(screen.getByText(/Sent renewal proposal/)).toBeInTheDocument();
    expect(screen.getByText("3").className).toContain("#FFE0DC");
  });

  it("opens the popover on click", () => {
    wrap(<DistrictNotesCell leaid="3601234" districtName="Lincoln" latest="hi" count={1} latestType={null} />);
    expect(screen.queryByRole("dialog")).toBeNull();
    fireEvent.click(screen.getByRole("button", { name: /notes/i }));
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });
});
