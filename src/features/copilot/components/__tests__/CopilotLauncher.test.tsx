import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotLauncher, COACHMARK_KEY } from "../CopilotLauncher";
import { LAUNCHER_POS_KEY } from "../../lib/launcher-position";

beforeEach(() => localStorage.clear());

function tap(el: Element) {
  fireEvent.pointerDown(el, { clientX: 100, clientY: 100, pointerId: 1 });
  fireEvent.pointerUp(el, { clientX: 100, clientY: 100, pointerId: 1 });
}

describe("CopilotLauncher", () => {
  it("opens on tap (pointer down/up with no movement)", () => {
    const onOpen = vi.fn();
    render(<CopilotLauncher onOpen={onOpen} />);
    tap(screen.getByRole("button", { name: /open copilot/i }));
    expect(onOpen).toHaveBeenCalledTimes(1);
  });

  it("does NOT open when dragged, and persists the dropped clamped position", () => {
    const onOpen = vi.fn();
    render(<CopilotLauncher onOpen={onOpen} />);
    const btn = screen.getByRole("button", { name: /open copilot/i });
    fireEvent.pointerDown(btn, { clientX: 100, clientY: 100, pointerId: 1 });
    fireEvent.pointerMove(btn, { clientX: 300, clientY: 250, pointerId: 1 });
    fireEvent.pointerUp(btn, { clientX: 300, clientY: 250, pointerId: 1 });
    expect(onOpen).not.toHaveBeenCalled();
    // default {960,648} + drag (+200,+150) = {1160,798}, clamped to viewport → {972,716}
    expect(JSON.parse(localStorage.getItem(LAUNCHER_POS_KEY)!)).toEqual({ x: 972, y: 716 });
    expect(btn.style.left).toBe("972px");
    expect(btn.style.top).toBe("716px");
  });

  it("restores a persisted position on mount", () => {
    localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ x: 40, y: 50 }));
    render(<CopilotLauncher onOpen={() => {}} />);
    const btn = screen.getByRole("button", { name: /open copilot/i });
    expect(btn.style.left).toBe("40px");
    expect(btn.style.top).toBe("50px");
  });

  it("opens via keyboard (Enter and Space)", () => {
    const onOpen = vi.fn();
    render(<CopilotLauncher onOpen={onOpen} />);
    const btn = screen.getByRole("button", { name: /open copilot/i });
    fireEvent.keyDown(btn, { key: "Enter" });
    fireEvent.keyDown(btn, { key: " " });
    expect(onOpen).toHaveBeenCalledTimes(2);
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
