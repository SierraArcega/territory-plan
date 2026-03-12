import { describe, it, expect } from "vitest";
import { cn } from "../cn";

describe("cn", () => {
  it("merges multiple class strings", () => {
    expect(cn("px-4", "py-2")).toBe("px-4 py-2");
  });

  it("resolves Tailwind conflicts (last wins)", () => {
    expect(cn("px-4", "px-6")).toBe("px-6");
  });

  it("handles conditional classes", () => {
    const isActive = true;
    const isDisabled = false;
    expect(cn("base", isActive && "active", isDisabled && "disabled")).toBe("base active");
  });

  it("filters out falsy values", () => {
    expect(cn("base", null, undefined, false, 0, "", "end")).toBe("base end");
  });

  it("merges array inputs", () => {
    expect(cn(["px-4", "py-2"], "mt-2")).toBe("px-4 py-2 mt-2");
  });

  it("resolves complex Tailwind conflicts", () => {
    expect(cn("text-red-500", "text-blue-500")).toBe("text-blue-500");
    expect(cn("bg-plum", "bg-coral")).toBe("bg-coral");
  });

  it("returns empty string for no inputs", () => {
    expect(cn()).toBe("");
  });
});
