"use client";
import { useMemo, useState } from "react";
import { getProducts, getBocesProducts, DEFAULT_FISCAL_YEAR } from "@/features/document-generation/lib/pricebook";
import type { DocType, LineItemRow } from "@/features/document-generation/lib/payload-types";

function newRowId(prefix: string): string {
  return `${prefix}-${Math.random().toString(36).slice(2, 10)}`;
}

interface Props { docType: DocType; onPick: (row: LineItemRow) => void; }

export default function SkuPicker({ docType, onPick }: Props) {
  const [q, setQ] = useState("");
  const products = useMemo(
    () => (docType === "boces_quote" ? getBocesProducts() : getProducts({ fiscalYear: DEFAULT_FISCAL_YEAR })),
    [docType],
  );
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-1">
      <input aria-label="Search pricebook" placeholder="Search pricebook…" value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full rounded border border-[#C2BBD4] px-2 py-1 text-sm" />
      <div className="max-h-40 overflow-y-auto">
        {filtered.slice(0, 50).map((p) => (
          <button key={p.sku} type="button"
            onClick={() => onPick({ id: newRowId("row"), sku: p.sku, service: p.name, description: p.description, qty: 1, unit: p.unit, listRate: p.listRate, discountPct: 0 })}
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-[#EFEDF5] whitespace-nowrap">
            {p.name} <span className="text-[#403770]">${p.listRate}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
