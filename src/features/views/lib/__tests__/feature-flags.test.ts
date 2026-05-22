import { describe, it, expect, afterEach, vi } from "vitest";

// feature-flags reads process.env at module load, so each case resets the
// module registry and re-imports to evaluate the flag against a fresh env.
describe("LISTS_ENABLED", () => {
  const original = process.env.NEXT_PUBLIC_LISTS_ENABLED;

  afterEach(() => {
    process.env.NEXT_PUBLIC_LISTS_ENABLED = original;
    vi.resetModules();
  });

  it("defaults to false when the env var is unset (prod ships Lists dark)", async () => {
    vi.resetModules();
    delete process.env.NEXT_PUBLIC_LISTS_ENABLED;
    const { LISTS_ENABLED } = await import("../feature-flags");
    expect(LISTS_ENABLED).toBe(false);
  });

  it('is false for any value other than the string "true"', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_LISTS_ENABLED = "1";
    const { LISTS_ENABLED } = await import("../feature-flags");
    expect(LISTS_ENABLED).toBe(false);
  });

  it('is true only when set to "true"', async () => {
    vi.resetModules();
    process.env.NEXT_PUBLIC_LISTS_ENABLED = "true";
    const { LISTS_ENABLED } = await import("../feature-flags");
    expect(LISTS_ENABLED).toBe(true);
  });
});
