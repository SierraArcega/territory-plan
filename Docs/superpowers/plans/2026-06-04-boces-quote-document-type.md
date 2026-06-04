# FY27 BOCES Quote — Document Type Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a second generatable document type, the FY27 BOCES Quote, to the existing Sea Monkey Apps Script web app, selectable via a `doc_type` payload discriminator.

**Architecture:** `doPost` routes on a top-level `doc_type` ("contract" default | "boces_quote") to one of two orchestrators that share low-level helpers (`Utils.gs`, `formatCurrency`, `appendDocContent`, a new `appendOptionalSection`). The BOCES Quote is quote-only — no signature page, no Dropbox Sign. Its quote table has its own column set (Product/Hourly Rate/Hours/Total, no discount) and computes a fixed percentage fee. The standing BOCES Master License & Service Agreement PDF is referenced as a separate `agreementUrl` in the response (physical merge deferred).

**Tech Stack:** Google Apps Script (V8 runtime, `.gs` files), CLASP (`npx clasp push`), Google Docs/Drive services. No Node/Vitest — `.gs` is tested via in-editor functions.

---

## Context for the implementer (read first)

**Where the code lives:** `scripts/document-generation/appsscript/`. All `clasp` commands MUST be run from inside that directory:

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Running `clasp push` from the repo root fails with "Project settings not found".

**How `.gs` code is tested (there is no local runner):**
1. `npx clasp push` to upload your edits to the Apps Script project.
2. Open the project in the browser (`script.google.com` → the Sea Monkey project), pick the test function from the function dropdown, click **Run**.
3. Read results in **View → Logs** (`Logger.log` output). Unit-test functions throw on failure (the run shows a red error); E2E test functions log a doc URL to open and eyeball.

**Existing helpers you will reuse (do not reimplement):**
- `formatCurrency(amount)` — `Utils.gs`. `1234.5 → "$1,234.50"`, `null → ""`.
- `findParagraphIndex(body, text)`, `deleteMarkerParagraph(body, marker)`, `deleteBetweenMarkers(body, start, end)` — `Utils.gs`.
- `appendDocContent(targetDoc, sourceDocId, placeholderText, skipWidthNorm)` — `Utils.gs`. Appends a Drive doc's body after a page break, normalizes table widths to 540pt unless `skipWidthNorm`.
- `applyFullmindTableStyle(table)` — `TemplatePrepare.gs`. Plum header, alternating rows.
- `escapeRegex(str)` — `Utils.gs`.

**Conventions:** Apps Script V8 but the codebase uses ES5 style (`var`, function declarations, no arrow functions). Match it. Drive file IDs always come from `PropertiesService` via the `PROP` map in `Config.gs` — never hardcode an ID in logic.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `BocesQuote.gs` | **Create** | `computeBocesQuoteTotals` (pure), `buildBocesQuoteTable`, `replaceBocesMergeFields`, `generateBocesQuote` orchestrator |
| `Utils.gs` | Modify | Add shared `appendOptionalSection(doc, opts)` helper |
| `AppendedSections.gs` | Modify | Refactor `handleAppendedSections` to use `appendOptionalSection` (behavior-preserving) |
| `Config.gs` | Modify | Add `TEMPLATE_BOCES_QUOTE_ID` + `BOCES_AGREEMENT_PDF_ID` property keys |
| `SampleData.gs` | Modify | Add `PAYLOAD_BOCES_QUOTE` fixture |
| `Code.gs` | Modify | Rename `generateContract` → `generateFullContract`; add `generateDocument` dispatcher + `doc_type` routing in `doPost` |
| `Tests.gs` | Modify | Add `testComputeBocesQuoteTotals` (unit) + `testBocesQuote` (E2E); update renamed `generateContract` callers |

**New Drive assets (manual, Task 8):** BOCES Quote base template Google Doc; uploaded Erie 1 / WNYRIC MLSA PDF.

---

## Task 1: `computeBocesQuoteTotals` — pure fee math (TDD)

The only piece of pure, unit-testable logic. Compute per-line totals, subtotal, fee, and grand total. Build and verify this first so the table renderer (Task 5) can lean on it.

**Files:**
- Create: `scripts/document-generation/appsscript/BocesQuote.gs`
- Modify: `scripts/document-generation/appsscript/Tests.gs`

- [ ] **Step 1: Write the failing unit test**

Add to `Tests.gs` (after the existing `testFormatCurrency` function, in the unit-tests section):

```javascript
function runBocesTests() {
  testComputeBocesQuoteTotals();
  Logger.log('✅ All BOCES unit tests passed.');
}

function testComputeBocesQuoteTotals() {
  // Numbers mirror the approved BOCES Quote screenshot:
  // Homebound 1:1 @ $53.06 × 250 = $13,265.00
  // Students with Disabilities @ $21.23 × 100 = $2,123.00
  // subtotal $15,388.00; fee 10.6% = $1,631.13; total $17,019.13
  var lineItems = [
    { product: 'Homebound 1:1', rate: 53.06, qty: 250 },
    { product: 'Students with Disabilities', rate: 21.23, qty: 100 },
  ];
  var r = computeBocesQuoteTotals(lineItems, 10.6);

  if (r.rows[0].total !== 13265)   throw new Error('row0 total: expected 13265, got ' + r.rows[0].total);
  if (r.rows[1].total !== 2123)    throw new Error('row1 total: expected 2123, got ' + r.rows[1].total);
  if (r.subtotal !== 15388)        throw new Error('subtotal: expected 15388, got ' + r.subtotal);
  if (r.fee !== 1631.13)           throw new Error('fee: expected 1631.13, got ' + r.fee);
  if (r.total !== 17019.13)        throw new Error('total: expected 17019.13, got ' + r.total);

  // Default fee_pct when omitted is 10.6
  var r2 = computeBocesQuoteTotals([{ product: 'X', rate: 100, qty: 1 }], undefined);
  if (r2.fee !== 10.6)             throw new Error('default fee: expected 10.6, got ' + r2.fee);

  Logger.log('  ✅ testComputeBocesQuoteTotals passed');
}
```

- [ ] **Step 2: Push and run to verify it fails**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Then in the editor, run `runBocesTests`.
Expected: **FAIL** — `ReferenceError: computeBocesQuoteTotals is not defined`.

- [ ] **Step 3: Write the minimal implementation**

Create `BocesQuote.gs` with:

```javascript
/**
 * Computes the BOCES quote table totals from line items and a percentage fee.
 * Pure function — no Document dependency, unit-testable in the editor.
 * @param {Array<{product:string, rate:number, qty:number}>} lineItems
 * @param {number} [feePct=10.6]  Fee percentage applied to the line-item subtotal.
 * @returns {{rows:Array<{product:string,rate:number,qty:number,total:number}>,
 *           subtotal:number, feePct:number, fee:number, total:number}}
 */
function computeBocesQuoteTotals(lineItems, feePct) {
  var pct = (feePct == null) ? 10.6 : feePct;

  var rows = lineItems.map(function(item) {
    return {
      product: item.product,
      rate:    item.rate,
      qty:     item.qty,
      total:   round2(item.rate * item.qty),
    };
  });

  var subtotal = round2(rows.reduce(function(s, r) { return s + r.total; }, 0));
  var fee      = round2(subtotal * pct / 100);
  var total    = round2(subtotal + fee);

  return { rows: rows, subtotal: subtotal, feePct: pct, fee: fee, total: total };
}

/** Rounds to 2 decimal places, avoiding binary float drift. */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
```

- [ ] **Step 4: Push and run to verify it passes**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Run `runBocesTests` in the editor.
Expected: log shows `✅ testComputeBocesQuoteTotals passed` then `✅ All BOCES unit tests passed.`

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/BocesQuote.gs scripts/document-generation/appsscript/Tests.gs
git commit -m "feat(sea-monkey): add computeBocesQuoteTotals pure fee math + unit test"
```

---

## Task 2: Add BOCES script property keys (Config.gs)

Register the two new Drive-ID property keys. IDs stay empty placeholders until the Drive assets are created in Task 8.

**Files:**
- Modify: `scripts/document-generation/appsscript/Config.gs`

- [ ] **Step 1: Add the keys to the `PROP` map**

In `Config.gs`, add two entries to the `PROP` object (after `PRICING_BOCES_ID`):

```javascript
  PRICING_BOCES_ID:       'PRICING_BOCES_ID',
  TEMPLATE_BOCES_QUOTE_ID: 'TEMPLATE_BOCES_QUOTE_ID',
  BOCES_AGREEMENT_PDF_ID:  'BOCES_AGREEMENT_PDF_ID',
  MSA_ID:                    'MSA_ID',
```

- [ ] **Step 2: Add empty placeholders to `initScriptProperties`**

In the `setProperties({ ... })` call inside `initScriptProperties`, add (after the `PRICING_BOCES_ID` line):

```javascript
    [PROP.PRICING_BOCES_ID]:        '1puCVVI12bmwZO8uV3Rom6XU21Onn4fzfUwYChUBZfWY',
    [PROP.TEMPLATE_BOCES_QUOTE_ID]: '',  // set in Task 8 after creating the BOCES Quote base template
    [PROP.BOCES_AGREEMENT_PDF_ID]:  '',  // set in Task 8 after uploading the Erie 1 MLSA PDF
```

- [ ] **Step 3: Push to verify it compiles**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Expected: push succeeds with no syntax error. (Do not run `initScriptProperties` yet — that would blank any manually-set values; the real IDs get set in Task 8.)

- [ ] **Step 4: Commit**

```bash
git add scripts/document-generation/appsscript/Config.gs
git commit -m "feat(sea-monkey): register BOCES Quote template + agreement PDF property keys"
```

---

## Task 3: Add `PAYLOAD_BOCES_QUOTE` fixture (SampleData.gs)

A test payload matching the approved schema, used by the E2E test in Task 9.

**Files:**
- Modify: `scripts/document-generation/appsscript/SampleData.gs`

- [ ] **Step 1: Append the fixture**

Add at the end of `SampleData.gs`:

```javascript
// ─── BOCES Quote fixture (doc_type: 'boces_quote') ────────────────────────────
var PAYLOAD_BOCES_QUOTE = {
  doc_type: 'boces_quote',
  deal: {
    client_company: 'Erie 1 BOCES',
    quote_number:   'Q-2027-0142',
    start_date:     '2026-09-01',
    end_date:       '2027-06-30',
    today:          'June 4, 2026',
  },
  quote: {
    fee_pct: 10.6,
    line_items: [
      { sku: 'BOC27-HB11', product: 'Homebound 1:1',              rate: 53.06, qty: 250 },
      { sku: 'BOC27-SWD',  product: 'Students with Disabilities', rate: 21.23, qty: 100 },
    ],
  },
  sections: {
    staffing_include: true,
    pricing_boces:    true,
    boces_agreement:  true,
  },
};
```

- [ ] **Step 2: Push to verify it compiles**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Expected: push succeeds, no syntax error.

- [ ] **Step 3: Commit**

```bash
git add scripts/document-generation/appsscript/SampleData.gs
git commit -m "feat(sea-monkey): add PAYLOAD_BOCES_QUOTE test fixture"
```

---

## Task 4: Shared `appendOptionalSection` helper + refactor (Utils.gs, AppendedSections.gs)

The contract's `handleAppendedSections` repeats the same "if flag: delete the two markers + append the source doc; else: delete everything between the markers" block five times. Factor it into one helper that both orchestrators reuse. This is behavior-preserving for the contract — verified by re-running the existing contract E2E tests.

**Files:**
- Modify: `scripts/document-generation/appsscript/Utils.gs`
- Modify: `scripts/document-generation/appsscript/AppendedSections.gs`

- [ ] **Step 1: Add `appendOptionalSection` to Utils.gs**

Append to `Utils.gs`:

```javascript
/**
 * Toggles one optional appended section. When opts.include is true, removes the
 * section's start/end marker paragraphs and appends the source doc's content at
 * opts.placeholder; otherwise deletes everything between the two markers.
 * Both orchestrators (contract + BOCES quote) reuse this — marker names differ
 * per template, so they are passed in.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {{include:boolean, sourceId:string, startMarker:string,
 *          endMarker:string, placeholder:string}} opts
 */
function appendOptionalSection(doc, opts) {
  var body = doc.getBody();
  if (opts.include) {
    deleteMarkerParagraph(body, opts.startMarker);
    deleteMarkerParagraph(body, opts.endMarker);
    if (opts.sourceId) {
      appendDocContent(doc, opts.sourceId, opts.placeholder);
    } else {
      Logger.log('Warning: source ID not set for section ' + opts.startMarker);
    }
  } else {
    deleteBetweenMarkers(body, opts.startMarker, opts.endMarker);
  }
}
```

- [ ] **Step 2: Refactor the SOW, staffing, and pricing blocks in `handleAppendedSections`**

In `AppendedSections.gs`, replace the SOW block (the `if (sections.sow_type) { ... } else { ... }` block) with:

```javascript
  // SOW
  appendOptionalSection(doc, {
    include:     !!sections.sow_type,
    sourceId:    sections.sow_type === 'live_streaming'
                   ? props[PROP.SOW_LIVESTREAM_ID]
                   : props[PROP.SOW_INSTRUCTION_ID],
    startMarker: '{{SOW_SECTION_START}}',
    endMarker:   '{{SOW_SECTION_END}}',
    placeholder: '[SOW content will be appended here]',
  });
```

Replace the staffing block with:

```javascript
  // Staffing type descriptions
  appendOptionalSection(doc, {
    include:     !!sections.staffing_include,
    sourceId:    props[PROP.STAFFING_ID],
    startMarker: '{{STAFFING_SECTION_START}}',
    endMarker:   '{{STAFFING_SECTION_END}}',
    placeholder: '[Staffing descriptions will be appended here]',
  });
```

Replace the `pricingSheets.forEach(function(sheet) { ... });` block with:

```javascript
  pricingSheets.forEach(function(sheet) {
    appendOptionalSection(doc, {
      include:     !!sections[sheet.flag],
      sourceId:    props[sheet.propKey],
      startMarker: '{{PRICING_' + sheet.marker + '_START}}',
      endMarker:   '{{PRICING_' + sheet.marker + '_END}}',
      placeholder: sheet.placeholder,
    });
  });
```

Leave the signature page, the outer pricing wrapper-marker deletes, and the MSA block exactly as they are (always-appended, different pattern).

- [ ] **Step 3: Push**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Expected: push succeeds.

- [ ] **Step 4: Verify the contract pipeline is unchanged (regression check)**

In the editor, run `testContractFull`. Open the logged doc URL.
Expected: identical output to before — SOW (live streaming), staffing, pricing sheets, and MSA all append correctly with clean page breaks; no visible markers. Then run `testContractBOCES` and confirm it still generates.

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/Utils.gs scripts/document-generation/appsscript/AppendedSections.gs
git commit -m "refactor(sea-monkey): extract shared appendOptionalSection helper"
```

---

## Task 5: BOCES Quote merge fields + table renderer (BocesQuote.gs)

Add the BOCES-specific merge-field replacer and the table builder. The contract's `replaceMergeFields` reads `payload.payment.*` unconditionally and would crash on a BOCES payload (no `payment` object), so the BOCES quote gets its own focused replacer.

**Files:**
- Modify: `scripts/document-generation/appsscript/BocesQuote.gs`

- [ ] **Step 1: Add `replaceBocesMergeFields`**

Append to `BocesQuote.gs`:

```javascript
/**
 * Replaces the BOCES Quote's <<FIELD>> tokens. Intentionally a separate, smaller
 * map than the contract's replaceMergeFields — the BOCES payload has no
 * payment block and adds <<quote_number>>.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} payload  BOCES quote payload (deal only)
 */
function replaceBocesMergeFields(body, payload) {
  var d = payload.deal;
  var fields = {
    '<<quote_number>>':   d.quote_number,
    '<<Client_Company>>': d.client_company,
    '<<start_date>>':     d.start_date,
    '<<end_date>>':       d.end_date,
    '<<today>>':          d.today,
  };
  for (var field in fields) {
    body.replaceText(escapeRegex(field), fields[field] != null ? String(fields[field]) : '');
  }
}
```

- [ ] **Step 2: Add `buildBocesQuoteTable`**

Append to `BocesQuote.gs`. The base template (Task 8) contains a standalone marker paragraph `[BOCES_QUOTE_TABLE_INSERT]`; the table is inserted at that position and the marker removed. Columns are fixed: Product / Hourly Rate / Hours / Total. The Fee row shows the percentage; the Total row shows subtotal + fee (matching the approved screenshot — no separate subtotal or dollar-fee row is displayed).

```javascript
/**
 * Builds the "Anticipated Educator Need" table at the [BOCES_QUOTE_TABLE_INSERT]
 * marker, then removes the marker. Columns: Product, Hourly Rate, Hours, Total.
 * No discount column. Fee row shows the percentage; Total row shows subtotal+fee.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote ({ fee_pct, line_items })
 */
function buildBocesQuoteTable(body, quote) {
  var t = computeBocesQuoteTotals(quote.line_items, quote.fee_pct);

  var markerIdx = findParagraphIndex(body, '[BOCES_QUOTE_TABLE_INSERT]');
  if (markerIdx === -1) {
    Logger.log('Warning: [BOCES_QUOTE_TABLE_INSERT] marker not found — skipping table build');
    return;
  }

  var headerRow = ['Product', 'Hourly Rate', 'Hours', 'Total'];
  var dataRows  = t.rows.map(function(r) {
    return [r.product, formatCurrency(r.rate), String(r.qty), formatCurrency(r.total)];
  });
  var feeRow   = ['', '', 'Fee', t.feePct + ' %'];
  var totalRow = ['', '', 'Total', formatCurrency(t.total)];

  var allRows = [headerRow].concat(dataRows).concat([feeRow, totalRow]);
  var newTable = body.insertTable(markerIdx + 1, allRows);

  // Proportional column widths scaled to the 540pt content area (8.5" − 0.5" margins).
  var naturalWidths = [220, 110, 90, 120];
  var rawTotal = naturalWidths.reduce(function(s, w) { return s + w; }, 0);
  naturalWidths.forEach(function(w, i) {
    newTable.setColumnWidth(i, Math.round(w / rawTotal * 540));
  });

  applyFullmindTableStyle(newTable);

  // Bold the Fee and Total rows.
  var n = newTable.getNumRows();
  [n - 2, n - 1].forEach(function(rowIdx) {
    var row = newTable.getRow(rowIdx);
    for (var c = 0; c < row.getNumCells(); c++) {
      row.getCell(c).editAsText().setBold(true);
    }
  });

  // Remove the marker paragraph now that the table sits after it.
  body.getChild(markerIdx).removeFromParent();
}
```

- [ ] **Step 3: Push to verify it compiles**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Expected: push succeeds, no syntax error. (Functional verification happens in the Task 9 E2E test, once the base template exists — there is no way to unit-test Document manipulation without a live Doc, consistent with how `buildQuoteTableFromScratch` is verified.)

- [ ] **Step 4: Commit**

```bash
git add scripts/document-generation/appsscript/BocesQuote.gs
git commit -m "feat(sea-monkey): add BOCES quote merge fields + table renderer"
```

---

## Task 6: `generateBocesQuote` orchestrator (BocesQuote.gs)

Assemble the document: copy the base template, replace merge fields, build the table, append optional staffing + BOCES pricing sections, and attach the agreement URL when flagged.

**Files:**
- Modify: `scripts/document-generation/appsscript/BocesQuote.gs`

- [ ] **Step 1: Add the orchestrator**

Append to `BocesQuote.gs`:

```javascript
/**
 * BOCES Quote orchestrator. Quote-only — no signature page, no Dropbox Sign.
 * Call directly from the editor: generateBocesQuote(PAYLOAD_BOCES_QUOTE)
 * @param {Object} payload
 * @returns {{ success:boolean, url:string, docId:string, agreementUrl?:string }}
 */
function generateBocesQuote(payload) {
  var props  = PropertiesService.getScriptProperties().getProperties();
  var folder = DriveApp.getFolderById(props[PROP.OUTPUT_FOLDER_ID]);

  var docName = payload.deal.client_company + ' — BOCES Quote ' + payload.deal.today;
  var copy    = DriveApp.getFileById(props[PROP.TEMPLATE_BOCES_QUOTE_ID]).makeCopy(docName, folder);
  var doc     = DocumentApp.openById(copy.getId());
  var body    = doc.getBody();

  try {
    replaceBocesMergeFields(body, payload);
    buildBocesQuoteTable(body, payload.quote);

    var sections = payload.sections || {};

    // Optional: staffing type descriptions (same Drive doc as the All Services contract)
    appendOptionalSection(doc, {
      include:     !!sections.staffing_include,
      sourceId:    props[PROP.STAFFING_ID],
      startMarker: '{{STAFFING_SECTION_START}}',
      endMarker:   '{{STAFFING_SECTION_END}}',
      placeholder: '[Staffing descriptions will be appended here]',
    });

    // Optional: BOCES pricing table
    appendOptionalSection(doc, {
      include:     !!sections.pricing_boces,
      sourceId:    props[PROP.PRICING_BOCES_ID],
      startMarker: '{{PRICING_BOCES_START}}',
      endMarker:   '{{PRICING_BOCES_END}}',
      placeholder: '[BOCES pricing sheet]',
    });

    validateMergeFields(body);
    doc.saveAndClose();

    var docUrl = 'https://docs.google.com/document/d/' + copy.getId() + '/edit';
    var result = { success: true, url: docUrl, docId: copy.getId() };

    // Optional: reference the standing BOCES Master License & Service Agreement PDF.
    // Delivered as a separate attachment URL — physical merge is deferred.
    if (sections.boces_agreement) {
      if (props[PROP.BOCES_AGREEMENT_PDF_ID]) {
        result.agreementUrl = 'https://drive.google.com/file/d/' + props[PROP.BOCES_AGREEMENT_PDF_ID] + '/view';
      } else {
        Logger.log('Warning: BOCES_AGREEMENT_PDF_ID not set — agreementUrl omitted');
      }
    }

    return result;

  } catch (err) {
    try { copy.setTrashed(true); } catch (e2) {}
    Logger.log('BOCES quote generation failed: ' + err.message + '\n' + (err.stack || ''));
    throw err;
  }
}
```

- [ ] **Step 2: Push to verify it compiles**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

Expected: push succeeds, no syntax error.

- [ ] **Step 3: Commit**

```bash
git add scripts/document-generation/appsscript/BocesQuote.gs
git commit -m "feat(sea-monkey): add generateBocesQuote orchestrator"
```

---

## Task 7: `doc_type` routing in Code.gs

Rename the contract orchestrator and add a dispatcher so `doPost` routes by `doc_type`. Default to `"contract"` so existing payloads are unaffected.

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs`
- Modify: `scripts/document-generation/appsscript/Tests.gs`

- [ ] **Step 1: Rename `generateContract` → `generateFullContract`**

In `Code.gs`, change the function declaration:

```javascript
function generateFullContract(payload) {
```

(Only the name on the declaration line changes; the body is unchanged.)

- [ ] **Step 2: Add the dispatcher and route `doPost` through it**

In `Code.gs`, add this function above `generateFullContract`:

```javascript
/**
 * Routes a payload to the correct document orchestrator by doc_type.
 * Defaults to 'contract' when doc_type is absent (back-compat).
 * @param {Object} payload
 * @returns {Object} orchestrator result
 */
function generateDocument(payload) {
  var docType = payload.doc_type || 'contract';
  if (docType === 'boces_quote') {
    return generateBocesQuote(payload);
  }
  return generateFullContract(payload);
}
```

Then change the `doPost` body to call the dispatcher — replace the line:

```javascript
    var result  = generateContract(payload);
```

with:

```javascript
    var result  = generateDocument(payload);
```

- [ ] **Step 3: Update the renamed callers in Tests.gs**

In `Tests.gs`, the three contract test functions and `testAutoSend` call `generateContract(...)`. Update each call to `generateFullContract(...)`:
- `testContractFull`: `var result = generateFullContract(PAYLOAD_FULL);`
- `testContractNoQuote`: `var result = generateFullContract(PAYLOAD_NO_QUOTE);`
- `testContractBOCES`: `var result = generateFullContract(PAYLOAD_BOCES_ONLY);`
- `testAutoSend`: `var result = generateFullContract(payload);`

- [ ] **Step 4: Push and verify routing compiles + contract path still works**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

In the editor run `testContractFull`.
Expected: contract still generates correctly (the rename + dispatcher are transparent). Open the logged URL to confirm.

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/Code.gs scripts/document-generation/appsscript/Tests.gs
git commit -m "feat(sea-monkey): route doPost by doc_type (contract | boces_quote)"
```

---

## Task 8: Create Drive assets + set script properties (MANUAL)

This task is done in the browser, not in code. It creates the BOCES Quote base template and uploads the agreement PDF, then stores their IDs as script properties.

**8a — Build the BOCES Quote base template Google Doc**

- [ ] Create a new Google Doc in the `/Fullmind Templates/base/` folder named **"FY27 BOCES Quote Template v1"**.
- [ ] Set page margins to **0.5" on all four sides** (File → Page setup) — matches the contract template so `appendDocContent`'s 540pt width normalization lines up.
- [ ] Lay out the document body top to bottom:
  - **Fixed title:** `Quote for Fullmind Services`
  - **Quote # line:** `Quote #: <<quote_number>>`
  - **Dates:** `Start Date: <<start_date>>`  and  `End Date: <<end_date>>`
  - Section heading: `Anticipated Educator Need`
  - A **standalone paragraph** containing exactly `[BOCES_QUOTE_TABLE_INSERT]` (this is where the table is injected; it gets removed at generation time)
  - The **BOCES Payment Terms** block — paste the same payment-terms content used for BOCES in the contract (the type-C / BOCES terms). This is baked in; there are no `<<pay_*>>` merge fields and no A/B/C variant markers.
  - The optional-insert markers, each as its own standalone paragraph, in white 1pt text (so they're invisible but findable):
    - `{{STAFFING_SECTION_START}}` … `{{STAFFING_SECTION_END}}`
    - `{{PRICING_BOCES_START}}` … `{{PRICING_BOCES_END}}`
- [ ] Marker formatting rule (same as the contract template): every `{{MARKER}}` and the `[BOCES_QUOTE_TABLE_INSERT]` marker must be a **standalone paragraph** (not inside a table cell) so `findParagraphIndex` can locate it by direct body-child traversal.
- [ ] Copy the doc's Drive ID from its URL (`https://docs.google.com/document/d/<THIS_IS_THE_ID>/edit`).

**8b — Upload the agreement PDF**

- [ ] Upload `/Users/astonfurious/Downloads/26-29 Erie 1 BOCES Agreement.pdf` to the `/Fullmind Templates/` tree (e.g. a `boces/` subfolder). Keep it as a **PDF** — do not convert to a Google Doc.
- [ ] Copy its Drive file ID.

**8c — Set the script properties (without blanking existing ones)**

- [ ] In the Apps Script editor, run this one-off snippet (paste the two IDs you collected). This sets only the two new keys and does NOT touch the others (unlike `initScriptProperties`, which would blank the manually-set Dropbox Sign key):

```javascript
function setBocesProps() {
  PropertiesService.getScriptProperties().setProperties({
    'TEMPLATE_BOCES_QUOTE_ID': 'PASTE_TEMPLATE_ID_HERE',
    'BOCES_AGREEMENT_PDF_ID':  'PASTE_AGREEMENT_PDF_ID_HERE',
  }, false);  // false = merge, do not delete existing keys
  Logger.log('BOCES props set. Run logScriptProperties() to verify.');
}
```

- [ ] Run `logScriptProperties` and confirm `TEMPLATE_BOCES_QUOTE_ID` and `BOCES_AGREEMENT_PDF_ID` show the real IDs and all prior properties are intact.
- [ ] Delete the temporary `setBocesProps` function afterward (or leave it — it's idempotent and harmless).

*(No commit — this task changes Drive + script properties, not repo files. Record the two IDs in the project memory after Task 9 verifies them.)*

---

## Task 9: End-to-end BOCES Quote test + visual verification

**Files:**
- Modify: `scripts/document-generation/appsscript/Tests.gs`

- [ ] **Step 1: Add the E2E test function**

Add to `Tests.gs`, alongside the other E2E tests (near `testContractFull`):

```javascript
function testBocesQuote() {
  var result = generateBocesQuote(PAYLOAD_BOCES_QUOTE);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) {
    Logger.log('✅ Open doc: ' + result.url);
    if (result.agreementUrl) Logger.log('📎 Agreement: ' + result.agreementUrl);
  }
}
```

- [ ] **Step 2: Push and run**

```bash
cd "scripts/document-generation/appsscript"
npx clasp push
```

In the editor, run `testBocesQuote`.
Expected: log prints `{"success":true,"url":"...","agreementUrl":"..."}` plus the two `✅`/`📎` lines.

- [ ] **Step 3: Visual checklist — open the logged doc URL and verify**

- [ ] Title **"Quote for Fullmind Services"** + Quote # `Q-2027-0142` rendered; no literal `<<merge_fields>>` anywhere
- [ ] No `{{MARKERS}}` or `[BOCES_QUOTE_TABLE_INSERT]` visible
- [ ] Quote table columns are **Product · Hourly Rate · Hours · Total** (no discount column)
- [ ] Row math: Homebound 1:1 → `$13,265.00`; Students with Disabilities → `$2,123.00`; **Fee** row shows `10.6 %`; **Total** row shows `$17,019.13`
- [ ] BOCES payment terms block present
- [ ] Staffing descriptions and BOCES pricing inserts appended with clean page breaks (no orphan blank pages)
- [ ] `agreementUrl` in the result opens the Erie 1 MLSA PDF

- [ ] **Step 4: Verify the routing entry point**

In the editor, run a quick check that `generateDocument` routes correctly:

```javascript
function testDocTypeRouting() {
  var r = generateDocument(PAYLOAD_BOCES_QUOTE);            // doc_type: 'boces_quote'
  Logger.log('boces_quote → ' + (r.success ? 'OK ' + r.url : 'FAIL'));
}
```

Push, run `testDocTypeRouting`, confirm it routes to the BOCES generator (logs a doc URL).

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/Tests.gs
git commit -m "test(sea-monkey): add BOCES quote E2E + doc_type routing tests"
```

- [ ] **Step 6: Update project memory**

Record in the Sea Monkey memory: the new `TEMPLATE_BOCES_QUOTE_ID` and `BOCES_AGREEMENT_PDF_ID` Drive IDs, the `doc_type` routing entry point, and that the contract template was renamed to "FY27 - Contract Template - All Services".

---

## Self-Review

**Spec coverage:**
- Document anatomy (title, quote #, dates, table, payment terms, optional inserts) → Tasks 5, 6, 8a ✓
- New quote table (Product/Hourly Rate/Hours/Total, no discount, fee row, total) → Tasks 1, 5 ✓
- Fee = 10.6% default, payload field → Task 1 (`computeBocesQuoteTotals` default), Task 3 fixture ✓
- A1 routing (`doc_type` discriminator + two orchestrators) → Task 7 ✓
- Shared-insert refactor → Task 4 ✓
- New script properties → Task 2, set in Task 8 ✓
- Payload schema → Task 3 ✓
- Agreement as separate `agreementUrl` (merge deferred) → Task 6 ✓
- SKU restriction upstream only (script trusts payload) → no script task, by design ✓
- Drive assets (template + agreement PDF) → Task 8 ✓
- Testing fixture + checklist → Tasks 3, 9 ✓
- Contract template rename is zero-code → noted in Task 9 Step 6; no code task needed ✓

**Placeholder scan:** No "TBD"/"TODO" in code steps; the only `PASTE_..._HERE` tokens are in the manual Drive-asset task where real IDs are unknowable until the assets exist. ✓

**Type consistency:** `computeBocesQuoteTotals(lineItems, feePct)` returns `{rows, subtotal, feePct, fee, total}` — consumed by `buildBocesQuoteTable` (uses `.rows`, `.feePct`, `.total`) ✓. `appendOptionalSection(doc, {include, sourceId, startMarker, endMarker, placeholder})` — same shape used in Tasks 4 and 6 ✓. `generateDocument` → `generateBocesQuote` / `generateFullContract` names match their declarations ✓.
