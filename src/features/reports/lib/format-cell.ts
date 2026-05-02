import { TABLE_REGISTRY, type DataFormat } from "@/lib/district-column-metadata";

const CURRENCY_HINT = /(amount|budget|revenue|bookings|take|price|cost|value|pipeline|purchase|invoiced|credited|spend)/i;
const PERCENT_HINT = /(_pct|_rate|_ratio|percent)/i;
const ISO_DATE = /^\d{4}-\d{2}-\d{2}(T\d{2}:\d{2}:\d{2}(\.\d+)?(Z|[+-]\d{2}:?\d{2})?)?$/;

const formatCache = new Map<string, DataFormat | null>();

function lookupFormat(columnName: string): DataFormat | null {
  if (formatCache.has(columnName)) return formatCache.get(columnName) ?? null;
  for (const tbl of Object.values(TABLE_REGISTRY)) {
    const col = tbl.columns.find((c) => c.column === columnName);
    if (col) {
      formatCache.set(columnName, col.format);
      return col.format;
    }
  }
  formatCache.set(columnName, null);
  return null;
}

/** Best-effort format inference for a column. Uses TABLE_REGISTRY metadata first, then column-name + value heuristics. */
export function inferFormat(columnName: string, value: unknown): DataFormat | "text" {
  const registered = lookupFormat(columnName);
  if (registered) return registered;
  if (typeof value === "boolean") return "boolean";
  if (typeof value === "string" && ISO_DATE.test(value)) return "date";
  if (value instanceof Date) return "date";
  if (typeof value === "number" || (typeof value === "string" && value !== "" && !isNaN(Number(value)))) {
    if (CURRENCY_HINT.test(columnName)) return "currency";
    if (PERCENT_HINT.test(columnName)) return "percentage";
    return Number.isInteger(Number(value)) ? "integer" : "decimal";
  }
  return "text";
}

const currencyFmt = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD" });
const percentFmt = new Intl.NumberFormat("en-US", { style: "percent", maximumFractionDigits: 1 });
const integerFmt = new Intl.NumberFormat("en-US");
const decimalFmt = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

function toDate(v: unknown): Date | null {
  if (v instanceof Date) return v;
  if (typeof v === "string") {
    const d = new Date(v);
    if (!isNaN(d.getTime())) return d;
  }
  return null;
}

function toNumber(v: unknown): number | null {
  if (typeof v === "number") return v;
  if (typeof v === "string" && v !== "" && !isNaN(Number(v))) return Number(v);
  return null;
}

/** Format a single cell value for display. Empty/null → em-dash. */
export function formatCell(columnName: string, value: unknown): string {
  if (value == null || value === "") return "—";

  const format = inferFormat(columnName, value);

  switch (format) {
    case "currency": {
      const n = toNumber(value);
      return n == null ? String(value) : currencyFmt.format(n);
    }
    case "percentage": {
      const n = toNumber(value);
      // Heuristic: pg may return either fractional (0.27) or already-scaled (27.0). Anything > 1 is treated as already a percentage.
      if (n == null) return String(value);
      return n > 1 ? `${decimalFmt.format(n)}%` : percentFmt.format(n);
    }
    case "ratio": {
      const n = toNumber(value);
      return n == null ? String(value) : decimalFmt.format(n);
    }
    case "date": {
      // Date-only strings (YYYY-MM-DD) — render directly to avoid timezone drift.
      if (typeof value === "string") {
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
        if (m) return `${m[2]}/${m[3]}/${m[1]}`;
      }
      const d = toDate(value);
      return d ? d.toLocaleDateString("en-US", { year: "numeric", month: "2-digit", day: "2-digit" }) : String(value);
    }
    case "year": {
      const n = toNumber(value);
      return n == null ? String(value) : String(Math.trunc(n));
    }
    case "integer": {
      const n = toNumber(value);
      return n == null ? String(value) : integerFmt.format(Math.trunc(n));
    }
    case "decimal": {
      const n = toNumber(value);
      return n == null ? String(value) : decimalFmt.format(n);
    }
    case "boolean":
      return value === true || value === "t" || value === "true" ? "Yes" : "No";
    default:
      if (typeof value === "object") return JSON.stringify(value);
      return String(value);
  }
}

/** "minimum_purchase_amount" → "Minimum Purchase Amount". Mixed-case identifiers (camelCase) pass through unchanged. */
export function humanizeColumnName(name: string): string {
  if (!name.includes("_") && !name.includes(" ")) {
    // Single token. Title-case all-lowercase ("name" → "Name"); leave mixed-case
    // ("districtName") and all-uppercase ("FOO") alone.
    if (/^[a-z]+$/.test(name)) return name.charAt(0).toUpperCase() + name.slice(1);
    return name;
  }
  return name
    .split(/[_\s]+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(" ");
}
