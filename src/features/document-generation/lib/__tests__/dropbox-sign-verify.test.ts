import { describe, it, expect } from "vitest";
import { createHmac } from "node:crypto";
import { verifyEventHash } from "../dropbox-sign-verify";

const API_KEY = "test-api-key";
const eventTime = "1700000000";
const eventType = "signature_request_sent";
// Dropbox Sign computes the hash exactly this way; we reproduce a valid one here.
const validHash = createHmac("sha256", API_KEY).update(eventTime + eventType).digest("hex");

describe("verifyEventHash", () => {
  it("returns true for a correctly-computed hash", () => {
    expect(verifyEventHash(API_KEY, eventTime, eventType, validHash)).toBe(true);
  });
  it("returns false for a tampered hash", () => {
    expect(verifyEventHash(API_KEY, eventTime, eventType, validHash.replace(/.$/, "0"))).toBe(false);
  });
  it("returns false for the wrong API key", () => {
    expect(verifyEventHash("wrong-key", eventTime, eventType, validHash)).toBe(false);
  });
  it("returns false for a non-hex / empty hash without throwing", () => {
    expect(verifyEventHash(API_KEY, eventTime, eventType, "")).toBe(false);
    expect(verifyEventHash(API_KEY, eventTime, eventType, "zzzz")).toBe(false);
  });
});
