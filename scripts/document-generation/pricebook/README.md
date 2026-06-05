# Pricebook dataset

The Fullmind pricebook that the document-generator UI's SKU picker reads.

## Files

- `build-pricebook.ts` — generator. Parses the PandaDoc CSV exports → writes
  `src/features/document-generation/data/pricebook.json`.
- The typed loader + selectors live at
  `src/features/document-generation/lib/pricebook.ts`; the pure transforms
  (parsing, cleanup) at `src/features/document-generation/lib/pricebook-transform.ts`.

## Regenerating (e.g. FY27 → FY28)

The raw CSVs are **not** committed — they carry an internal `Cost`/margin
column we keep out of the app repo. Point the generator at the export folder:

```bash
npx tsx scripts/document-generation/pricebook/build-pricebook.ts \
  "/path/to/Fullmind Pricebook - PandaDoc Export <month year>"
# or: PRICEBOOK_SRC="/path/..." npx tsx scripts/.../build-pricebook.ts
```

The export folder must contain `flat_priced_products.csv` and
`volume_priced_products.csv`. (As of this import the source lived at
`~/Desktop/Work Documents/Project Sea Monkey/Fullmind Pricebook - PandaDoc Export May 2026`.)

Then commit the regenerated `pricebook.json` and update the count snapshot in
`src/features/document-generation/lib/__tests__/pricebook.test.ts`.

## Import decisions (intentional)

- **FY26 + FY27 both imported**, each row tagged `fiscalYear` (parsed from the
  category). The UI defaults to FY27 so reps don't quote last year's book;
  `getProducts({ fiscalYear: "all" })` opts into everything.
- **`Cost` column dropped** — internal margin data, not needed by the app.
- **`Allocation` excluded** — it's the rep's custom/ad-hoc line item (blank
  category, $0). The form offers an "Add custom line item" action instead of
  surfacing it as a SKU.
- **$0 non-custom rows kept** (e.g. `PGC-2027` Program Coordinator) — $0 is a
  "rep enters the price" placeholder, same editable behavior as any row.
- **Descriptions HTML-stripped**; numeric/PandaDoc-internal SKUs kept (several
  are real products); `unit` is a best-effort heuristic over the signal columns
  (`Charged Per`, `Price per Hour`, `Full Year …`) and is non-authoritative.
- **Volume-priced products** keep their full quantity-tier ladder
  (`tiers[{ minQty, price }]`).
