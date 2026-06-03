import { describe, it, expect } from "vitest";
import {
  INTERNAL_EMAIL_DOMAINS,
  emailDomain,
  isInternalEmail,
  isExternalEmail,
} from "../internal-domains";

describe("internal-domains", () => {
  it("lists fullmind + elevatek12 as internal domains", () => {
    expect(INTERNAL_EMAIL_DOMAINS).toContain("fullmindlearning.com");
    expect(INTERNAL_EMAIL_DOMAINS).toContain("elevatek12.com");
  });

  it("extracts the lowercased domain", () => {
    expect(emailDomain("Jane.Doe@Marion.K12.IN.US")).toBe("marion.k12.in.us");
  });

  it("treats colleague domains as internal", () => {
    expect(isInternalEmail("rep@fullmindlearning.com")).toBe(true);
    expect(isInternalEmail("partner@ELEVATEK12.com")).toBe(true);
    expect(isInternalEmail("jane@marion.k12.in.us")).toBe(false);
  });

  it("treats district emails as external (and ignores colleagues/malformed)", () => {
    expect(isExternalEmail("jane@marion.k12.in.us")).toBe(true);
    expect(isExternalEmail("rep@fullmindlearning.com")).toBe(false);
    expect(isExternalEmail("not-an-email")).toBe(false);
  });
});
