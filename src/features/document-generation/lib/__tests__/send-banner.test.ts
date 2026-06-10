import { describe, it, expect } from "vitest";
import { deriveSendBanner } from "../send-banner";
import type { GeneratedDocumentStatus } from "../queries";

describe("deriveSendBanner", () => {
  it("returns null before any send has occurred (syncSend is null, sendId is null)", () => {
    expect(deriveSendBanner(null, null, undefined, false)).toBeNull();
  });

  it("sync error wins over everything else — returns error phase immediately", () => {
    const result = deriveSendBanner(
      { sendError: "domain not allowed" },
      42,
      { id: 42, status: "processing", errorMessage: null, recipientEmail: "s@x.org", docUrl: "" },
      false,
    );
    expect(result).toEqual({ phase: "error", sendError: "domain not allowed" });
  });

  it("returns null when sendId is null even with a syncSend object (no error)", () => {
    // sendId null means the send call failed synchronously without an id
    expect(deriveSendBanner({ recipientEmail: "x@y.com" }, null, undefined, false)).toBeNull();
  });

  it("returns processing banner while status is processing and not timed out", () => {
    const result = deriveSendBanner(
      { recipientEmail: "s@x.org" },
      5,
      undefined,
      false,
    );
    expect(result).toEqual({ phase: "processing", recipientEmail: "s@x.org" });
  });

  it("returns processing banner when polled data says processing and not timed out", () => {
    const polled: GeneratedDocumentStatus = {
      id: 5, status: "processing", errorMessage: null, recipientEmail: "s@x.org", docUrl: "",
    };
    expect(deriveSendBanner({ recipientEmail: "s@x.org" }, 5, polled, false)).toEqual({
      phase: "processing",
      recipientEmail: "s@x.org",
    });
  });

  it("returns unconfirmed banner when processing and poll timed out", () => {
    const result = deriveSendBanner(
      { recipientEmail: "s@x.org" },
      5,
      undefined,
      true,
    );
    expect(result).toEqual({ phase: "unconfirmed", recipientEmail: "s@x.org" });
  });

  it("returns error phase when polled status is error with stamped errorMessage", () => {
    const polled: GeneratedDocumentStatus = {
      id: 5, status: "error", errorMessage: "signature_request_invalid", recipientEmail: "", docUrl: "",
    };
    const result = deriveSendBanner({ recipientEmail: "s@x.org" }, 5, polled, false);
    expect(result).toEqual({ phase: "error", sendError: "signature_request_invalid" });
  });

  it("falls back to 'send failed' when polled status is error but errorMessage is null", () => {
    const polled: GeneratedDocumentStatus = {
      id: 5, status: "error", errorMessage: null, recipientEmail: "", docUrl: "",
    };
    const result = deriveSendBanner({ recipientEmail: "s@x.org" }, 5, polled, false);
    expect(result).toEqual({ phase: "error", sendError: "send failed" });
  });

  it("returns sent banner when status is settled — uses polled recipientEmail", () => {
    const polled: GeneratedDocumentStatus = {
      id: 5, status: "sent", errorMessage: null, recipientEmail: "s@x.org", docUrl: "",
    };
    const result = deriveSendBanner({ recipientEmail: "other@x.org" }, 5, polled, false);
    expect(result).toEqual({ phase: "sent", recipientEmail: "s@x.org" });
  });

  it("falls back to syncSend recipientEmail when polled recipientEmail is empty string", () => {
    const polled: GeneratedDocumentStatus = {
      id: 5, status: "sent", errorMessage: null, recipientEmail: "", docUrl: "",
    };
    const result = deriveSendBanner({ recipientEmail: "fallback@x.org" }, 5, polled, false);
    // Empty string is falsy, so falls back to syncSend.recipientEmail
    expect(result).toEqual({ phase: "sent", recipientEmail: "fallback@x.org" });
  });

  it("handles 'viewed' as a settled status (returns sent phase)", () => {
    const polled: GeneratedDocumentStatus = {
      id: 5, status: "viewed", errorMessage: null, recipientEmail: "s@x.org", docUrl: "",
    };
    expect(deriveSendBanner({ recipientEmail: "s@x.org" }, 5, polled, false)).toEqual({
      phase: "sent",
      recipientEmail: "s@x.org",
    });
  });
});
