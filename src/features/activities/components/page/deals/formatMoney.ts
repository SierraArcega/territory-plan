// Compact money formatting for chips and rollups.
// >= 1M => "$X.XM" (1 decimal)
// >= 1K => "$XK"   (rounded)
// else  => "$X"
// Null/undefined defensively => "$0"
export function formatMoney(n: number | null | undefined): string {
  const v = typeof n === "number" && Number.isFinite(n) ? n : 0;
  const abs = Math.abs(v);
  if (abs >= 1_000_000) return "$" + (v / 1_000_000).toFixed(1) + "M";
  if (abs >= 1_000) return "$" + Math.round(v / 1_000) + "K";
  return "$" + v;
}
