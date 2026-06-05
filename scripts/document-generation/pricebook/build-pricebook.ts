#!/usr/bin/env tsx
/**
 * Regenerate the committed Fullmind pricebook dataset from the PandaDoc CSV
 * exports.
 *
 *   npx tsx scripts/document-generation/pricebook/build-pricebook.ts <csv-dir>
 *   # or
 *   PRICEBOOK_SRC="<csv-dir>" npx tsx scripts/document-generation/pricebook/build-pricebook.ts
 *
 * <csv-dir> must contain `flat_priced_products.csv` and
 * `volume_priced_products.csv`. The raw CSVs are intentionally NOT committed
 * (they include an internal `Cost`/margin column); only the list-price dataset
 * below is committed. See README.md.
 */
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { dirname, join, resolve } from "node:path";

import {
  parseCsv,
  buildFlatProducts,
  buildVolumeProducts,
  type Pricebook,
} from "../../../src/features/document-generation/lib/pricebook-transform";

const sourceDir = process.argv[2] || process.env.PRICEBOOK_SRC;
if (!sourceDir) {
  console.error(
    "Usage: tsx build-pricebook.ts <path-to-pricebook-csv-dir>\n" +
      "  (or set PRICEBOOK_SRC). See README.md for the export location.",
  );
  process.exit(1);
}

const flatCsv = readFileSync(join(sourceDir, "flat_priced_products.csv"), "utf8");
const volCsv = readFileSync(
  join(sourceDir, "volume_priced_products.csv"),
  "utf8",
);

const flat = buildFlatProducts(parseCsv(flatCsv));
const volume = buildVolumeProducts(parseCsv(volCsv));

const out: Pricebook = {
  source: sourceDir.split("/").filter(Boolean).pop() ?? "pricebook",
  flat,
  volume,
};

const outPath = resolve(
  __dirname,
  "../../../src/features/document-generation/data/pricebook.json",
);
mkdirSync(dirname(outPath), { recursive: true });
writeFileSync(outPath, `${JSON.stringify(out, null, 2)}\n`);

const byFy = flat.reduce<Record<string, number>>((m, p) => {
  const k = p.fiscalYear ?? "(none)";
  m[k] = (m[k] ?? 0) + 1;
  return m;
}, {});

console.log(`Wrote ${flat.length} flat + ${volume.length} volume products`);
console.log("By fiscal year:", byFy);
console.log(`→ ${outPath}`);
