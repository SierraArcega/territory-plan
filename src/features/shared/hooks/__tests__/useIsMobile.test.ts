import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useIsMobile } from "../useIsMobile";

type MQListener = (e: Pick<MediaQueryListEvent, "matches">) => void;

function mockMatchMedia(matches: boolean) {
  const listeners: MQListener[] = [];
  const mq = {
    matches,
    media: "(max-width: 639px)",
    onchange: null,
    addEventListener: vi.fn((_: string, cb: MQListener) => listeners.push(cb)),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
  };
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn(() => mq),
  });
  return { mq, listeners };
}

beforeEach(() => {
  vi.restoreAllMocks();
});

describe("useIsMobile", () => {
  it("returns true when matchMedia reports a narrow window", () => {
    mockMatchMedia(true);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(true);
  });

  it("returns false when matchMedia reports a wide window", () => {
    mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);
  });

  it("updates when the media query fires a change event", () => {
    const { listeners } = mockMatchMedia(false);
    const { result } = renderHook(() => useIsMobile());
    expect(result.current).toBe(false);

    act(() => {
      listeners.forEach((cb) => cb({ matches: true }));
    });

    expect(result.current).toBe(true);
  });

  it("removes the listener on unmount", () => {
    const { mq } = mockMatchMedia(false);
    const { unmount } = renderHook(() => useIsMobile());
    unmount();
    expect(mq.removeEventListener).toHaveBeenCalledOnce();
  });
});
