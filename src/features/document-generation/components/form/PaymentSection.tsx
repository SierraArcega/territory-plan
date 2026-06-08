"use client";
import type { DocFormState, PaymentType } from "@/features/document-generation/lib/payload-types";

interface Props { state: DocFormState; onChange: (patch: Partial<DocFormState>) => void; }

const TYPES: { value: PaymentType; label: string }[] = [
  { value: "A", label: "A — Standard" },
  { value: "B", label: "B — Customized" },
  { value: "C", label: "C — BOCES Standardized" },
];

export default function PaymentSection({ state, onChange }: Props) {
  return (
    <div className="space-y-2 text-sm">
      <select aria-label="Payment type" value={state.paymentType} onChange={(e) => onChange({ paymentType: e.target.value as PaymentType })}
        className="rounded border border-[#C2BBD4] px-2 py-1">
        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <input placeholder="Payment terms (e.g. Net 30)" value={state.payTerms}
        onChange={(e) => onChange({ payTerms: e.target.value })}
        className="w-full rounded border border-[#C2BBD4] px-2 py-1" />
      <label className="flex flex-col text-xs uppercase tracking-wide text-[#6E6390]">
        Invoice date <span className="normal-case text-[#6E6390]">(leave blank for &ldquo;time of signing&rdquo;)</span>
        <input aria-label="Invoice date" type="date" value={state.invoiceDate}
          onChange={(e) => onChange({ invoiceDate: e.target.value })}
          className="mt-0.5 w-full rounded border border-[#C2BBD4] px-2 py-1 text-[#403770]" />
      </label>
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
