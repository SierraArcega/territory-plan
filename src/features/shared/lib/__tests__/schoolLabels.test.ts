import { describe, it, expect } from "vitest";
import { SCHOOL_LEVEL_LABELS, SCHOOL_TYPE_LABELS } from "../schoolLabels";

describe("SCHOOL_LEVEL_LABELS", () => {
  it("maps all 4 NCES school levels", () => {
    expect(SCHOOL_LEVEL_LABELS[1]).toBe("Elementary");
    expect(SCHOOL_LEVEL_LABELS[2]).toBe("Middle");
    expect(SCHOOL_LEVEL_LABELS[3]).toBe("High");
    expect(SCHOOL_LEVEL_LABELS[4]).toBe("Other");
  });
});

describe("SCHOOL_TYPE_LABELS", () => {
  it("maps all 4 NCES school types", () => {
    expect(SCHOOL_TYPE_LABELS[1]).toBe("Regular");
    expect(SCHOOL_TYPE_LABELS[2]).toBe("Special Education");
    expect(SCHOOL_TYPE_LABELS[3]).toBe("Career & Technical");
    expect(SCHOOL_TYPE_LABELS[4]).toBe("Alternative");
  });
});
