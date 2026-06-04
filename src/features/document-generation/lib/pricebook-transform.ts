// Pure, dependency-free helpers that turn the Fullmind pricebook CSV exports
// (PandaDoc) into the committed dataset the document-generator UI reads.
//
// No Node or browser APIs here so both the build script
// (scripts/document-generation/pricebook/build-pricebook.ts) and Vitest can
// import these. The build script owns all filesystem I/O.

export type FiscalYear = "FY26" | "FY27";

export interface PricebookProduct {
  sku: string;
  name: string;
  category: string;
  /** Parsed from the category string ("FY27 BOCES Pricing" -> "FY27"). */
  fiscalYear: FiscalYear | null;
  /** Parsed `Price`. 0 is a legitimate "rep enters the price" placeholder. */
  listRate: number;
  /** `Description` with HTML tags/entities stripped. */
  description: string;
  /** Best-effort display unit; non-authoritative (see deriveUnit). */
  unit: string | null;
  // Raw signal columns retained so unit logic can be refined later without a
  // re-import. `Cost` is intentionally NOT carried — it is internal margin data.
  pricePerHour: number | null;
  chargedPer: string | null;
  fullYear190: number | null;
  fullYear180: number | null;
}

export interface VolumeTier {
  minQty: number;
  price: number;
}

export interface VolumeProduct {
  sku: string;
  name: string;
  category: string;
  fiscalYear: FiscalYear | null;
  description: string;
  /** Quantity tiers, ascending by minQty. */
  tiers: VolumeTier[];
}

export interface Pricebook {
  source: string;
  flat: PricebookProduct[];
  volume: VolumeProduct[];
}

/** RFC4180-ish CSV parse: handles quoted fields, escaped quotes, and commas
 *  inside fields (the HTML descriptions are quoted). Returns header-keyed rows. */
export function parseCsv(text: string): Record<string, string>[] {
  const rows = parseRows(text);
  if (rows.length === 0) return [];
  const header = rows[0];
  return rows
    .slice(1)
    .filter((cols) => !(cols.length === 1 && cols[0] === ""))
    .map((cols) => {
      const rec: Record<string, string> = {};
      header.forEach((h, i) => {
        rec[h] = cols[i] ?? "";
      });
      return rec;
    });
}

function parseRows(text: string): string[][] {
  const rows: string[][] = [];
  let field = "";
  let row: string[] = [];
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inQuotes) {
      if (c === '"') {
        if (text[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += c;
      }
    } else if (c === '"') {
      inQuotes = true;
    } else if (c === ",") {
      row.push(field);
      field = "";
    } else if (c === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else if (c !== "\r") {
      field += c;
    }
  }
  if (field !== "" || row.length > 0) {
    row.push(field);
    rows.push(row);
  }
  return rows;
}

export function stripHtml(s: string): string {
  return (s || "")
    .replace(/<br\s*\/?>/gi, " ")
    .replace(/<\/(p|div|li)>/gi, " ")
    .replace(/<[^>]+>/g, "")
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&gt;/gi, ">")
    .replace(/&lt;/gi, "<")
    .replace(/&#39;|&apos;/gi, "'")
    .replace(/&quot;/gi, '"')
    .replace(/\s+/g, " ")
    .trim();
}

export function deriveFiscalYear(category: string): FiscalYear | null {
  if (/FY27/i.test(category)) return "FY27";
  if (/FY26/i.test(category)) return "FY26";
  return null;
}

/** Parse a money/number cell, tolerating "$", commas, and surrounding space.
 *  Returns null for blank/unparseable. */
export function parseNum(s: string): number | null {
  const t = (s || "").replace(/[$,\s]/g, "");
  if (t === "") return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** Best-effort display unit. The export has no single unit column, so this is a
 *  heuristic over the signal columns and is treated as non-authoritative by the
 *  UI (the rep can override). */
export function deriveUnit(row: Record<string, string>): string | null {
  const chargedPer = (row["Charged Per"] || "").trim();
  if (chargedPer) return chargedPer; // e.g. "Session"
  if ((row["Price per Hour"] || "").trim()) return "Hour";
  if (
    (row["Full Year (190 Days)"] || "").trim() ||
    (row["Full Year (180 Days)"] || "").trim()
  ) {
    return "Year";
  }
  return null;
}

/** "Allocation" is the rep's custom/ad-hoc line item — it carries a blank
 *  category and a $0 placeholder price, and is handled by the form's
 *  "Add custom line item" button rather than the SKU picker. It is the only
 *  blank-category row in the export. */
export function isExcluded(row: Record<string, string>): boolean {
  const name = (row["Name"] || "").trim().toLowerCase();
  const category = (row["Category"] || "").trim();
  return name === "allocation" || category === "";
}

export function toProduct(row: Record<string, string>): PricebookProduct {
  return {
    sku: (row["SKU"] || "").trim(),
    name: (row["Name"] || "").trim(),
    category: (row["Category"] || "").trim(),
    fiscalYear: deriveFiscalYear(row["Category"] || ""),
    listRate: parseNum(row["Price"]) ?? 0,
    description: stripHtml(row["Description"] || ""),
    unit: deriveUnit(row),
    pricePerHour: parseNum(row["Price per Hour"] || ""),
    chargedPer: (row["Charged Per"] || "").trim() || null,
    fullYear190: parseNum(row["Full Year (190 Days)"] || ""),
    fullYear180: parseNum(row["Full Year (180 Days)"] || ""),
  };
}

export function buildFlatProducts(
  rows: Record<string, string>[],
): PricebookProduct[] {
  return rows.filter((r) => !isExcluded(r)).map(toProduct);
}

export function buildVolumeProducts(
  rows: Record<string, string>[],
): VolumeProduct[] {
  const bySku = new Map<string, VolumeProduct>();
  for (const r of rows) {
    const sku = (r["SKU"] || "").trim();
    if (!sku) continue;
    let vp = bySku.get(sku);
    if (!vp) {
      vp = {
        sku,
        name: (r["Name"] || "").trim(),
        category: (r["Category"] || "").trim(),
        fiscalYear: deriveFiscalYear(r["Category"] || ""),
        description: stripHtml(r["Description"] || ""),
        tiers: [],
      };
      bySku.set(sku, vp);
    }
    const minQty = parseNum(r["Tier Quantity Min"]);
    const price = parseNum(r["Price"]);
    if (minQty != null && price != null) vp.tiers.push({ minQty, price });
  }
  for (const vp of bySku.values()) vp.tiers.sort((a, b) => a.minQty - b.minQty);
  return [...bySku.values()];
}
