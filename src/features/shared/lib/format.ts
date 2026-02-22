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
