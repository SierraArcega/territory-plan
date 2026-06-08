import { getCurrentFY } from "@/lib/fiscal-year";
import type { FiscalYear } from "@/features/document-generation/lib/pricebook";

// Pricebook ships FY26 + FY27 only; anything outside that resolves to null so
// the caller can fall back to the default.
const AVAILABLE: FiscalYear[] = ["FY26", "FY27"];

function parseDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(t); // ISO YYYY-MM-DD
  if (m) return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]));
  m = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t); // US MM/DD/YYYY
  if (m) return new Date(Number(m[3]), Number(m[1]) - 1, Number(m[2]));
  return null;
}

/**
 * Derive the pricebook fiscal year from a contract date string, reusing the
 * canonical Fullmind FY rule (`getCurrentFY`: starts July 1, named by end year).
 * Returns null when the date is unparseable or falls outside the available books.
 */
export function fiscalYearFromDate(dateStr: string): FiscalYear | null {
  const d = parseDate(dateStr);
  if (!d || Number.isNaN(d.getTime())) return null;
  const fy = `FY${String(getCurrentFY(d)).slice(-2)}` as FiscalYear;
  return AVAILABLE.includes(fy) ? fy : null;
}

export type FiscalYearSelection = "auto" | FiscalYear;

/**
 * Resolve the effective pricebook year. "auto" derives from the contract start
 * date, then the end date, then falls back to FY27.
 */
export function resolveFiscalYear(
  selection: FiscalYearSelection,
  startDate: string,
  endDate: string,
): FiscalYear {
  if (selection !== "auto") return selection;
  return fiscalYearFromDate(startDate) ?? fiscalYearFromDate(endDate) ?? "FY27";
}
