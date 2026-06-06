"use client";
import { Plus } from "lucide-react";
import SkuPicker from "./SkuPicker";
import { computeTotals } from "@/features/document-generation/lib/quote";
import type { DocFormState, LineItemRow } from "@/features/document-generation/lib/payload-types";

function newRowId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

interface Props {
  state: DocFormState;
  bookingReference: number | null;
  onChange: (patch: Partial<DocFormState>) => void;
}

export default function QuoteSection({ state, bookingReference, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";
  const totals = computeTotals(state.docType, state.lineItems, state.feePct);
  const setRows = (rows: LineItemRow[]) => onChange({ lineItems: rows });

  const addCustom = () => {
    setRows([...state.lineItems, { id: newRowId("custom"), sku: null, service: "", description: "", qty: 1, unit: isBoces ? "hrs" : "flat", listRate: 0, discountPct: 0 }]);
  };
  const mismatch = bookingReference != null && Math.abs(bookingReference - totals.orderTotal) > 1;

  return (
    <div className="space-y-2">
      {isBoces && (
        <div className="flex flex-wrap gap-2">
          <input aria-label="Quote number" placeholder="Quote number" value={state.quoteNumber}
            onChange={(e) => onChange({ quoteNumber: e.target.value })}
            className="flex-1 rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
          <input aria-label="Fee percent" type="number" step="0.1" value={state.feePct}
            onChange={(e) => onChange({ feePct: Number(e.target.value) })}
            className="w-28 rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
        </div>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <SkuPicker docType={state.docType} onPick={(r) => setRows([...state.lineItems, r])} />
        <button type="button" onClick={addCustom} className="flex items-center gap-1 rounded-lg bg-[#EFEDF5] px-2 py-1 text-sm whitespace-nowrap">
          <Plus size={14} /> Custom row
        </button>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-[#E2DEEC] text-xs uppercase tracking-wide text-[#6E6390]">
              <th className="text-left font-semibold whitespace-nowrap">Service</th>
              <th className="text-right font-semibold whitespace-nowrap">Qty / Unit</th>
              <th className="text-right font-semibold whitespace-nowrap">List rate</th>
              <th className="text-right font-semibold whitespace-nowrap">Total</th>
            </tr>
          </thead>
          <tbody>
            {totals.lines.map((l) => (
              <tr key={l.id} className="border-t border-[#E2DEEC]">
                <td className="whitespace-nowrap">{l.service || <span className="text-[#6E6390]">(custom)</span>}</td>
                <td className="text-right whitespace-nowrap">{l.qty} {l.unit}</td>
                <td className="text-right whitespace-nowrap">${l.listRate}</td>
                <td className="text-right whitespace-nowrap">{usd(l.total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`rounded-lg p-2 text-sm ${mismatch ? "bg-[#fffaf1] border border-[#ffd98d]" : "bg-[#F7F5FA]"}`}>
        <span className="font-semibold whitespace-nowrap">Order total: {usd(totals.orderTotal)}</span>
        {bookingReference != null && (
          <span className="ml-2 whitespace-nowrap">· Deal booking: {usd(bookingReference)}
            {mismatch && <span className="ml-1 text-[#403770]">⚠ doesn&apos;t match — intentional?</span>}
          </span>
        )}
      </div>
    </div>
  );
}
