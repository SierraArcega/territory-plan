import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackfillCompletionScreen from "../BackfillCompletionScreen";

describe("BackfillCompletionScreen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders the correct counts", () => {
    render(
      <BackfillCompletionScreen
        confirmed={5}
        dismissed={2}
        skipped={1}
        onGoToActivities={vi.fn()}
      />
    );
    expect(screen.getByText(/5 activities logged from 8 events/i)).toBeInTheDocument();
    expect(screen.getByText(/2 dismissed · 1 skipped/)).toBeInTheDocument();
  });

  it("pluralizes correctly for single activity + single event", () => {
    render(
      <BackfillCompletionScreen
        confirmed={1}
        dismissed={0}
        skipped={0}
        onGoToActivities={vi.fn()}
      />
    );
    expect(screen.getByText(/1 activity logged from 1 event/i)).toBeInTheDocument();
  });

  it("calls onGoToActivities when the CTA is clicked", async () => {
    // Use real timers inside this test so userEvent works
    vi.useRealTimers();
    const user = userEvent.setup();
    const onGoToActivities = vi.fn();
    render(
      <BackfillCompletionScreen
        confirmed={1}
        dismissed={0}
        skipped={0}
        onGoToActivities={onGoToActivities}
      />
    );
    await user.click(screen.getByRole("button", { name: /go to activities/i }));
    expect(onGoToActivities).toHaveBeenCalledTimes(1);
  });

  it("auto-forwards to Activities after 3 seconds", () => {
    const onGoToActivities = vi.fn();
    render(
      <BackfillCompletionScreen
        confirmed={1}
        dismissed={0}
        skipped={0}
        onGoToActivities={onGoToActivities}
      />
    );
    expect(onGoToActivities).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(3000);
    });
    expect(onGoToActivities).toHaveBeenCalledTimes(1);
  });

  it("hides the dismissed/skipped subtext when both are zero", () => {
    render(
      <BackfillCompletionScreen
        confirmed={3}
        dismissed={0}
        skipped={0}
        onGoToActivities={vi.fn()}
      />
    );
    expect(screen.queryByText(/dismissed/i)).not.toBeInTheDocument();
    expect(screen.queryByText(/skipped/i)).not.toBeInTheDocument();
  });
});
