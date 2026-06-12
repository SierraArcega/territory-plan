"use client";
import { formatCurrency } from "@/features/shared/lib/format";
import type { RenderResult, DocType } from "@/features/document-generation/lib/payload-types";
import type { SendBanner } from "@/features/document-generation/lib/send-banner";
import { docIdFromUrl } from "@/features/document-generation/lib/ids";
export type { SendBanner };

interface Props {
  result: RenderResult;
  orderTotal: number;
  docType: DocType;
  onSend: () => void | Promise<void>;
  onBack: () => void;
  busy?: boolean;
  sendState?: SendBanner | null;
  testMode?: boolean;
}

export default function ReviewStage({ result, orderTotal, docType, onSend, onBack, busy, sendState, testMode }: Props) {
  const docId = docIdFromUrl(result.docUrl);
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center gap-2">
        {docId && (
          <a
            href={`https://docs.google.com/document/d/${docId}/export?format=pdf`}
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-[#403770] px-3 py-1 text-sm text-[#403770] whitespace-nowrap"
          >View PDF ↓</a>
        )}
        <a
          href={result.docUrl}
          target="_blank"
          rel="noreferrer"
          className="text-sm text-[#403770] underline whitespace-nowrap"
        >Edit in Google Docs ↗</a>
      </div>
      <div className="text-sm">Order total: {formatCurrency(orderTotal)}</div>
      {result.agreementUrl && (
        <a href={result.agreementUrl} target="_blank" rel="noreferrer" className="block text-sm text-[#403770] underline">
          BOCES agreement (MLSA) ↗
        </a>
      )}

      {sendState?.phase === "processing" && (
        <div role="status" className="rounded-lg bg-[#F7F5FA] px-3 py-2 text-sm text-[#6E6390]">Sending…</div>
      )}
      {sendState?.phase === "sent" && (
        <div role="status" className="rounded-lg bg-[#EAF5EE] px-3 py-2 text-sm text-[#2C6E49]">
          Sent ✓{sendState.recipientEmail ? ` to ${sendState.recipientEmail}` : ""}
        </div>
      )}
      {sendState?.phase === "error" && (
        <div role="alert" className="rounded-lg bg-[#fef1f0] px-3 py-2 text-sm text-[#F37167]">
          Send failed: {sendState.sendError ?? "unknown error"}
        </div>
      )}
      {sendState?.phase === "unconfirmed" && (
        <div role="status" className="rounded-lg bg-[#F7F5FA] px-3 py-2 text-sm text-[#6E6390]">
          Send accepted — awaiting confirmation. Check back shortly.
        </div>
      )}

      {docType === "contract" && (
        <p className="text-xs text-[#6E6390]">
          If you Edit in Google Docs, send for signature via Google instead to ensure your changes are retained, then upload later manually!
        </p>
      )}

      {docType === "contract" && testMode === true && (
        <div role="status" className="rounded-lg border border-[#ffd98d] bg-[#fffaf1] px-3 py-2 text-sm text-[#997c43]">
          Sending is in test mode — this won&apos;t produce a real signature request. Use Google Docs to send an
          executable, or contact your Admin to disable Test Mode.
        </div>
      )}

      <div className="flex flex-wrap gap-2">
        {docType === "contract" && (
          <button type="button" onClick={onSend}
            disabled={busy || (sendState != null && sendState.phase !== "error")}
            className={`rounded-lg bg-[#403770] px-3 py-1 text-sm text-white whitespace-nowrap disabled:opacity-50${testMode === true ? " ring-2 ring-[#FFCF70]" : ""}`}>
            {busy ? "Sending…" : "Send for signature"}
            {testMode === true && (
              <span className="ml-2 rounded-full bg-[#fffaf1] px-1.5 py-0.5 text-[10px] font-semibold text-[#997c43] whitespace-nowrap">Test mode</span>
            )}
          </button>
        )}
        <button type="button" onClick={onBack}
          className="rounded-lg border border-[#C2BBD4] px-3 py-1 text-sm whitespace-nowrap">← Back to edit</button>
      </div>
    </div>
  );
}
