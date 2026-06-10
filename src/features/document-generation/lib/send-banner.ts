// Derives the ReviewStage send banner from the synchronous send outcome plus the
// polled GeneratedDocument status. Pure — unit-tested directly, no mocking.
import type { GeneratedDocumentStatus } from "./queries";

export interface SendBanner {
  phase: "processing" | "sent" | "error" | "unconfirmed";
  recipientEmail?: string;
  sendError?: string;
}

export interface SyncSendOutcome {
  recipientEmail?: string;
  sendError?: string;
}

export function deriveSendBanner(
  syncSend: SyncSendOutcome | null,
  sendId: number | null,
  polled: GeneratedDocumentStatus | undefined,
  pollTimedOut: boolean,
): SendBanner | null {
  if (syncSend?.sendError) return { phase: "error", sendError: syncSend.sendError };
  if (sendId == null) return null;
  const status = polled?.status ?? "processing";
  if (status === "error") return { phase: "error", sendError: polled?.errorMessage ?? "send failed" };
  if (status === "processing") {
    return pollTimedOut
      ? { phase: "unconfirmed", recipientEmail: syncSend?.recipientEmail }
      : { phase: "processing", recipientEmail: syncSend?.recipientEmail };
  }
  return { phase: "sent", recipientEmail: polled?.recipientEmail || syncSend?.recipientEmail };
}
