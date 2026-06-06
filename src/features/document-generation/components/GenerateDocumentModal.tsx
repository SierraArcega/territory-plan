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

interface Props {
  prefill: PrefillResult;
  onClose: () => void;
  renderClient?: RenderClient;
}

function seedState(p: PrefillResult): DocFormState {
  const base = emptyFormState(p.docType, p.districtLeaId);
  return { ...base, startDate: p.startDate, endDate: p.endDate, payTerms: p.payTerms, minAmt: p.minAmt, maxAmt: p.maxAmt, bocesName: p.companyName };
}

export default function GenerateDocumentModal({ prefill, onClose, renderClient = stubRenderClient }: Props) {
  const [state, setState] = useState<DocFormState>(() => seedState(prefill));
  const [result, setResult] = useState<RenderResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function render(tags: boolean): Promise<RenderResult> {
    setBusy(true);
    try {
      const res = await renderClient(assemblePayload(state), { tags });
      setResult(res);
      return res;
    } finally {
      setBusy(false);
    }
  }

  const orderTotal = computeTotals(state.docType, state.lineItems, state.feePct).orderTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div role="dialog" aria-modal="true" aria-label="Generate document"
        className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {result ? (
          <ReviewStage
            result={result}
            orderTotal={orderTotal}
            onSend={() => { /* delivery sub-project: Dropbox Sign */ }}
            onManual={async () => { if (busy) return; const r = await render(false); window.open(r.docUrl, "_blank"); }}
            onBack={() => setResult(null)}
          />
        ) : (
          <DocumentPayloadForm
            value={state}
            onChange={setState}
            onRender={() => { if (!busy) void render(true); }}
            bookingReference={prefill.bookingReference}
          />
        )}
      </div>
    </div>
  );
}
