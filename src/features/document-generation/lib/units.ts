// src/features/document-generation/lib/units.ts
export const LINE_UNITS = ["Hour", "Day", "Session", "Year", "Flat"] as const;
export type LineUnit = (typeof LINE_UNITS)[number];

export function canonicalUnit(raw: string | null): LineUnit {
  if (raw === null) return "Day";
  const s = raw.trim().toLowerCase();
  if (s === "hr" || s === "hrs" || s.includes("hour")) return "Hour";
  if (s.includes("day")) return "Day";
  if (s.includes("session")) return "Session";
  if (s.includes("year") || s === "yr") return "Year";
  return "Flat";
}
