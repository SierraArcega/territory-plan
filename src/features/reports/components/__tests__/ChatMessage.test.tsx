import { describe, expect, it } from "vitest";
import { render, screen } from "@testing-library/react";
import ChatMessage from "../ChatMessage";
import type { ChatMessage as ChatMessageData } from "../../lib/ui-types";

function msg(overrides: Partial<ChatMessageData>): ChatMessageData {
  return {
    id: "x",
    role: "assistant",
    content: "ok",
    timestamp: "2026-04-18T00:00:00Z",
    ...overrides,
  };
}

describe("ChatMessage", () => {
  it("renders user messages without a receipt block", () => {
    render(<ChatMessage message={msg({ role: "user", content: "hi" })} />);
    expect(screen.getByText("hi")).toBeInTheDocument();
  });

  it("renders assistant prose and no action block when actions is empty", () => {
    render(
      <ChatMessage
        message={msg({
          content: "Clarify please?",
          receipt: { actions: [] },
        })}
      />,
    );
    expect(screen.getByText("Clarify please?")).toBeInTheDocument();
    expect(screen.queryByText(/\badd\b/i)).not.toBeInTheDocument();
  });

  it("renders no action block when receipt is missing", () => {
    render(<ChatMessage message={msg({ content: "text only" })} />);
    expect(screen.getByText("text only")).toBeInTheDocument();
  });

  it("renders one row per action with tag, field, and label", () => {
    render(
      <ChatMessage
        message={msg({
          content: "Added owner column and flipped the sort.",
          receipt: {
            actions: [
              { kind: "add", field: "column", label: "owner_name" },
              {
                kind: "mod",
                field: "sort",
                label: "revenue ↓",
                detail: "asc → desc",
              },
              { kind: "rem", field: "filter", label: "stage = closed_won" },
            ],
          },
        })}
      />,
    );
    expect(screen.getByText("add")).toBeInTheDocument();
    expect(screen.getByText("mod")).toBeInTheDocument();
    expect(screen.getByText("rem")).toBeInTheDocument();
    expect(screen.getByText("owner_name")).toBeInTheDocument();
    expect(screen.getByText("revenue ↓")).toBeInTheDocument();
    expect(screen.getByText(/asc → desc/)).toBeInTheDocument();
    expect(screen.getByText("stage = closed_won")).toBeInTheDocument();
  });
});
