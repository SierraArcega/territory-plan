import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { useMapStore } from "@/features/shared/lib/app-store";

// Stub the panel's data hooks + the log sub-view so we can drive the header
// controls without a network/query layer.
vi.mock("@/features/copilot/hooks/useCopilotTurnStream", () => ({
  useCopilotTurnStream: () => ({ isPending: false, submit: vi.fn() }),
}));
vi.mock("@/features/copilot/hooks/useExecuteCopilotAction", () => ({
  useExecuteCopilotAction: () => ({ mutateAsync: vi.fn() }),
}));
vi.mock("@/features/copilot/hooks/useCopilotPageContext", () => ({
  useCopilotPageContext: () => () => ({}),
}));
vi.mock("@/features/copilot/components/CopilotActivityLog", () => ({
  CopilotActivityLog: () => <div data-testid="activity-log">log</div>,
}));
vi.mock("@/features/copilot/hooks/useCopilotNudges", () => ({
  useCopilotNudges: () => ({ data: [] }),
}));
vi.mock("@/features/copilot/hooks/useCopilotConversations", () => ({
  useCopilotConversations: () => ({ data: [] }),
}));
vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: { fullName: null, id: "test-user" } }),
}));

import CopilotPanel from "../CopilotPanel";

describe("CopilotPanel — New chat", () => {
  beforeEach(() => {
    cleanup();
    localStorage.clear();
    // jsdom doesn't implement scrollTo; the messages auto-scroll effect calls it.
    (HTMLElement.prototype as unknown as { scrollTo: () => void }).scrollTo = vi.fn();
    useMapStore.setState({ copilotOpen: true });
  });

  it("returns to the chat view when New chat is clicked from the activity log", () => {
    render(<CopilotPanel />);

    // Opens in chat view: the composer is present.
    expect(screen.getByPlaceholderText(/Message Copilot/)).toBeInTheDocument();

    // Switch to the activity log.
    fireEvent.click(screen.getByLabelText("Activity log"));
    expect(screen.getByTestId("activity-log")).toBeInTheDocument();
    expect(screen.queryByPlaceholderText(/Message Copilot/)).not.toBeInTheDocument();

    // New chat must bring us back to a fresh chat, not leave us on the log.
    fireEvent.click(screen.getByLabelText("New chat"));
    expect(screen.queryByTestId("activity-log")).not.toBeInTheDocument();
    expect(screen.getByPlaceholderText(/Message Copilot/)).toBeInTheDocument();
  });
});
