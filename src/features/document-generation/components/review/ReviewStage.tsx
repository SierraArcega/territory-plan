"use client";
import { formatCurrency } from "@/features/shared/lib/format";
import type { RenderResult, DocType } from "@/features/document-generation/lib/payload-types";
import type { SendBanner } from "@/features/document-generation/lib/send-banner";
export type { SendBanner };

interface Props {
  result: RenderResult;
  orderTotal: number;
  docType: DocType;
  onSend: () => void | Promise<void>;
  onBack: () => void;
  busy?: boolean;
  sendState?: SendBanner | null;
}

export default function ReviewStage({ result, orderTotal, docType, onSend, onBack, busy, sendState }: Props) {
  return (
    <div className="space-y-3">
      <a href={result.docUrl} target="_blank" rel="noreferrer"
        className="text-[#403770] underline whitespace-nowrap">Open the rendered document ↗</a>
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

      <div className="flex flex-wrap gap-2">
        {docType === "contract" && (
          <button type="button" onClick={onSend}
            disabled={busy || (sendState != null && sendState.phase !== "error")}
            className="rounded-lg bg-[#403770] px-3 py-1 text-sm text-white whitespace-nowrap disabled:opacity-50">
            {busy ? "Sending…" : "Send for signature"}
          </button>
        )}
        <button type="button" onClick={onBack}
          className="rounded-lg border border-[#C2BBD4] px-3 py-1 text-sm whitespace-nowrap">← Back to edit</button>
      </div>
    </div>
  );
}
