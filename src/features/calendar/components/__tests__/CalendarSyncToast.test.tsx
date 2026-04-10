import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CalendarSyncToast from "../CalendarSyncToast";

describe("CalendarSyncToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders nothing when not visible", () => {
    const { container } = render(
      <CalendarSyncToast
        visible={false}
        newEventCount={3}
        onDismiss={vi.fn()}
        onReview={vi.fn()}
      />
    );
    expect(container).toBeEmptyDOMElement();
  });

  it("renders the headline with the correct count", () => {
    render(
      <CalendarSyncToast
        visible={true}
        newEventCount={3}
        onDismiss={vi.fn()}
        onReview={vi.fn()}
      />
    );
    expect(screen.getByText("3 new events from your calendar")).toBeInTheDocument();
  });

  it("uses the singular form for exactly one event", () => {
    render(
      <CalendarSyncToast
        visible={true}
        newEventCount={1}
        onDismiss={vi.fn()}
        onReview={vi.fn()}
      />
    );
    expect(screen.getByText("1 new event from your calendar")).toBeInTheDocument();
  });

  it("auto-dismisses after 6 seconds", () => {
    const onDismiss = vi.fn();
    render(
      <CalendarSyncToast
        visible={true}
        newEventCount={2}
        onDismiss={onDismiss}
        onReview={vi.fn()}
      />
    );
    expect(onDismiss).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(6000);
    });
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });

  it("Review button calls onReview", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onReview = vi.fn();
    render(
      <CalendarSyncToast
        visible={true}
        newEventCount={1}
        onDismiss={vi.fn()}
        onReview={onReview}
      />
    );
    await user.click(screen.getByRole("button", { name: /review in inbox/i }));
    expect(onReview).toHaveBeenCalledTimes(1);
  });

  it("X button calls onDismiss", async () => {
    vi.useRealTimers();
    const user = userEvent.setup();
    const onDismiss = vi.fn();
    render(
      <CalendarSyncToast
        visible={true}
        newEventCount={1}
        onDismiss={onDismiss}
        onReview={vi.fn()}
      />
    );
    await user.click(screen.getByRole("button", { name: /dismiss notification/i }));
    expect(onDismiss).toHaveBeenCalledTimes(1);
  });
});
