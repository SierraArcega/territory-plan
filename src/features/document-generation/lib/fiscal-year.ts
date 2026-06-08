import { getCurrentFY } from "@/lib/fiscal-year";
import { parseLocalDate } from "@/features/shared/lib/date-utils";
import type { FiscalYear } from "@/features/document-generation/lib/pricebook";

// Pricebook ships FY26 + FY27 only; anything outside that resolves to null so
// the caller can fall back to the default.
const AVAILABLE: FiscalYear[] = ["FY26", "FY27"];

function parseDate(s: string): Date | null {
  const t = s.trim();
  if (!t) return null;
  // US MM/DD/YYYY (parseLocalDate only understands ISO).
  const us = /^(\d{1,2})\/(\d{1,2})\/(\d{4})$/.exec(t);
  if (us) return new Date(Number(us[3]), Number(us[1]) - 1, Number(us[2]));
  // ISO (incl. with time, e.g. opportunity dates "2026-07-01T00:00:00.000Z")
  // via the shared local-midnight parser; invalid dates yield NaN → null.
  const d = parseLocalDate(t);
  return Number.isNaN(d.getTime()) ? null : d;
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
