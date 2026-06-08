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
    const count = r.count ?? 1;
    const netRate =
      docType === "contract" ? round2(r.listRate * (1 - r.discountPct / 100)) : r.listRate;
    const total = round2(count * r.qty * netRate);
    return { ...r, netRate, total };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const fee = docType === "boces_quote" ? round2(subtotal * (feePct / 100)) : 0;
  const orderTotal = round2(subtotal + fee);
  const unitsFor = (u: string) =>
    round2(rows.filter((r) => r.unit === u).reduce((s, r) => s + (r.count ?? 1) * r.qty, 0));
  return { lines, subtotal, fee, orderTotal, billableDays: unitsFor("Day"), billableHours: unitsFor("Hour") };
}
