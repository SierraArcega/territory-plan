import "server-only";

/** Downloads the executed PDF for a completed signature request.
 *  Returns null when Dropbox Sign hasn't finished assembling the file yet
 *  (409 conflict — documented at developers.hellosign.com/api/signature-request/files)
 *  — the caller leaves the archive columns empty rather than retrying
 *  inside the webhook. Throws on any other non-200. */
export async function fetchExecutedPdf(signatureRequestId: string): Promise<Buffer | null> {
  const apiKey = process.env.DROPBOX_SIGN_API_KEY ?? "";
  const res = await fetch(
    `https://api.hellosign.com/v3/signature_request/files/${encodeURIComponent(signatureRequestId)}?file_type=pdf`,
    { headers: { Authorization: `Basic ${Buffer.from(`${apiKey}:`).toString("base64")}` } },
  );
  if (res.status === 409) return null;
  if (!res.ok) throw new Error(`Dropbox Sign files returned HTTP ${res.status}`);
  return Buffer.from(await res.arrayBuffer());
}
