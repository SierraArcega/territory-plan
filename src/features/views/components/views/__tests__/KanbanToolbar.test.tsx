import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { KanbanToolbar } from "../KanbanToolbar";
import { DEFAULT_KANBAN_LAYOUT } from "@/features/views/hooks/useKanbanLayout";

beforeEach(() => vi.clearAllMocks());

describe("KanbanToolbar rank controls", () => {
  it("cycles rank sort none -> asc via the Rank chip", () => {
    const onChange = vi.fn();
    render(<KanbanToolbar layout={DEFAULT_KANBAN_LAYOUT} onChange={onChange} />);
    fireEvent.click(screen.getByText("Rank"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rankSort: "asc" }));
  });

  it("opens the rank bucket filter with the three buckets", () => {
    const onChange = vi.fn();
    render(<KanbanToolbar layout={DEFAULT_KANBAN_LAYOUT} onChange={onChange} />);
    fireEvent.click(screen.getByText("Rank bucket"));
    expect(screen.getByText("Ranked")).toBeInTheDocument();
    expect(screen.getByText("Win Back")).toBeInTheDocument();
    expect(screen.getByText("New")).toBeInTheDocument();
  });

  it("selecting a bucket emits rankBuckets", () => {
    const onChange = vi.fn();
    render(<KanbanToolbar layout={DEFAULT_KANBAN_LAYOUT} onChange={onChange} />);
    fireEvent.click(screen.getByText("Rank bucket"));
    fireEvent.click(screen.getByText("Ranked"));
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ rankBuckets: ["rank"] }));
  });
});
