import type { DocType, LineItemRow, ComputedLine, QuoteTotals } from "./payload-types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(
  docType: DocType,
  rows: LineItemRow[],
  feePct: number,
): QuoteTotals {
  const lines: ComputedLine[] = rows.map((r) => {
    const netRate =
      docType === "contract" ? r.listRate * (1 - r.discountPct / 100) : r.listRate;
    const total = round2(netRate * r.qty);
    return { ...r, netRate: round2(netRate), total };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const fee = docType === "boces_quote" ? round2(subtotal * (feePct / 100)) : 0;
  const orderTotal = round2(subtotal + fee);
  return { lines, subtotal, fee, orderTotal };
}
