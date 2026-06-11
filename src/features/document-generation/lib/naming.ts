/**
 * SP6 file-naming convention for doc-gen outputs (see
 * Docs/superpowers/specs/2026-06-11-sea-monkey-sp6-naming-slack-design.md).
 * Apps Script mirrors these in Utils.gs (shortSchoolYear / isoToday) —
 * cross-language twins, keep in sync.
 */

/** "2026 - 2027" → "SY26-27"; null when the input lacks two 4-digit years. */
export function formatSchoolYearShort(schoolYear: string | null | undefined): string | null {
  if (!schoolYear) return null;
  const m = /(\d{4})\s*[-–]\s*(\d{4})/.exec(schoolYear);
  return m ? `SY${m[1].slice(2)}-${m[2].slice(2)}` : null;
}

/** Local-date YYYY-MM-DD (Drive-name safe — no slashes). */
export function isoDate(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${d.getFullYear()}-${mm}-${dd}`;
}

/** Executed-PDF name: "SY26-27 — <company> — Contract — signed <ISO> (<sigid8>).pdf".
 *  Missing school year / company segments are omitted, never left dangling. */
export function buildExecutedPdfName(opts: {
  companyName: string;
  schoolYear: string | null;
  signatureRequestId: string;
  date: Date;
}): string {
  const sy = formatSchoolYearShort(opts.schoolYear);
  const segments = [
    ...(sy ? [sy] : []),
    ...(opts.companyName ? [opts.companyName] : []),
    "Contract",
    `signed ${isoDate(opts.date)} (${opts.signatureRequestId.slice(0, 8)})`,
  ];
  return `${segments.join(" — ")}.pdf`;
}
