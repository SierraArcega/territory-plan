import { describe, it, expect, vi } from "vitest";
import { renderHook } from "@testing-library/react";
import { useRef } from "react";
import { useOutsideClick } from "../use-outside-click";

describe("useOutsideClick", () => {
  it("calls callback when clicking outside the ref element", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    // Click outside
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(div);
  });

  it("does not call callback when clicking inside the ref element", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    // Click inside
    div.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("does not call callback when active is false", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback, false);
    });

    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });

  it("calls callback on touchstart outside", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    document.dispatchEvent(new TouchEvent("touchstart", { bubbles: true }));
    expect(callback).toHaveBeenCalledTimes(1);

    document.body.removeChild(div);
  });

  it("cleans up listeners on unmount", () => {
    const callback = vi.fn();
    const div = document.createElement("div");
    document.body.appendChild(div);

    const { unmount } = renderHook(() => {
      const ref = useRef(div);
      useOutsideClick(ref, callback);
    });

    unmount();
    document.dispatchEvent(new MouseEvent("mousedown", { bubbles: true }));
    expect(callback).not.toHaveBeenCalled();

    document.body.removeChild(div);
  });
});
