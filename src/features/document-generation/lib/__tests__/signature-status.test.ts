import { describe, it, expect } from "vitest";
import { mapEventToStatus } from "../signature-status";

describe("mapEventToStatus", () => {
  it("maps signature_request_sent → sent", () => {
    expect(mapEventToStatus("signature_request_sent")).toBe("sent");
  });
  it("maps signature_request_viewed → viewed", () => {
    expect(mapEventToStatus("signature_request_viewed")).toBe("viewed");
  });
  it("maps both signed events → signed", () => {
    expect(mapEventToStatus("signature_request_signed")).toBe("signed");
    expect(mapEventToStatus("signature_request_all_signed")).toBe("signed");
  });
  it("maps declined and canceled", () => {
    expect(mapEventToStatus("signature_request_declined")).toBe("declined");
    expect(mapEventToStatus("signature_request_canceled")).toBe("canceled");
  });
  it("maps email bounce → error", () => {
    expect(mapEventToStatus("signature_request_email_bounce")).toBe("error");
  });
  it("returns null for events we ignore (e.g. callback_test)", () => {
    expect(mapEventToStatus("callback_test")).toBeNull();
    expect(mapEventToStatus("account_confirmed")).toBeNull();
  });
});
