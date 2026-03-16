/**
 * Format a number as currency with optional compact mode.
 * compact: $1.2M, $450K  |  standard: $1,234,567
 */
export function formatCurrency(value: number | null | undefined, compact = false): string {
  if (value === null || value === undefined) return "-";
  if (compact && Math.abs(value) >= 1000000) {
    return `$${(value / 1000000).toLocaleString("en-US", { maximumFractionDigits: 1 })}M`;
  }
  if (compact && Math.abs(value) >= 1000) {
    return `$${(value / 1000).toLocaleString("en-US", { maximumFractionDigits: 0 })}K`;
  }
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

/**
 * Format a number with commas. e.g. 4832100 → "4,832,100"
 */
export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "-";
  return value.toLocaleString("en-US");
}

/**
 * Format a number as a percentage.
 * formatPercent(0.847) → "84.7%"
 * formatPercent(0.8471, 2) → "84.71%"
 */
export function formatPercent(
  value: number | null | undefined,
  decimals = 1,
): string {
  if (value === null || value === undefined) return "-";
  const pct = value * 100;
  // Use parseFloat to drop trailing zeros: "50.0" → "50"
  return `${parseFloat(pct.toFixed(decimals))}%`;
}

/**
 * Format activity scope as a readable string.
 * e.g. formatScope(3, ["CA", "TX"]) → "3 districts (CA, TX)"
 * Used by activity rows and tables to summarise linked geography.
 */
export function formatScope(districtCount: number, stateAbbrevs: string[]): string {
  if (districtCount === 0 && stateAbbrevs.length === 0) return "All districts";
  if (districtCount === 0) return stateAbbrevs.join(", ");
  const districtText = `${districtCount} district${districtCount !== 1 ? "s" : ""}`;
  if (stateAbbrevs.length > 0) return `${districtText} (${stateAbbrevs.join(", ")})`;
  return districtText;
}

/**
 * Format a number in compact form without currency symbol.
 * 14832 → "14.8K"   |   1200000 → "1.2M"   |   500 → "500"
 */
export function formatCompactNumber(
  value: number | null | undefined,
): string {
  if (value === null || value === undefined) return "-";
  if (Math.abs(value) >= 1_000_000) {
    return `${parseFloat((value / 1_000_000).toFixed(1))}M`;
  }
  if (Math.abs(value) >= 1_000) {
    return `${parseFloat((value / 1_000).toFixed(1))}K`;
  }
  return value.toLocaleString("en-US", { maximumFractionDigits: 0 });
}
