import { describe, it, expect } from "vitest";
import { generateFingerprint } from "../fingerprint";

describe("generateFingerprint", () => {
  describe("consistency", () => {
    it("generates the same fingerprint for the same inputs", () => {
      const fp1 = generateFingerprint("3601234", "Math Teacher", "Lincoln Elementary");
      const fp2 = generateFingerprint("3601234", "Math Teacher", "Lincoln Elementary");
      expect(fp1).toBe(fp2);
    });

    it("returns a 64-character hex string (SHA-256)", () => {
      const fp = generateFingerprint("3601234", "Science Teacher");
      expect(fp).toMatch(/^[0-9a-f]{64}$/);
    });
  });

  describe("uniqueness", () => {
    it("generates different fingerprints for different leaids", () => {
      const fp1 = generateFingerprint("3601234", "Math Teacher");
      const fp2 = generateFingerprint("3609999", "Math Teacher");
      expect(fp1).not.toBe(fp2);
    });

    it("generates different fingerprints for different titles", () => {
      const fp1 = generateFingerprint("3601234", "Math Teacher");
      const fp2 = generateFingerprint("3601234", "Science Teacher");
      expect(fp1).not.toBe(fp2);
    });

    it("generates different fingerprints for different school names", () => {
      const fp1 = generateFingerprint("3601234", "Math Teacher", "Lincoln Elementary");
      const fp2 = generateFingerprint("3601234", "Math Teacher", "Washington Elementary");
      expect(fp1).not.toBe(fp2);
    });
  });

  describe("normalization", () => {
    it("is case insensitive", () => {
      const fp1 = generateFingerprint("3601234", "MATH TEACHER", "LINCOLN ELEMENTARY");
      const fp2 = generateFingerprint("3601234", "math teacher", "lincoln elementary");
      expect(fp1).toBe(fp2);
    });

    it("trims leading and trailing whitespace", () => {
      const fp1 = generateFingerprint("  3601234  ", "  Math Teacher  ", "  Lincoln  ");
      const fp2 = generateFingerprint("3601234", "Math Teacher", "Lincoln");
      expect(fp1).toBe(fp2);
    });

    it("collapses multiple internal spaces to a single space", () => {
      const fp1 = generateFingerprint("3601234", "Math    Teacher", "Lincoln   Elementary");
      const fp2 = generateFingerprint("3601234", "Math Teacher", "Lincoln Elementary");
      expect(fp1).toBe(fp2);
    });

    it("normalizes all three factors together", () => {
      const fp1 = generateFingerprint("  3601234 ", "  MATH   teacher  ", "  Lincoln   ELEM  ");
      const fp2 = generateFingerprint("3601234", "math teacher", "lincoln elem");
      expect(fp1).toBe(fp2);
    });
  });

  describe("optional schoolName", () => {
    it("handles missing schoolName by using empty string", () => {
      const fpWithoutSchool = generateFingerprint("3601234", "Math Teacher");
      const fpWithEmpty = generateFingerprint("3601234", "Math Teacher", "");
      expect(fpWithoutSchool).toBe(fpWithEmpty);
    });

    it("generates a different fingerprint when schoolName is provided vs omitted", () => {
      const fpWithSchool = generateFingerprint("3601234", "Math Teacher", "Lincoln");
      const fpWithout = generateFingerprint("3601234", "Math Teacher");
      expect(fpWithSchool).not.toBe(fpWithout);
    });
  });
});
