import { describe, it, expect, afterEach } from "vitest";
import { requireEnv } from "../env";

const TEST_VAR = "TEST_REQUIRE_ENV_THROWAWAY_12345";

afterEach(() => {
  delete process.env[TEST_VAR];
});

describe("requireEnv", () => {
  it("returns the value when the env var is set", () => {
    process.env[TEST_VAR] = "hello";
    expect(requireEnv(TEST_VAR)).toBe("hello");
  });

  it("throws an error naming the missing var when it is absent", () => {
    delete process.env[TEST_VAR];
    expect(() => requireEnv(TEST_VAR)).toThrow(
      `Missing required env var: ${TEST_VAR}`,
    );
  });
});
