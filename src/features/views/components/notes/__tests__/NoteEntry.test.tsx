import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// NoteEntry renders NoteBody (TipTap). Mock @tiptap/react so jsdom doesn't run
// ProseMirror; the assertions below are on NoteEntry's own DOM, not the body.
vi.mock("@tiptap/react", () => ({
  useEditor: () => null,
  EditorContent: () => null,
}));

import { NoteEntry } from "../NoteEntry";
import type { DistrictNoteEntry } from "../../../lib/queries";

const base: DistrictNoteEntry = {
  id: "n1",
  bodyJson: { type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "hello" }] }] },
  bodyText: "hello",
  noteType: "general",
  createdAt: "2026-05-21T12:00:00Z",
  updatedAt: "2026-05-21T12:00:00Z",
  author: { id: "me", fullName: "Sierra A.", email: "s@fm.com", avatarUrl: null },
};

describe("NoteEntry", () => {
  it("shows author name and an edited marker only when updatedAt > createdAt", () => {
    const { rerender } = render(<NoteEntry note={base} currentUserId="me" onDelete={vi.fn()} />);
    expect(screen.getByText("Sierra A.")).toBeInTheDocument();
    expect(screen.queryByText(/edited/i)).toBeNull();
    rerender(<NoteEntry note={{ ...base, updatedAt: "2026-05-21T13:00:00Z" }} currentUserId="me" onDelete={vi.fn()} />);
    expect(screen.getByText(/edited/i)).toBeInTheDocument();
  });

  it("shows delete only for the author and fires onDelete", () => {
    const onDelete = vi.fn();
    const { rerender } = render(<NoteEntry note={base} currentUserId="someone-else" onDelete={onDelete} />);
    expect(screen.queryByRole("button", { name: /delete note/i })).toBeNull();
    rerender(<NoteEntry note={base} currentUserId="me" onDelete={onDelete} />);
    fireEvent.click(screen.getByRole("button", { name: /delete note/i }));
    expect(onDelete).toHaveBeenCalledWith("n1");
  });
});
