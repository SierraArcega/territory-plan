import { describe, it, expect } from "vitest";
import { isIdColumn } from "../result-columns";

describe("isIdColumn", () => {
  it("flags id-like columns", () => {
    expect(isIdColumn("leaid")).toBe(true);
    expect(isIdColumn("district_id")).toBe(true);
    expect(isIdColumn("id")).toBe(true);
    expect(isIdColumn("uuid")).toBe(true);
  });
  it("does not flag normal columns", () => {
    expect(isIdColumn("name")).toBe(false);
    expect(isIdColumn("enrollment")).toBe(false);
  });
});
