"use client";
import { useMemo, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { getProducts, getBocesProducts } from "@/features/document-generation/lib/pricebook";
import type { FiscalYear } from "@/features/document-generation/lib/pricebook";
import type { DocType, LineItemRow } from "@/features/document-generation/lib/payload-types";
import { canonicalUnit } from "@/features/document-generation/lib/units";
import { useOutsideClick } from "@/features/shared/lib/use-outside-click";
import { newRowId } from "@/features/document-generation/lib/ids";

interface Props { docType: DocType; fiscalYear: FiscalYear; onPick: (row: LineItemRow) => void; }

export default function SkuPicker({ docType, fiscalYear, onPick }: Props) {
  const [q, setQ] = useState("");
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  const products = useMemo(
    () => (docType === "boces_quote" ? getBocesProducts(fiscalYear) : getProducts({ fiscalYear })),
    [docType, fiscalYear],
  );
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  useOutsideClick(ref, () => setOpen(false), open);

  function select(p: (typeof products)[number]) {
    onPick({ id: newRowId("row"), sku: p.sku, service: p.name, description: p.description, count: 1, qty: 1, unit: canonicalUnit(p.unit), listRate: p.listRate, discountPct: 0 });
    setQ("");
    setOpen(false);
  }

  return (
    <div ref={ref} className="relative w-full max-w-sm">
      <div className="flex items-center rounded border border-[#C2BBD4]">
        <input aria-label="Search or select product" placeholder="Search or select a product…"
          value={q}
          onChange={(e) => { setQ(e.target.value); setOpen(true); }}
          onFocus={() => setOpen(true)}
          onKeyDown={(e) => { if (e.key === "Escape") setOpen(false); }}
          className="w-full rounded-l px-2 py-1 text-sm outline-none" />
        <button type="button" aria-label="Browse products" onClick={() => setOpen((o) => !o)}
          className="px-2 py-1 text-[#6E6390]">
          <ChevronDown size={16} />
        </button>
      </div>
      {open && (
        <div className="absolute z-10 mt-1 max-h-48 w-full overflow-y-auto rounded border border-[#C2BBD4] bg-white shadow-lg">
          {filtered.length === 0 ? (
            <div className="px-2 py-1 text-sm text-[#6E6390]">No matches</div>
          ) : (
            filtered.slice(0, 50).map((p) => (
              <button key={p.sku} type="button" onMouseDown={(e) => e.preventDefault()} onClick={() => select(p)}
                className="block w-full px-2 py-1 text-left text-sm hover:bg-[#EFEDF5] whitespace-nowrap">
                {p.name} <span className="text-[#403770]">${p.listRate}</span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}
