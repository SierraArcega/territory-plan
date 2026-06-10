import { describe, it, expect } from "vitest";
import { districtContactsUrl, sendPollInterval, SEND_POLL_MS, SEND_POLL_MAX_UPDATES, SEND_POLL_MAX_ERRORS } from "../queries";

describe("districtContactsUrl", () => {
  it("builds a leaid-scoped contacts URL", () => {
    expect(districtContactsUrl("0612345")).toBe("/api/contacts?leaid=0612345");
  });
});

describe("sendPollInterval", () => {
  it("polls while processing", () => {
    expect(sendPollInterval("processing", 1, 0)).toBe(SEND_POLL_MS);
    expect(sendPollInterval(undefined, 0, 0)).toBe(SEND_POLL_MS);
  });
  it("stops on settled statuses", () => {
    for (const s of ["sent", "viewed", "signed", "declined", "canceled", "error"]) {
      expect(sendPollInterval(s, 1, 0)).toBe(false);
    }
  });
  it("stops after the update budget (timeout)", () => {
    expect(sendPollInterval("processing", SEND_POLL_MAX_UPDATES, 0)).toBe(false);
  });
  it("keeps polling just under the update budget (boundary)", () => {
    expect(sendPollInterval("processing", SEND_POLL_MAX_UPDATES - 1, 0)).toBe(SEND_POLL_MS);
  });
  it("stops after repeated fetch errors", () => {
    expect(sendPollInterval(undefined, 0, SEND_POLL_MAX_ERRORS)).toBe(false);
    expect(sendPollInterval(undefined, 0, SEND_POLL_MAX_ERRORS - 1)).toBe(SEND_POLL_MS);
  });
});
