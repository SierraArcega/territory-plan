"use client";
import { useState } from "react";
import type { DocFormState, PaymentType } from "@/features/document-generation/lib/payload-types";

interface Props { state: DocFormState; onChange: (patch: Partial<DocFormState>) => void; }

const TYPES: { value: PaymentType; label: string }[] = [
  { value: "A", label: "A — Standard" },
  { value: "B", label: "B — Customized" },
  { value: "C", label: "C — BOCES Standardized" },
];

export default function PaymentSection({ state, onChange }: Props) {
  // "At time of signing" = blank invoice date. The date picker shows when the rep
  // opts in OR when a date already exists in state (e.g. set by prefill) — derived
  // from state so the checkbox can't drift out of sync with state.invoiceDate.
  const [wantsDate, setWantsDate] = useState(false);
  const showInvoiceDate = wantsDate || state.invoiceDate.trim() !== "";
  return (
    <div className="space-y-2 text-sm">
      <select aria-label="Payment type" value={state.paymentType} onChange={(e) => onChange({ paymentType: e.target.value as PaymentType })}
        className="rounded border border-[#C2BBD4] px-2 py-1">
        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <input placeholder="Payment terms (e.g. Net 30)" value={state.payTerms}
        onChange={(e) => onChange({ payTerms: e.target.value })}
        className="w-full rounded border border-[#C2BBD4] px-2 py-1" />
      <div className="space-y-1">
        <div className="text-xs uppercase tracking-wide text-[#6E6390]">Invoice date</div>
        <label className="flex items-center gap-2 whitespace-nowrap">
          <input type="checkbox" checked={!showInvoiceDate}
            onChange={(e) => {
              if (e.target.checked) { setWantsDate(false); onChange({ invoiceDate: "" }); }
              else { setWantsDate(true); }
            }} />
          Invoice at time of signing
        </label>
        {showInvoiceDate && (
          <div className="flex items-center gap-2">
            <input aria-label="Invoice date" type="date" value={state.invoiceDate}
              onChange={(e) => onChange({ invoiceDate: e.target.value })}
              className="h-8 rounded border border-[#C2BBD4] px-2 py-1 text-[#403770]" />
            <button type="button" onClick={() => { onChange({ invoiceDate: "" }); setWantsDate(false); }}
              className="text-sm text-[#6E6390] hover:text-[#F37167]">Clear</button>
          </div>
        )}
      </div>
      <label className="flex items-center gap-2 whitespace-nowrap">
        <input type="checkbox" checked={state.poRequired} onChange={(e) => onChange({ poRequired: e.target.checked })} />
        PO required
      </label>

      {state.paymentType === "B" && (
        <>
          <input placeholder="Additional terms" value={state.addTerms}
            onChange={(e) => onChange({ addTerms: e.target.value })}
            className="w-full rounded border border-[#C2BBD4] px-2 py-1" />
          <input placeholder="Implementation detail" value={state.impDetail}
            onChange={(e) => onChange({ impDetail: e.target.value })}
            className="w-full rounded border border-[#C2BBD4] px-2 py-1" />
        </>
      )}
      {state.paymentType === "C" && (
        <>
          <input placeholder="PO number" value={state.poNumber}
            onChange={(e) => onChange({ poNumber: e.target.value })}
            className="w-full rounded border border-[#C2BBD4] px-2 py-1" />
          <input placeholder="BOCES name" value={state.bocesName}
            onChange={(e) => onChange({ bocesName: e.target.value })}
            className="w-full rounded border border-[#C2BBD4] px-2 py-1" />
          <input placeholder="Pre/post (pre|post)" value={state.payPrePost}
            onChange={(e) => onChange({ payPrePost: e.target.value })}
            className="w-full rounded border border-[#C2BBD4] px-2 py-1" />
        </>
      )}
    </div>
  );
}
