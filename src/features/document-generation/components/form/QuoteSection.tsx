"use client";
import { Plus, X } from "lucide-react";
import SkuPicker from "./SkuPicker";
import { computeTotals } from "@/features/document-generation/lib/quote";
import { resolveFiscalYear } from "@/features/document-generation/lib/fiscal-year";
import type { FiscalYearSelection } from "@/features/document-generation/lib/fiscal-year";
import type { DocFormState, LineItemRow } from "@/features/document-generation/lib/payload-types";
import { LINE_UNITS } from "@/features/document-generation/lib/units";

function newRowId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;
const num = (v: string) => (v === "" ? 0 : Number(v));

const FY_OPTIONS: { value: FiscalYearSelection; label: string }[] = [
  { value: "auto", label: "Auto" },
  { value: "FY27", label: "FY27" },
  { value: "FY26", label: "FY26" },
];

interface Props {
  state: DocFormState;
  bookingReference: number | null;
  onChange: (patch: Partial<DocFormState>) => void;
}

export default function QuoteSection({ state, bookingReference, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";
  const totals = computeTotals(state.docType, state.lineItems, state.feePct);
  const effectiveFY = resolveFiscalYear(state.fiscalYear, state.startDate, state.endDate);

  const setRows = (rows: LineItemRow[]) => onChange({ lineItems: rows });
  const updateRow = (id: string, patch: Partial<LineItemRow>) =>
    setRows(state.lineItems.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  const removeRow = (id: string) => setRows(state.lineItems.filter((r) => r.id !== id));
  const addCustom = () =>
    setRows([...state.lineItems, { id: newRowId("custom"), sku: null, service: "", description: "", count: 1, qty: 1, unit: isBoces ? "Hour" : "Day", listRate: 0, discountPct: 0 }]);

  const mismatch = bookingReference != null && Math.abs(bookingReference - totals.orderTotal) > 1;

  return (
    <div className="space-y-2">
      {isBoces && (
        <div className="flex flex-wrap gap-2">
          <input aria-label="Quote number" placeholder="Quote number" value={state.quoteNumber}
            onChange={(e) => onChange({ quoteNumber: e.target.value })}
            className="flex-1 rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
          <input aria-label="Fee percent" type="number" step="0.1" value={state.feePct}
            onChange={(e) => onChange({ feePct: num(e.target.value) })}
            className="w-28 rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <SkuPicker docType={state.docType} fiscalYear={effectiveFY} onPick={(r) => setRows([...state.lineItems, r])} />
        <button type="button" onClick={addCustom} className="flex items-center gap-1 rounded-lg bg-[#EFEDF5] px-2 py-1 text-sm whitespace-nowrap">
          <Plus size={14} /> Custom row
        </button>
        <label className="flex items-center gap-1 text-xs text-[#6E6390] whitespace-nowrap">
          Pricebook
          <select aria-label="Pricebook fiscal year" value={state.fiscalYear}
            onChange={(e) => onChange({ fiscalYear: e.target.value as FiscalYearSelection })}
            className="rounded border border-[#C2BBD4] px-1 py-0.5 text-xs">
            {FY_OPTIONS.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
          </select>
          {state.fiscalYear === "auto" && <span>· {effectiveFY}</span>}
        </label>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm [&_td]:px-3 [&_td]:py-1.5 [&_th]:px-3 [&_th]:py-1.5">
          <thead>
            <tr className="border-b border-[#E2DEEC] text-xs uppercase tracking-wide text-[#6E6390]">
              <th className="text-left font-semibold whitespace-nowrap">Service</th>
              <th className="text-right font-semibold whitespace-nowrap">Count</th>
              <th className="text-right font-semibold whitespace-nowrap">Qty</th>
              <th className="text-right font-semibold whitespace-nowrap">Unit</th>
              <th className="text-right font-semibold whitespace-nowrap">List rate</th>
              {!isBoces && <th className="text-right font-semibold whitespace-nowrap">Disc %</th>}
              <th className="text-right font-semibold whitespace-nowrap">Total</th>
              <th aria-hidden="true"></th>
            </tr>
          </thead>
          <tbody>
            {totals.lines.map((l) => (
              <tr key={l.id} className="border-t border-[#E2DEEC]">
                <td className="whitespace-nowrap">
                  {l.sku === null ? (
                    <input aria-label="Service name" placeholder="Custom service" value={l.service}
                      onChange={(e) => updateRow(l.id, { service: e.target.value })}
                      className="w-full rounded border border-[#C2BBD4] px-1 py-0.5 text-sm" />
                  ) : (
                    l.service
                  )}
                </td>
                <td className="text-right">
                  <input aria-label="Count" type="number" min="1" value={l.count ?? 1}
                    onChange={(e) => updateRow(l.id, { count: num(e.target.value) })}
                    className="w-14 rounded border border-[#C2BBD4] px-1 py-0.5 text-right text-sm" />
                </td>
                <td className="text-right">
                  <input aria-label="Quantity" type="number" min="0" value={l.qty}
                    onChange={(e) => updateRow(l.id, { qty: num(e.target.value) })}
                    className="w-16 rounded border border-[#C2BBD4] px-1 py-0.5 text-right text-sm" />
                </td>
                <td className="text-right">
                  <select aria-label="Unit" value={l.unit ?? "Day"}
                    onChange={(e) => updateRow(l.id, { unit: e.target.value })}
                    className="rounded border border-[#C2BBD4] px-1 py-0.5 text-sm">
                    {LINE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                  </select>
                </td>
                <td className="text-right">
                  {l.sku === null ? (
                    <input aria-label="Rate" type="number" min="0" step="0.01" value={l.listRate}
                      onChange={(e) => updateRow(l.id, { listRate: num(e.target.value) })}
                      className="w-20 rounded border border-[#C2BBD4] px-1 py-0.5 text-right text-sm" />
                  ) : (
                    `$${l.listRate}`
                  )}
                </td>
                {!isBoces && (
                  <td className="text-right">
                    <input aria-label="Discount %" type="number" min="0" max="100" value={l.discountPct}
                      onChange={(e) => updateRow(l.id, { discountPct: num(e.target.value) })}
                      className="w-16 rounded border border-[#C2BBD4] px-1 py-0.5 text-right text-sm" />
                  </td>
                )}
                <td className="text-right whitespace-nowrap">{usd(l.total)}</td>
                <td className="text-right">
                  <button type="button" aria-label="Remove line item" onClick={() => removeRow(l.id)}
                    className="text-[#6E6390] hover:text-[#F37167]"><X size={14} /></button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className={`rounded-lg p-2 text-sm ${mismatch ? "bg-[#fffaf1] border border-[#ffd98d]" : "bg-[#F7F5FA]"}`}>
        <span className="font-semibold whitespace-nowrap">Order total: {usd(totals.orderTotal)}</span>
        {totals.billableDays > 0 && <span className="ml-2 whitespace-nowrap">· Billable days: {totals.billableDays.toLocaleString("en-US")}</span>}
        {totals.billableHours > 0 && <span className="ml-2 whitespace-nowrap">· Billable hours: {totals.billableHours.toLocaleString("en-US")}</span>}
        {bookingReference != null && (
          <span className="ml-2 whitespace-nowrap">· Deal booking: {usd(bookingReference)}
            {mismatch && <span className="ml-1 text-[#403770]">⚠ doesn&apos;t match — intentional?</span>}
          </span>
        )}
      </div>
    </div>
  );
}
