import { describe, it, expect, beforeEach } from "vitest";
import {
  clampToViewport,
  defaultLauncherPosition,
  readStoredPosition,
  LAUNCHER_SIZE,
  LAUNCHER_POS_KEY,
} from "../launcher-position";

describe("clampToViewport", () => {
  it("leaves an in-bounds position unchanged", () => {
    expect(clampToViewport({ x: 100, y: 120 }, 44, 1000, 800)).toEqual({ x: 100, y: 120 });
  });

  it("clamps past the right/bottom edges (size + 8px margin)", () => {
    expect(clampToViewport({ x: 5000, y: 5000 }, 44, 1000, 800)).toEqual({ x: 948, y: 748 });
  });

  it("clamps negative coordinates to the 8px margin", () => {
    expect(clampToViewport({ x: -50, y: -10 }, 44, 1000, 800)).toEqual({ x: 8, y: 8 });
  });
});

describe("defaultLauncherPosition", () => {
  it("sits bottom-right, raised to clear a pager footer", () => {
    // 1000 - 44 - 20 = 936 (right gap); 800 - 44 - 76 = 680 (bottom gap)
    expect(defaultLauncherPosition(1000, 800)).toEqual({ x: 936, y: 680 });
  });
});

describe("readStoredPosition", () => {
  beforeEach(() => localStorage.clear());

  it("returns null when nothing is stored", () => {
    expect(readStoredPosition()).toBeNull();
  });

  it("returns null for malformed JSON", () => {
    localStorage.setItem(LAUNCHER_POS_KEY, "not json");
    expect(readStoredPosition()).toBeNull();
  });

  it("returns a clamped stored position", () => {
    localStorage.setItem(LAUNCHER_POS_KEY, JSON.stringify({ x: 99999, y: 99999 }));
    const p = readStoredPosition()!;
    // jsdom default viewport is 1024x768
    expect(p).toEqual({ x: 1024 - LAUNCHER_SIZE - 8, y: 768 - LAUNCHER_SIZE - 8 });
  });
});
