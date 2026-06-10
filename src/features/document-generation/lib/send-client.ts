import type { DocPayload } from "./payload-types";

export interface SendResponse {
  id?: number;
  docUrl: string;
  status: "processing" | "error";
  signatureRequestId: string | null;
  sendError?: string;
  recipientEmail?: string;
}

/** Calls the app's send route, which renders tagged + sends via Dropbox Sign. */
export async function sendForSignatureRequest(payload: DocPayload, districtLeaId: string): Promise<SendResponse> {
  const res = await fetch("/api/document-generation/send", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, districtLeaId }),
  });
  if (!res.ok) throw new Error(`Send failed: HTTP ${res.status}`);
  return (await res.json()) as SendResponse;
}
