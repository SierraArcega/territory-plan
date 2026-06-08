import type { DocType, LineItemRow, ComputedLine, QuoteTotals, OrderAdjustment } from "./payload-types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(
  docType: DocType,
  rows: LineItemRow[],
  feePct: number,
  adjustments: OrderAdjustment[] = [],
): QuoteTotals {
  const lines: ComputedLine[] = rows.map((r) => {
    const count = r.count ?? 1;
    const netRate = docType === "contract" ? round2(r.listRate * (1 - r.discountPct / 100)) : r.listRate;
    const total = round2(count * r.qty * netRate);
    return { ...r, netRate, total };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const grossSubtotal = round2(rows.reduce((s, r) => s + (r.count ?? 1) * r.qty * r.listRate, 0));
  const perLineSavings = round2(grossSubtotal - subtotal);

  const computedAdj = adjustments.map((a) => ({
    ...a,
    amount: a.mode === "percent" ? round2(subtotal * (a.value / 100)) : round2(a.value),
  }));
  const sumType = (t: string) => round2(computedAdj.filter((a) => a.type === t).reduce((s, a) => s + a.amount, 0));
  const discountTotal = sumType("discount");
  const addTotal = round2(sumType("fee") + sumType("tax"));

  const bocesFee = docType === "boces_quote" ? round2(subtotal * (feePct / 100)) : 0;
  const orderTotal = round2(subtotal - discountTotal + addTotal + bocesFee);
  const savings = round2(perLineSavings + discountTotal);

  const unitsFor = (u: string) =>
    round2(rows.filter((r) => r.unit === u).reduce((s, r) => s + (r.count ?? 1) * r.qty, 0));

  return {
    lines, subtotal, grossSubtotal, fee: bocesFee, adjustments: computedAdj,
    savings, orderTotal, billableDays: unitsFor("Day"), billableHours: unitsFor("Hour"),
  };
}
