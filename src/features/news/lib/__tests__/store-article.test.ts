import { describe, it, expect } from "vitest";
import { hashUrl, normalizeUrl } from "../store-article";

describe("normalizeUrl", () => {
  it("strips utm_* params", () => {
    expect(normalizeUrl("https://a.com/p?utm_source=x&utm_medium=y&id=1")).toBe(
      "https://a.com/p?id=1"
    );
  });

  it("strips fbclid and gclid", () => {
    expect(normalizeUrl("https://a.com/p?fbclid=abc&gclid=xyz&id=1")).toBe(
      "https://a.com/p?id=1"
    );
  });

  it("strips the fragment hash", () => {
    expect(normalizeUrl("https://a.com/p?id=1#section")).toBe("https://a.com/p?id=1");
  });

  it("leaves non-tracking params alone", () => {
    expect(normalizeUrl("https://a.com/p?id=1&page=2")).toBe("https://a.com/p?id=1&page=2");
  });

  it("returns input for malformed URLs", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});

describe("hashUrl", () => {
  it("produces identical hashes for URLs that differ only in tracking params", () => {
    const a = hashUrl("https://a.com/p?id=1");
    const b = hashUrl("https://a.com/p?id=1&utm_source=newsletter&fbclid=abc");
    expect(a).toBe(b);
  });

  it("produces different hashes for truly different URLs", () => {
    const a = hashUrl("https://a.com/p?id=1");
    const b = hashUrl("https://a.com/p?id=2");
    expect(a).not.toBe(b);
  });

  it("returns a 64-char hex string", () => {
    expect(hashUrl("https://a.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
