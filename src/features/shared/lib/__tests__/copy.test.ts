import { describe, it, expect, vi, beforeEach } from "vitest";
import { copyToClipboard } from "../copy";

describe("copyToClipboard", () => {
  beforeEach(() => {
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(),
      },
    });
  });

  it("returns true on success", async () => {
    vi.mocked(navigator.clipboard.writeText).mockResolvedValue(undefined);
    expect(await copyToClipboard("hello")).toBe(true);
    expect(navigator.clipboard.writeText).toHaveBeenCalledWith("hello");
  });

  it("returns false on failure", async () => {
    vi.mocked(navigator.clipboard.writeText).mockRejectedValue(
      new Error("denied"),
    );
    expect(await copyToClipboard("hello")).toBe(false);
  });
});
