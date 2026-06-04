// Typed access to the committed Fullmind pricebook dataset.
//
// The dataset is generated from the PandaDoc CSV exports by
// scripts/document-generation/pricebook/build-pricebook.ts. Do not hand-edit
// pricebook.json — re-run the generator (see that script's README).
//
// The document-generator UI uses these selectors; the SKU picker defaults to
// the current fiscal year (FY27) so reps don't accidentally quote last year's
// book, with an opt-in to view all years.

import data from "../data/pricebook.json";
import type {
  FiscalYear,
  Pricebook,
  PricebookProduct,
  VolumeProduct,
} from "./pricebook-transform";

export type {
  FiscalYear,
  Pricebook,
  PricebookProduct,
  VolumeProduct,
  VolumeTier,
} from "./pricebook-transform";

const pricebook = data as Pricebook;

/** Current fiscal year the document generator quotes against. */
export const DEFAULT_FISCAL_YEAR: FiscalYear = "FY27";

type FiscalFilter = FiscalYear | "all";

export function getProducts(opts?: {
  fiscalYear?: FiscalFilter;
}): PricebookProduct[] {
  const fy = opts?.fiscalYear ?? DEFAULT_FISCAL_YEAR;
  return fy === "all"
    ? pricebook.flat
    : pricebook.flat.filter((p) => p.fiscalYear === fy);
}

export function getVolumeProducts(opts?: {
  fiscalYear?: FiscalFilter;
}): VolumeProduct[] {
  const fy = opts?.fiscalYear ?? DEFAULT_FISCAL_YEAR;
  return fy === "all"
    ? pricebook.volume
    : pricebook.volume.filter((p) => p.fiscalYear === fy);
}

/** BOCES line items only — used by the BOCES Quote doc type, which restricts to
 *  FY27 BOCES SKUs. Matches on category or the BOC* SKU prefix. */
export function getBocesProducts(
  fiscalYear: FiscalYear = DEFAULT_FISCAL_YEAR,
): PricebookProduct[] {
  return getProducts({ fiscalYear }).filter(
    (p) => /boces/i.test(p.category) || /^BOC/i.test(p.sku),
  );
}

export function findBySku(sku: string): PricebookProduct | undefined {
  return pricebook.flat.find((p) => p.sku === sku);
}

/** Distinct categories for a fiscal year (for picker grouping/filters). */
export function getCategories(
  fiscalYear: FiscalFilter = DEFAULT_FISCAL_YEAR,
): string[] {
  return [...new Set(getProducts({ fiscalYear }).map((p) => p.category))].sort();
}
