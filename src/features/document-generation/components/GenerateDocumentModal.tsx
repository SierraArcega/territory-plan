"use client";
import { useState } from "react";
import DocumentPayloadForm from "./form/DocumentPayloadForm";
import ReviewStage from "./review/ReviewStage";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";
import type { DocFormState, RenderClient, RenderResult } from "@/features/document-generation/lib/payload-types";
import { assemblePayload } from "@/features/document-generation/lib/payload";
import { computeTotals } from "@/features/document-generation/lib/quote";
import { stubRenderClient } from "@/features/document-generation/lib/render-client";
import type { PrefillResult } from "@/features/document-generation/lib/prefill";
import { sendForSignatureRequest } from "@/features/document-generation/lib/send-client";
import { schoolYearFromDate } from "@/features/document-generation/lib/school-year";
import { useGeneratedDocumentStatus } from "@/features/document-generation/lib/queries";
import { deriveSendBanner } from "@/features/document-generation/lib/send-banner";

interface Props {
  prefill: PrefillResult;
  onClose: () => void;
  renderClient?: RenderClient;
}

function seedState(p: PrefillResult): DocFormState {
  const base = emptyFormState(p.docType, p.districtLeaId);
  return {
    ...base,
    startDate: p.startDate,
    endDate: p.endDate,
    payTerms: p.payTerms,
    minAmt: p.minAmt,
    maxAmt: p.maxAmt,
    companyName: p.companyName,
    billingAddress: p.billingAddress,
    senderFirst: p.sender.first,
    senderLast: p.sender.last,
    senderTitle: p.sender.title,
    senderEmail: p.sender.email,
    schoolYear: schoolYearFromDate(p.startDate) ?? base.schoolYear,
  };
}

export default function GenerateDocumentModal({ prefill, onClose, renderClient = stubRenderClient }: Props) {
  const [state, setState] = useState<DocFormState>(() => seedState(prefill));
  const [result, setResult] = useState<RenderResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [sendId, setSendId] = useState<number | null>(null);
  const [syncSend, setSyncSend] = useState<{ recipientEmail?: string; sendError?: string } | null>(null);

  const statusQuery = useGeneratedDocumentStatus(sendId);

  // Derive the send banner BEFORE handleSend so the retry guard can use it
  const sendState = deriveSendBanner(syncSend, sendId, statusQuery.data, statusQuery.pollTimedOut);

  const canSend = !busy && (sendId == null || sendState?.phase === "error");

  async function doRender(tags: boolean): Promise<RenderResult> {
    setBusy(true);
    try {
      const res = await renderClient(assemblePayload(state), { tags, districtLeaId: state.districtLeaId });
      setResult(res);
      return res;
    } finally {
      setBusy(false);
    }
  }

  async function handleSend() {
    if (!canSend) return;
    setBusy(true);
    setSendId(null);       // retry path: clear prior tracking before a fresh POST
    setSyncSend(null);
    try {
      const payload = assemblePayload(state);
      const res = await sendForSignatureRequest(payload, state.districtLeaId);
      if (res.status === "processing" && res.id != null) {
        setSendId(res.id);
        setSyncSend({ recipientEmail: res.recipientEmail });
      } else {
        setSyncSend({ sendError: res.sendError ?? "send failed" });
      }
    } catch {
      setSyncSend({ sendError: "Send request failed" });
    } finally {
      setBusy(false);
    }
  }

  const orderTotal = computeTotals(state.docType, state.lineItems, state.feePct, state.adjustments).orderTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Generate document"
        className="relative mx-4 max-h-[90vh] w-full max-w-5xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {result ? (
          <ReviewStage
            result={result}
            orderTotal={orderTotal}
            docType={state.docType}
            busy={busy}
            sendState={sendState}
            onSend={handleSend}
            onBack={() => { setResult(null); setSendId(null); setSyncSend(null); }}
          />
        ) : (
          <DocumentPayloadForm
            value={state}
            onChange={setState}
            busy={busy}
            onRender={() => { if (!busy) void doRender(false); }}  // preview is always clean (tags off); "Send for signature" re-renders tagged + sends
            bookingReference={prefill.bookingReference}
          />
        )}
      </div>
    </div>
  );
}
