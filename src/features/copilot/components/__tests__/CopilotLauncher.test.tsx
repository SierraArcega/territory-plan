import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotLauncher, COACHMARK_KEY } from "../CopilotLauncher";

beforeEach(() => localStorage.clear());

describe("CopilotLauncher", () => {
  it("opens on click", () => {
    const onOpen = vi.fn();
    render(<CopilotLauncher onOpen={onOpen} />);
    fireEvent.click(screen.getByRole("button", { name: /open copilot/i }));
    expect(onOpen).toHaveBeenCalled();
  });

  it("shows the coachmark once, then never again", () => {
    const { unmount } = render(<CopilotLauncher onOpen={() => {}} />);
    expect(screen.getByText(/right here/i)).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /dismiss tip/i }));
    expect(screen.queryByText(/right here/i)).toBeNull();
    expect(localStorage.getItem(COACHMARK_KEY)).toBe("1");
    unmount();
    render(<CopilotLauncher onOpen={() => {}} />);
    expect(screen.queryByText(/right here/i)).toBeNull();
  });
});
