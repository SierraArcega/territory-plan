export function formatRevenue(n: number): string {
  return "$" + n.toLocaleString("en-US", { maximumFractionDigits: 0 });
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2);
}

/**
 * Formats a currency value into a short, image-friendly string.
 * Examples: 0 → "$0", 450 → "$450", 12300 → "$12.3K", 2350000 → "$2.4M".
 * One-decimal precision for K/M/B; whole dollars below 1000.
 */
export function formatCurrencyShort(value: number): string {
  const sign = value < 0 ? "-" : "";
  const abs = Math.abs(value);
  if (abs < 1_000) return `${sign}$${Math.round(abs)}`;
  if (abs < 1_000_000) {
    const rounded = Math.round(abs / 100) / 10;
    if (rounded >= 1_000) return `${sign}$1.0M`;
    return `${sign}$${rounded.toFixed(1)}K`;
  }
  if (abs < 1_000_000_000) return `${sign}$${(abs / 1_000_000).toFixed(1)}M`;
  return `${sign}$${(abs / 1_000_000_000).toFixed(1)}B`;
}
