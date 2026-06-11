import "server-only";

/** Slack mrkdwn requires &, <, > escaped in message text. */
function escapeSlackText(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

/** Inputs for the executed-agreement Slack post. Null fields are omitted from
 *  the message (pre-SP5 rows lack totals/school year/payload sender). */
export interface ExecutedAgreementNotice {
  pdf: Buffer;
  filename: string;
  companyName: string;
  orderTotal: number | null;
  schoolYearShort: string | null;
  repName: string | null;
  signedDate: string; // ISO YYYY-MM-DD
  driveUrl: string | null;
}

const SLACK_API = "https://slack.com/api";

export function buildExecutedMessage(n: ExecutedAgreementNotice): string {
  const facts = [
    ...(n.orderTotal != null
      ? [n.orderTotal.toLocaleString("en-US", { style: "currency", currency: "USD" })]
      : []),
    ...(n.schoolYearShort ? [n.schoolYearShort] : []),
    ...(n.repName ? [`sent by ${escapeSlackText(n.repName)}`] : []),
    `signed ${n.signedDate}`,
  ];
  const lines = [`🖋️ *Contract signed — ${escapeSlackText(n.companyName)}*`, facts.join(" · ")];
  if (n.driveUrl) lines.push(`Drive: ${n.driveUrl}`);
  return lines.join("\n");
}

interface SlackUploadUrlResponse {
  ok: boolean;
  error?: string;
  upload_url?: string;
  file_id?: string;
}

/** Posts the executed PDF + summary to the configured channel via Slack's
 *  external-upload flow (files.upload is deprecated). Missing env config skips
 *  with a warning (preview deploys); Slack API failures throw — the webhook
 *  isolates them. Strictly best-effort from the caller's perspective.
 *  Deliberately separate from the per-user Slack integration (src/features/integrations/) — this is a workspace bot token for automated system posts; the webhook has no user session. */
export async function postExecutedAgreement(n: ExecutedAgreementNotice): Promise<void> {
  const token = process.env.SLACK_BOT_TOKEN;
  const channel = process.env.SLACK_EXECUTED_CHANNEL_ID;
  if (!token || !channel) {
    console.warn("Slack notify skipped: SLACK_BOT_TOKEN / SLACK_EXECUTED_CHANNEL_ID not set");
    return;
  }

  const urlRes = await fetch(`${SLACK_API}/files.getUploadURLExternal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ filename: n.filename, length: String(n.pdf.byteLength) }),
  });
  const urlData = (await urlRes.json()) as SlackUploadUrlResponse;
  if (!urlData.ok || !urlData.upload_url || !urlData.file_id) {
    throw new Error(`Slack getUploadURLExternal failed: ${urlData.error ?? "missing upload_url/file_id"}`);
  }

  const putRes = await fetch(urlData.upload_url, { method: "POST", body: new Uint8Array(n.pdf) });
  if (!putRes.ok) throw new Error(`Slack file upload failed: HTTP ${putRes.status}`);

  const completeRes = await fetch(`${SLACK_API}/files.completeUploadExternal`, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      files: [{ id: urlData.file_id, title: n.filename }],
      channel_id: channel,
      initial_comment: buildExecutedMessage(n),
    }),
  });
  const completeData = (await completeRes.json()) as { ok: boolean; error?: string };
  if (!completeData.ok) throw new Error(`Slack completeUploadExternal failed: ${completeData.error}`);
}
