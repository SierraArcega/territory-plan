import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotHomeState } from "../CopilotHomeState";
import type { CopilotNudge } from "../../lib/nudge-types";

const nudge: CopilotNudge = {
  id: "deals_slipping", kind: "deals_slipping", severity: "risk",
  headline: "3 deals are slipping", reason: "Open with a close date in the past",
  count: 3, seedPrompt: "Show me my open deals whose close date has already passed.",
};

describe("CopilotHomeState", () => {
  it("greets by first name and lists nudges", () => {
    render(
      <CopilotHomeState
        firstName="Sierra" nudges={[nudge]} recent={[]} onSeed={() => {}} onResume={() => {}}
      />,
    );
    expect(screen.getByText(/Good (morning|afternoon|evening), Sierra/)).toBeTruthy();
    expect(screen.getByText("3 deals are slipping")).toBeTruthy();
  });

  it("seeds the nudge's prompt on click (auto-send)", () => {
    const onSeed = vi.fn();
    render(
      <CopilotHomeState
        firstName="Sierra" nudges={[nudge]} recent={[]} onSeed={onSeed} onResume={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("3 deals are slipping"));
    expect(onSeed).toHaveBeenCalledWith(nudge.seedPrompt, true);
  });

  it("resumes a recent thread on click", () => {
    const onResume = vi.fn();
    render(
      <CopilotHomeState
        firstName="Sierra" nudges={[]} onSeed={() => {}} onResume={onResume}
        recent={[{ conversationId: "c1", title: "iowa fits", updatedAt: "2026-05-25T00:00:00.000Z" }]}
      />,
    );
    fireEvent.click(screen.getByText("iowa fits"));
    expect(onResume).toHaveBeenCalledWith("c1");
  });
});
