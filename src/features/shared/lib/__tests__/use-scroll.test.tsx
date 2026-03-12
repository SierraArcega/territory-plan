import { describe, it, expect, vi, afterEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { useScrollTo, useScrollPosition } from "../use-scroll";

describe("useScrollTo", () => {
  it("returns a scrollTo function", () => {
    const { result } = renderHook(() => useScrollTo());
    expect(typeof result.current.scrollTo).toBe("function");
  });

  it("calls window.scrollTo with correct arguments for an HTMLElement", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const el = document.createElement("div");
    // Mock getBoundingClientRect
    el.getBoundingClientRect = vi.fn(() => ({
      top: 500,
      left: 0,
      bottom: 500,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
    document.body.appendChild(el);

    const { result } = renderHook(() => useScrollTo());
    act(() => {
      result.current.scrollTo(el);
    });

    expect(scrollToSpy).toHaveBeenCalledWith({
      top: expect.any(Number),
      behavior: "smooth",
    });

    scrollToSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("resolves a CSS selector to an element", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const el = document.createElement("div");
    el.id = "scroll-target";
    el.getBoundingClientRect = vi.fn(() => ({
      top: 200,
      left: 0,
      bottom: 200,
      right: 0,
      width: 0,
      height: 0,
      x: 0,
      y: 0,
      toJSON: () => {},
    }));
    document.body.appendChild(el);

    const { result } = renderHook(() => useScrollTo());
    act(() => {
      result.current.scrollTo("#scroll-target");
    });

    expect(scrollToSpy).toHaveBeenCalled();

    scrollToSpy.mockRestore();
    document.body.removeChild(el);
  });

  it("does nothing if selector matches no element", () => {
    const scrollToSpy = vi.spyOn(window, "scrollTo").mockImplementation(() => {});
    const { result } = renderHook(() => useScrollTo());
    act(() => {
      result.current.scrollTo("#nonexistent");
    });
    expect(scrollToSpy).not.toHaveBeenCalled();
    scrollToSpy.mockRestore();
  });
});

describe("useScrollPosition", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("returns initial position of 0,0", () => {
    const { result } = renderHook(() => useScrollPosition());
    expect(result.current.x).toBe(0);
    expect(result.current.y).toBe(0);
  });

  it("returns isScrolling as false initially", () => {
    const { result } = renderHook(() => useScrollPosition());
    expect(result.current.isScrolling).toBe(false);
  });
});
