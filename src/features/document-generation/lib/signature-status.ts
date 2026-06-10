// Maps Dropbox Sign event_type values to our SignatureStatus. Returns null for
// events that should be acknowledged but not change a row (callback_test, etc.).
// Intentionally excludes "processing" (only written by the send route on
// synchronous accept) and "rendered" (only written by the render route for
// BOCES quotes) — no Dropbox Sign event ever maps to either.
export type SignatureStatusValue =
  | "sent" | "viewed" | "signed" | "declined" | "canceled" | "error";

const EVENT_TO_STATUS: Record<string, SignatureStatusValue> = {
  signature_request_sent: "sent",
  signature_request_viewed: "viewed",
  signature_request_signed: "signed",
  signature_request_all_signed: "signed",
  signature_request_declined: "declined",
  signature_request_canceled: "canceled",
  signature_request_email_bounce: "error",
  signature_request_invalid: "error",
};

export function mapEventToStatus(eventType: string): SignatureStatusValue | null {
  return EVENT_TO_STATUS[eventType] ?? null;
}
