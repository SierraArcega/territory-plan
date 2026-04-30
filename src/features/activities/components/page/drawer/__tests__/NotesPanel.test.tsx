import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";

vi.mock("@/features/activities/lib/queries", () => ({
  useActivityNotes: vi.fn(() => ({ data: [], isLoading: false })),
  useCreateActivityNote: vi.fn(),
  useDeleteActivityNote: vi.fn(),
}));

vi.mock("@/lib/api", () => ({
  useProfile: vi.fn(() => ({ data: { id: "user-1" } })),
}));

import {
  useCreateActivityNote,
  useDeleteActivityNote,
} from "@/features/activities/lib/queries";
import NotesPanel from "../NotesPanel";

describe("NotesPanel", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("submitting a note fires onSaved on mutation success", () => {
    const onSaved = vi.fn();
    const mutate = vi.fn((_, opts) => opts?.onSuccess?.());
    (useCreateActivityNote as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate,
      isPending: false,
    });
    (useDeleteActivityNote as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });

    render(<NotesPanel activityId="act-1" readOnly={false} onSaved={onSaved} />);
    fireEvent.change(screen.getByPlaceholderText(/log a note/i), {
      target: { value: "Hello world" },
    });
    fireEvent.click(screen.getByRole("button", { name: /add note/i }));

    expect(mutate).toHaveBeenCalledWith(
      { activityId: "act-1", body: "Hello world" },
      expect.any(Object)
    );
    expect(onSaved).toHaveBeenCalled();
  });

  it("renders the composer above the notes-empty placeholder", () => {
    (useCreateActivityNote as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteActivityNote as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });
    render(<NotesPanel activityId="act-1" readOnly={false} />);
    const composer = screen.getByPlaceholderText(/log a note/i);
    const empty = screen.getByText(/no notes yet/i);
    // Composer DOM order: composer should appear before the empty placeholder.
    const order = composer.compareDocumentPosition(empty);
    expect(order & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  });

  it("hides the composer when readOnly", () => {
    (useCreateActivityNote as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
      isPending: false,
    });
    (useDeleteActivityNote as unknown as ReturnType<typeof vi.fn>).mockReturnValue({
      mutate: vi.fn(),
    });
    render(<NotesPanel activityId="act-1" readOnly />);
    expect(screen.queryByPlaceholderText(/log a note/i)).not.toBeInTheDocument();
  });
});
