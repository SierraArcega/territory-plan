import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

// ProseMirror doesn't run in jsdom, so we mock @tiptap/react with a controllable
// fake editor to test the composer's submit/disable wiring deterministically.
// `h.empty` flips the editor's empty state between tests.
const h = vi.hoisted(() => ({ empty: true }));
const chainStub = {
  focus: () => chainStub,
  toggleBold: () => chainStub,
  toggleItalic: () => chainStub,
  toggleBulletList: () => chainStub,
  toggleOrderedList: () => chainStub,
  setLink: () => chainStub,
  run: () => {},
};
vi.mock("@tiptap/react", () => ({
  useEditor: () => ({
    isEmpty: h.empty,
    isActive: () => false,
    chain: () => chainStub,
    getJSON: () => ({ type: "doc", content: [{ type: "paragraph", content: [{ type: "text", text: "called the front office" }] }] }),
    getText: () => "called the front office",
    commands: { clearContent: () => {} },
  }),
  EditorContent: () => null,
}));

import { NoteComposer } from "../NoteComposer";

beforeEach(() => { h.empty = true; });

describe("NoteComposer", () => {
  it("renders a toolbar and disables Add while empty", () => {
    h.empty = true;
    render(<NoteComposer onSubmit={vi.fn()} pending={false} />);
    expect(screen.getByLabelText(/bold/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /add note/i })).toBeDisabled();
  });

  it("calls onSubmit with bodyJson + bodyText once non-empty", () => {
    h.empty = false;
    const onSubmit = vi.fn();
    render(<NoteComposer onSubmit={onSubmit} pending={false} />);
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));
    expect(onSubmit).toHaveBeenCalledWith({
      bodyJson: expect.objectContaining({ type: "doc" }),
      bodyText: "called the front office",
      noteType: "general_update",
    });
  });
});
