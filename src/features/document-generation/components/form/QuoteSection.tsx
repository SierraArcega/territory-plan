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

      <div className="space-y-2">
        {totals.lines.map((l) => (
          <div key={l.id} className="rounded-lg border border-[#E2DEEC] p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                {l.sku === null ? (
                  <input aria-label="Service name" placeholder="Custom service name" value={l.service}
                    onChange={(e) => updateRow(l.id, { service: e.target.value })}
                    className="w-full rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
                ) : (
                  <span className="text-sm font-medium text-[#403770]">{l.service}</span>
                )}
              </div>
              <div className="flex items-center gap-2 whitespace-nowrap">
                <span className="text-sm font-semibold">{usd(l.total)}</span>
                <button type="button" aria-label="Remove line item" onClick={() => removeRow(l.id)}
                  className="text-[#6E6390] hover:text-[#F37167]"><X size={14} /></button>
              </div>
            </div>
            <div className="mt-2 flex flex-wrap items-end gap-3">
              <label className="flex flex-col text-xs uppercase tracking-wide text-[#6E6390]">
                Count
                <input aria-label="Count" type="number" min="1" value={l.count ?? 1}
                  onChange={(e) => updateRow(l.id, { count: num(e.target.value) })}
                  className="mt-0.5 w-16 rounded border border-[#C2BBD4] px-2 py-1 text-sm text-[#403770]" />
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-[#6E6390]">
                Qty
                <input aria-label="Quantity" type="number" min="0" value={l.qty}
                  onChange={(e) => updateRow(l.id, { qty: num(e.target.value) })}
                  className="mt-0.5 w-20 rounded border border-[#C2BBD4] px-2 py-1 text-sm text-[#403770]" />
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-[#6E6390]">
                Unit
                <select aria-label="Unit" value={l.unit ?? "Day"}
                  onChange={(e) => updateRow(l.id, { unit: e.target.value })}
                  className="mt-0.5 rounded border border-[#C2BBD4] px-2 py-1 text-sm text-[#403770]">
                  {LINE_UNITS.map((u) => <option key={u} value={u}>{u}</option>)}
                </select>
              </label>
              <label className="flex flex-col text-xs uppercase tracking-wide text-[#6E6390]">
                List rate
                {l.sku === null ? (
                  <input aria-label="Rate" type="number" min="0" step="0.01" value={l.listRate}
                    onChange={(e) => updateRow(l.id, { listRate: num(e.target.value) })}
                    className="mt-0.5 w-24 rounded border border-[#C2BBD4] px-2 py-1 text-sm text-[#403770]" />
                ) : (
                  <span className="mt-0.5 py-1 text-sm text-[#403770]">${l.listRate}</span>
                )}
              </label>
              {!isBoces && (
                <label className="flex flex-col text-xs uppercase tracking-wide text-[#6E6390]">
                  Disc %
                  <input aria-label="Discount %" type="number" min="0" max="100" value={l.discountPct}
                    onChange={(e) => updateRow(l.id, { discountPct: num(e.target.value) })}
                    className="mt-0.5 w-16 rounded border border-[#C2BBD4] px-2 py-1 text-sm text-[#403770]" />
                </label>
              )}
            </div>
          </div>
        ))}
        {totals.lines.length === 0 && (
          <p className="text-sm text-[#6E6390]">No line items yet — search the pricebook or add a custom row above.</p>
        )}
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
