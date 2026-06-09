# Sea Monkey Renderer (SP1) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make "Render document" produce a real Google Doc that faithfully renders the full payload the Generate Document form emits (count×qty line display, order-level adjustments, savings, billable summary), and replace the stub client with a real one that POSTs to the deployed Apps Script via service-account auth.

**Architecture:** The Google Doc is the single renderer. The Apps Script is a *pure renderer* of app-computed values (it does not recompute money the app already computed). WS1 extends the `.gs` quote tables + adds a shared footer helper + `tags` mode; WS2 adds one merge-field paragraph to two templates (manual); WS3 adds a Next.js API route that mints a service-account OAuth token (domain-wide delegation) and POSTs the payload, plus a real `RenderClient`.

**Tech Stack:** Google Apps Script (V8) + clasp; Next.js 16 App Router route handlers; `googleapis` (`google.auth.JWT`) for service-account tokens; Vitest for app-side tests; editor test functions + visual checklist for `.gs` rendering.

**Reference spec:** `Docs/superpowers/specs/2026-06-08-sea-monkey-renderer-design.md`

**Two known unknowns handled explicitly below (do not guess):**
1. The signature-page **text-tag token format** lives in the Drive doc, not the repo — Task A5 starts by confirming it.
2. The exact **OAuth scope** to invoke a domain-restricted Apps Script web app is a known gotcha — Task B1 is a spike that proves it before building the route.

**Conventions:**
- `.gs` work: `cd scripts/document-generation/appsscript` before any `npx clasp push`. The user runs editor functions (no headless `clasp run`); agents push code and ask the user to run + report.
- App tests co-located in `__tests__/`. Run a single file: `npx vitest run <path>`.
- Commit after each task. Branch: `feat/sea-monkey-renderer`.

---

## File Structure

**WS1 — Apps Script** (`scripts/document-generation/appsscript/`)
- Create: `QuoteFooter.gs` — pure helpers `buildQuoteFooterRows()` + `formatBillableSummary()` (shared by both table builders; no DocumentApp dependency → unit-testable).
- Modify: `QuoteTable.gs` — `buildQuoteTableFromScratch()` adds Needed/Per/Unit columns + shared footer.
- Modify: `BocesQuote.gs` — `computeBocesQuoteTotals()` applies `count`; `buildBocesQuoteTable()` adds Needed column + shared footer.
- Modify: `Code.gs` — thread `tags` through `doPost`/`generateDocument`/`generateFullContract`.
- Modify: `MergeFields.gs` + `BocesQuote.gs` (`replaceBocesMergeFields`) — `<<BILLABLE_SUMMARY>>`.
- Modify: `SampleData.gs` — fixtures gain `count`, `adjustments`, `savings`, `gross_subtotal`, `order_total` (BOCES), multi-count line.
- Modify: `Tests.gs` — unit tests for the new pure helpers; wire into runners.

**WS2 — Templates** (manual, user's Google account): contract base + BOCES Quote base each gain a `<<BILLABLE_SUMMARY>>` paragraph.

**App** (`src/`)
- Modify: `src/features/document-generation/lib/payload-types.ts` — add `order_total` to `BocesQuotePayload.quote`.
- Modify: `src/features/document-generation/lib/payload.ts` — forward `order_total` for BOCES.
- Create: `src/features/document-generation/lib/render-apps-script.ts` — server-only `renderViaAppsScript(payload, tags)`.
- Create: `src/app/api/document-generation/render/route.ts` — POST handler.
- Modify: `src/features/document-generation/lib/render-client.ts` — add `appsScriptRenderClient`.
- Modify: `src/app/document-generator/page.tsx` — pass the real client.
- Modify: `.env.example` — document the three env vars.

---

## Phase A — Rendering fidelity (WS1 + WS2)

### Task A1: Forward `order_total` in the BOCES payload

The renderer must not recompute totals. The contract payload already carries `order_total`; the BOCES payload does not, so order-level adjustments could not total correctly. Forward it.

**Files:**
- Modify: `src/features/document-generation/lib/payload-types.ts:126-140`
- Modify: `src/features/document-generation/lib/payload.ts:50-58`
- Test: `src/features/document-generation/lib/__tests__/payload.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/document-generation/lib/__tests__/payload.test.ts`:

```ts
import { describe, it, expect } from "vitest";
import { assemblePayload } from "../payload";
import { emptyFormState } from "../payload-types";

describe("assemblePayload — BOCES order_total", () => {
  it("forwards the computed order_total on the BOCES quote payload", () => {
    const state = emptyFormState("boces_quote", "0600001");
    state.companyName = "Test BOCES";
    state.feePct = 10;
    state.lineItems = [
      { id: "r1", count: 2, sku: "BOC27-1", service: "Tutoring", description: "",
        qty: 10, unit: "Hour", listRate: 100, discountPct: 0 },
    ];
    const payload = assemblePayload(state);
    if (payload.doc_type !== "boces_quote") throw new Error("expected boces_quote");
    // subtotal = 2 * 10 * 100 = 2000; fee 10% = 200; order_total = 2200
    expect(payload.quote.order_total).toBe(2200);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/features/document-generation/lib/__tests__/payload.test.ts`
Expected: FAIL — `order_total` is `undefined` (property does not exist).

- [ ] **Step 3: Add `order_total` to the type**

In `payload-types.ts`, inside `BocesQuotePayload.quote` (currently starts at line 129), add the field after `fee_pct`:

```ts
  quote: {
    fee_pct: number;
    order_total: number;
    line_items: Array<Record<string, string | number>>;
    billable_days: number;
    billable_hours: number;
    adjustments: Array<{ label: string; type: string; mode: string; value: number; amount: number }>;
    savings: number;
    gross_subtotal: number;
  };
```

- [ ] **Step 4: Forward it in `assemblePayload`**

In `payload.ts`, in the `boces_quote` branch `quote` object (line 50), add `order_total: totals.orderTotal,` right after `fee_pct: state.feePct,`:

```ts
      quote: {
        fee_pct: state.feePct,
        order_total: totals.orderTotal,
        line_items: totals.lines.map((l) => ({ sku: l.sku ?? "", product: l.service, rate: l.listRate, qty: l.qty, count: l.count ?? 1 })),
        billable_days: totals.billableDays,
        billable_hours: totals.billableHours,
        adjustments: activeAdjustments,
        savings: totals.savings,
        gross_subtotal: totals.grossSubtotal,
      },
```

- [ ] **Step 5: Run the test to confirm it passes**

Run: `npx vitest run src/features/document-generation/lib/__tests__/payload.test.ts`
Expected: PASS.

- [ ] **Step 6: Run the full doc-gen lib suite to confirm no regressions**

Run: `npx vitest run src/features/document-generation`
Expected: PASS (existing payload-types/payload tests unaffected).

- [ ] **Step 7: Commit**

```bash
git add src/features/document-generation/lib/payload-types.ts src/features/document-generation/lib/payload.ts src/features/document-generation/lib/__tests__/payload.test.ts
git commit -m "feat(doc-gen): forward order_total on BOCES quote payload"
```

---

### Task A2: Pure footer + billable helpers (`QuoteFooter.gs`)

These are pure (no DocumentApp) so they unit-test in the editor and read clearly. `buildQuoteFooterRows` returns table rows; `formatBillableSummary` returns the summary string.

**Files:**
- Create: `scripts/document-generation/appsscript/QuoteFooter.gs`
- Modify: `scripts/document-generation/appsscript/Tests.gs`

- [ ] **Step 1: Write the helper file**

Create `scripts/document-generation/appsscript/QuoteFooter.gs`:

```javascript
/**
 * Builds the quote-table footer rows: Subtotal → extra rows (e.g. BOCES Fee) →
 * order-level adjustments → TOTAL → savings callout. Pure (no DocumentApp), so
 * both table builders share it and it is unit-testable. Each returned row is an
 * array of `numCols` strings with the label in the second-to-last cell and the
 * value in the last cell (matches the existing TOTAL-row convention).
 *
 * @param {number} numCols  number of columns in the table
 * @param {{subtotal:number,
 *          adjustments:Array<{label:string,type:string,mode:string,value:number,amount:number}>,
 *          extraRows:Array<Array<string>>,
 *          orderTotal:number,
 *          savings:number}} opts
 *   extraRows: each is a [label, value] pair inserted between Subtotal and the
 *   adjustment rows (BOCES passes its Fee row here). adjustments: discounts show
 *   as −$X, fees/taxes as +$X.
 * @returns {Array<Array<string>>}
 */
function buildQuoteFooterRows(numCols, opts) {
  var rows = [];
  function row(label, value) {
    var r = [];
    for (var i = 0; i < numCols; i++) r.push('');
    r[numCols - 2] = label;
    r[numCols - 1] = value;
    return r;
  }

  rows.push(row('Subtotal:', formatCurrency(opts.subtotal)));

  (opts.extraRows || []).forEach(function(pair) {
    rows.push(row(pair[0], pair[1]));
  });

  (opts.adjustments || []).forEach(function(a) {
    var label = a.label + (a.mode === 'percent' ? ' (' + a.value + '%)' : '');
    var sign  = a.type === 'discount' ? '−' : '+'; // − for discounts, + for fees/taxes
    rows.push(row(label + ':', sign + formatCurrency(a.amount)));
  });

  rows.push(row('TOTAL:', formatCurrency(opts.orderTotal)));

  if (opts.savings && opts.savings > 0) {
    rows.push(row("You'll save:", formatCurrency(opts.savings)));
  }
  return rows;
}

/**
 * Formats the billable-units summary line, omitting any zero unit.
 * @param {number} days
 * @param {number} hours
 * @returns {string}  e.g. "Total billable: 940 days / 40 hours" (or '' when both 0)
 */
function formatBillableSummary(days, hours) {
  var parts = [];
  if (days  > 0) parts.push(days  + (days  === 1 ? ' day'  : ' days'));
  if (hours > 0) parts.push(hours + (hours === 1 ? ' hour' : ' hours'));
  return parts.length ? 'Total billable: ' + parts.join(' / ') : '';
}
```

- [ ] **Step 2: Add unit tests to `Tests.gs`**

Append to `scripts/document-generation/appsscript/Tests.gs` (mirrors the existing throw-on-mismatch style used by `testComputeBocesQuoteTotals`):

```javascript
function testBuildQuoteFooterRows() {
  var rows = buildQuoteFooterRows(6, {
    subtotal: 459845.94,
    adjustments: [
      { label: 'Early Signing Discount', type: 'discount', mode: 'percent', value: 10, amount: 45984.59 },
    ],
    extraRows: [],
    orderTotal: 413861.35,
    savings: 46430.39,
  });
  // Subtotal, 1 adjustment, TOTAL, savings = 4 rows.
  if (rows.length !== 4) throw new Error('expected 4 footer rows, got ' + rows.length);
  if (rows[0][4] !== 'Subtotal:')   throw new Error('row0 label: ' + rows[0][4]);
  if (rows[0][5] !== '$459,845.94') throw new Error('row0 value: ' + rows[0][5]);
  if (rows[1][4] !== 'Early Signing Discount (10%):') throw new Error('row1 label: ' + rows[1][4]);
  if (rows[1][5] !== '−$45,984.59') throw new Error('row1 value: ' + rows[1][5]);
  if (rows[2][4] !== 'TOTAL:')      throw new Error('row2 label: ' + rows[2][4]);
  if (rows[3][4] !== "You'll save:") throw new Error('row3 label: ' + rows[3][4]);

  // savings omitted when 0
  var noSave = buildQuoteFooterRows(6, { subtotal: 100, adjustments: [], extraRows: [], orderTotal: 100, savings: 0 });
  if (noSave.length !== 2) throw new Error('expected 2 rows w/o savings, got ' + noSave.length);

  // extraRows (BOCES fee) inserted between subtotal and adjustments
  var withFee = buildQuoteFooterRows(5, { subtotal: 2000, adjustments: [], extraRows: [['Fee (10%):', '$200.00']], orderTotal: 2200, savings: 0 });
  if (withFee[1][3] !== 'Fee (10%):') throw new Error('fee row label: ' + withFee[1][3]);
  Logger.log('testBuildQuoteFooterRows ✓');
}

function testFormatBillableSummary() {
  if (formatBillableSummary(940, 40) !== 'Total billable: 940 days / 40 hours') throw new Error('both: ' + formatBillableSummary(940, 40));
  if (formatBillableSummary(0, 40)   !== 'Total billable: 40 hours') throw new Error('hours only: ' + formatBillableSummary(0, 40));
  if (formatBillableSummary(1, 0)    !== 'Total billable: 1 day') throw new Error('singular day: ' + formatBillableSummary(1, 0));
  if (formatBillableSummary(0, 0)    !== '') throw new Error('empty: "' + formatBillableSummary(0, 0) + '"');
  Logger.log('testFormatBillableSummary ✓');
}

function runFooterTests() {
  testBuildQuoteFooterRows();
  testFormatBillableSummary();
  Logger.log('✅ runFooterTests passed');
}
```

- [ ] **Step 3: Push to Apps Script**

Run: `cd scripts/document-generation/appsscript && npx clasp push -f`
Expected: "Pushed N files." with no errors.

- [ ] **Step 4: Ask the user to run `runFooterTests` in the editor**

Tell the user: open the Apps Script editor, run `runFooterTests`, and report the Logger output.
Expected: `✅ runFooterTests passed`. If a test throws, fix the helper and re-push.

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/QuoteFooter.gs scripts/document-generation/appsscript/Tests.gs
git commit -m "feat(doc-gen): shared quote-footer + billable-summary helpers"
```

---

### Task A3: Contract quote table — Needed/Per/Unit columns + shared footer

Rewrite `buildQuoteTableFromScratch` to the approved layout: `Service | Needed | Per | Unit | Rate | Total` (Rate = net rate, shown only when `show_pricing`), description folded into the Service cell, and the shared footer replacing the bare TOTAL row. Total per line stays `count × qty × net_rate` (already computed app-side and forwarded as `item.total`).

**Files:**
- Modify: `scripts/document-generation/appsscript/QuoteTable.gs:25-113`

- [ ] **Step 1: Replace `buildQuoteTableFromScratch`**

Replace the whole function body (lines 25–113) with:

```javascript
function buildQuoteTableFromScratch(body, quote) {
  var items     = quote.line_items;
  var showPrice = quote.show_pricing;

  // Approved layout: Service | Needed | Per | Unit | Rate | Total.
  // Rate = net_rate (post per-line discount); shown only when pricing is shown.
  // Description is folded into the Service cell (second line) to save width.
  var cols = [
    { key: 'service',  label: 'Service', include: true },
    { key: 'count',    label: 'Needed',  include: true },
    { key: 'qty',      label: 'Per',     include: true },
    { key: 'unit',     label: 'Unit',    include: true },
    { key: 'net_rate', label: 'Rate',    include: showPrice },
    { key: 'total',    label: 'Total',   include: true },
  ].filter(function(c) { return c.include; });

  // Find placeholder table (contains '[QUOTE_ROW_1_SERVICE]')
  var placeholderTable = null;
  var tableIdx = -1;
  for (var i = 0; i < body.getNumChildren(); i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.TABLE &&
        child.asTable().getText().indexOf('[QUOTE_ROW_1_SERVICE]') !== -1) {
      placeholderTable = child.asTable();
      tableIdx = i;
      break;
    }
  }
  if (!placeholderTable) {
    Logger.log('Warning: quote placeholder table not found — skipping table build');
    return;
  }

  var headerRow = cols.map(function(c) { return c.label; });
  var dataRows  = items.map(function(item) {
    return cols.map(function(col) {
      if (col.key === 'service') {
        return item.description ? item.service + '\n' + item.description : item.service;
      }
      if (col.key === 'count')    return String(item.count != null ? item.count : 1);
      if (col.key === 'qty')      return String(item.qty);
      if (col.key === 'unit')     return String(item.unit != null ? item.unit : '');
      if (col.key === 'net_rate') return formatCurrency(item.net_rate);
      if (col.key === 'total')    return formatCurrency(item.total);
      return '';
    });
  });

  // Shared footer: Subtotal (= sum of line totals) → adjustments → TOTAL → savings.
  var subtotal = 0;
  items.forEach(function(it) { subtotal += Number(it.total) || 0; });
  subtotal = round2(subtotal);
  var footerRows = buildQuoteFooterRows(cols.length, {
    subtotal:    subtotal,
    adjustments: quote.adjustments || [],
    extraRows:   [],
    orderTotal:  quote.order_total,
    savings:     quote.savings || 0,
  });

  var newTable = body.insertTable(tableIdx + 1, [headerRow].concat(dataRows).concat(footerRows));

  // Proportional column widths scaled to 540pt (8.5" − 0.5" margins each side).
  var naturalWidths = { service: 200, count: 55, qty: 50, unit: 55, net_rate: 80, total: 100 };
  var rawWidths = cols.map(function(c) { return naturalWidths[c.key] || 60; });
  var rawTotal  = rawWidths.reduce(function(s, w) { return s + w; }, 0);
  rawWidths.forEach(function(w, i) {
    newTable.setColumnWidth(i, Math.round(w / rawTotal * 540));
  });

  applyFullmindTableStyle(newTable);

  // Multi-column: reduce padding + font so content fits.
  var numRows = newTable.getNumRows();
  for (var r = 0; r < numRows; r++) {
    var trow = newTable.getRow(r);
    for (var c = 0; c < trow.getNumCells(); c++) {
      var cell = trow.getCell(c);
      cell.setPaddingLeft(5).setPaddingRight(5);
      cell.editAsText().setFontSize(9);
    }
  }

  // Bold every footer row (subtotal/adjustments/total/savings).
  for (var fr = numRows - footerRows.length; fr < numRows; fr++) {
    var frow = newTable.getRow(fr);
    for (var fc = 0; fc < frow.getNumCells(); fc++) {
      frow.getCell(fc).editAsText().setBold(true);
    }
  }

  placeholderTable.removeFromParent();
}
```

- [ ] **Step 2: Push to Apps Script**

Run: `cd scripts/document-generation/appsscript && npx clasp push -f`
Expected: "Pushed N files."

- [ ] **Step 3: Update the contract fixture to exercise count + adjustments (done fully in Task A6); for now verify with the existing fixture**

Ask the user to run `testContractFull` in the editor and report the Logger output + open the generated doc.
Expected (visual checklist): quote table shows `Service | Needed | Per | Unit | Rate | Total`; the count column is populated; footer shows Subtotal → TOTAL (adjustments/savings appear once Task A6 enriches the fixture). No `[QUOTE_ROW_1_SERVICE]` placeholder remains. Log: `✅ All merge fields resolved`.

- [ ] **Step 4: Commit**

```bash
git add scripts/document-generation/appsscript/QuoteTable.gs
git commit -m "feat(doc-gen): contract quote table — Needed/Per columns + shared footer"
```

---

### Task A4: BOCES quote table — apply `count` + Needed column + shared footer

Fix the count bug in `computeBocesQuoteTotals` and rebuild `buildBocesQuoteTable` with a Needed column and the shared footer (BOCES Fee passed as an `extraRow`; TOTAL uses the forwarded `order_total`).

**Files:**
- Modify: `scripts/document-generation/appsscript/BocesQuote.gs:9-26` (`computeBocesQuoteTotals`)
- Modify: `scripts/document-generation/appsscript/BocesQuote.gs:79-122` (`buildBocesQuoteTable`)
- Modify: `scripts/document-generation/appsscript/Tests.gs` (existing `testComputeBocesQuoteTotals`)

- [ ] **Step 1: Apply `count` in `computeBocesQuoteTotals`**

Replace the `rows` map (lines 12–19) so the line total multiplies by `count` (default 1):

```javascript
  var rows = lineItems.map(function(item) {
    var count = (item.count == null) ? 1 : item.count;
    return {
      product: item.product,
      rate:    item.rate,
      qty:     item.qty,
      count:   count,
      total:   round2(count * item.qty * item.rate),
    };
  });
```

- [ ] **Step 2: Update the existing BOCES totals unit test**

In `Tests.gs`, find `testComputeBocesQuoteTotals` and add a multi-count assertion (keep the existing single-count case). Append inside that function:

```javascript
  // count multiplies the line total: 2 × 10 × 100 = 2000, fee 10% = 200, total 2200
  var c = computeBocesQuoteTotals([{ product: 'Tutoring', rate: 100, qty: 10, count: 2 }], 10);
  if (c.subtotal !== 2000) throw new Error('count subtotal: ' + c.subtotal);
  if (c.total    !== 2200) throw new Error('count total: ' + c.total);
```

- [ ] **Step 3: Rebuild `buildBocesQuoteTable`**

Replace the function (lines 79–122) with:

```javascript
function buildBocesQuoteTable(body, quote) {
  var t = computeBocesQuoteTotals(quote.line_items, quote.fee_pct);

  var markerIdx = findParagraphIndex(body, '[BOCES_QUOTE_TABLE_INSERT]');
  if (markerIdx === -1) {
    Logger.log('Warning: [BOCES_QUOTE_TABLE_INSERT] marker not found — skipping table build');
    return;
  }

  // Columns: Product | Needed | Hours | Hourly Rate | Total. (Needed = count.)
  var headerRow = ['Product', 'Needed', 'Hours', 'Hourly Rate', 'Total'];
  var dataRows  = t.rows.map(function(r) {
    return [r.product, String(r.count), String(r.qty), formatCurrency(r.rate), formatCurrency(r.total)];
  });

  // Footer: Subtotal → Fee (extraRow) → adjustments → TOTAL (forwarded order_total) → savings.
  var footerRows = buildQuoteFooterRows(headerRow.length, {
    subtotal:    t.subtotal,
    adjustments: quote.adjustments || [],
    extraRows:   [['Fee (' + round2(t.feePct) + '%):', formatCurrency(t.fee)]],
    orderTotal:  (quote.order_total != null) ? quote.order_total : t.total,
    savings:     quote.savings || 0,
  });

  var allRows = [headerRow].concat(dataRows).concat(footerRows);
  var newTable = body.insertTable(markerIdx + 1, allRows);

  var naturalWidths = [200, 60, 70, 100, 110];
  var rawTotal = naturalWidths.reduce(function(s, w) { return s + w; }, 0);
  naturalWidths.forEach(function(w, i) {
    newTable.setColumnWidth(i, Math.round(w / rawTotal * 540));
  });

  applyFullmindTableStyle(newTable);

  // Bold every footer row.
  var n = newTable.getNumRows();
  for (var fr = n - footerRows.length; fr < n; fr++) {
    var frow = newTable.getRow(fr);
    for (var fc = 0; fc < frow.getNumCells(); fc++) {
      frow.getCell(fc).editAsText().setBold(true);
    }
  }

  body.getChild(markerIdx).removeFromParent();
}
```

- [ ] **Step 4: Push + run unit test**

Run: `cd scripts/document-generation/appsscript && npx clasp push -f`
Ask the user to run `runBocesTests` in the editor.
Expected: passes, including the new count assertion.

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/BocesQuote.gs scripts/document-generation/appsscript/Tests.gs
git commit -m "feat(doc-gen): BOCES table applies count + shared footer (order_total)"
```

---

### Task A5: Thread `tags` mode + strip signature text tags

The web app receives a top-level `tags` boolean. `tags:true` (default) keeps signature-page text tags (eSign-ready); `tags:false` strips them but keeps the blank signature lines.

**Files:**
- Modify: `scripts/document-generation/appsscript/Code.gs:5-54`
- Modify: `scripts/document-generation/appsscript/AppendedSections.gs` (signature append)
- Create helper in: `scripts/document-generation/appsscript/Utils.gs`

- [ ] **Step 1: CONFIRM the text-tag format (do not guess)**

Ask the user to open the signature-page Google Doc (Drive ID `1ZJXvBthwn3Ggc4FphDIi76mYksD_qQj3UHa0qHUipLQ`, "Signature page") and report: (a) the exact tag tokens present (e.g. `\s1\`, `\d1\`), and (b) whether they are already hidden (white / 1pt) text. Record the answer here before writing the regex. The memory `project_esign_approach` documents `\s1\` and `\d1\`; confirm against the live doc.

- [ ] **Step 2: Add a strip helper to `Utils.gs`**

Using the confirmed token format, append to `Utils.gs`. Default assumes the documented `\<letter><digits>\` form — **adjust the regex if Step 1 shows a different format**:

```javascript
/**
 * Removes Dropbox Sign text-tag tokens from the document body, leaving the
 * surrounding signature lines intact. Used for the "manual / clean" render
 * (tags:false). Token format confirmed against the signature-page doc:
 * backslash-delimited, e.g. \s1\ (signature) and \d1\ (date).
 * @param {GoogleAppsScript.Document.Body} body
 */
function stripSignatureTextTags(body) {
  body.replaceText('\\\\[a-zA-Z]+[0-9]*\\\\', '');
}
```

Note: `replaceText` takes a RE2 pattern string; `\\\\` matches one literal backslash.

- [ ] **Step 3: Thread `tags` through the orchestrators in `Code.gs`**

Update `doPost`, `generateDocument`, and `generateFullContract` to read and pass `tags` (default `true`):

```javascript
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result  = generateDocument(payload);
    return ContentService.createTextOutput(JSON.stringify(result)).setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService.createTextOutput(JSON.stringify({ success: false, error: err.message })).setMimeType(ContentService.MimeType.JSON);
  }
}

function generateDocument(payload) {
  var docType = payload.doc_type || 'contract';
  if (docType === 'boces_quote') {
    return generateBocesQuote(payload); // BOCES has no signature page — tags N/A
  }
  return generateFullContract(payload);
}
```

In `generateFullContract`, after `handleAppendedSections(doc, payload.sections, props);` (line 54) and before the second `replaceMergeFields` pass, add:

```javascript
    // tags defaults to true (eSign-ready). tags:false strips the signature-page
    // text tags for a clean, printable manual copy.
    if (payload.tags === false) {
      stripSignatureTextTags(body);
    }
```

- [ ] **Step 4: Push + verify both modes**

Run: `cd scripts/document-generation/appsscript && npx clasp push -f`
Ask the user to run `testContractFull` (which uses the default — confirm it still has tags), then in the editor run `generateFullContract(Object.assign({}, PAYLOAD_FULL, { tags: false }))` and open the doc.
Expected: with `tags:false`, the signature page shows blank lines and no `\s1\`/`\d1\` tokens; with the default, tokens remain.

- [ ] **Step 5: Commit**

```bash
git add scripts/document-generation/appsscript/Code.gs scripts/document-generation/appsscript/Utils.gs
git commit -m "feat(doc-gen): tags on/off render mode (strip signature text tags)"
```

---

### Task A6: `<<BILLABLE_SUMMARY>>` merge field + enriched fixtures + templates (WS2)

**Files:**
- Modify: `scripts/document-generation/appsscript/MergeFields.gs:7-52`
- Modify: `scripts/document-generation/appsscript/BocesQuote.gs:44-70` (`replaceBocesMergeFields`)
- Modify: `scripts/document-generation/appsscript/SampleData.gs`
- Manual (WS2): contract + BOCES base templates

- [ ] **Step 1: Add the merge field to the contract `replaceMergeFields`**

In `MergeFields.gs`, add to the `fields` map (after `<<ORDER_TOTAL>>`, line 32):

```javascript
    '<<BILLABLE_SUMMARY>>': formatBillableSummary(q.billable_days || 0, q.billable_hours || 0),
```

- [ ] **Step 2: Add it to `replaceBocesMergeFields`**

In `BocesQuote.gs`, `replaceBocesMergeFields` needs `payload.quote`. Update the signature usage so it reads quote billable fields. Add to the `fields` map (after `<<today>>`):

```javascript
    '<<BILLABLE_SUMMARY>>': formatBillableSummary(
      (payload.quote && payload.quote.billable_days)  || 0,
      (payload.quote && payload.quote.billable_hours) || 0),
```

- [ ] **Step 3: Enrich the SampleData fixtures**

In `SampleData.gs`, update `PAYLOAD_FULL.quote` to include a multi-count line and order-level data so editor tests exercise every new path. Add `count` to each line item, and add the quote-level fields. Example edits to `PAYLOAD_FULL.quote`:

```javascript
  quote: {
    include: true,
    show_pricing: true,
    line_items: [
      { sku: 'EK27-1', service: 'Standard Educator — Full Time', description: 'Live streaming instruction',
        count: 5, qty: 180, unit: 'days', list_rate: 500.23, discount_pct: 0, net_rate: 500.23, total: 450207.00 },
      { sku: 'EK27-2', service: 'Credit Recovery — Small Group', description: '',
        count: 1, qty: 40, unit: 'hrs', list_rate: 111.42, discount_pct: 10, net_rate: 100.28, total: 4011.20 },
      { sku: 'FEE-1', service: 'Staffing Fee', description: '',
        count: 1, qty: 1, unit: 'flat', list_rate: 5627.54, discount_pct: 0, net_rate: 5627.54, total: 5627.54 },
    ],
    min_amt: 5627.54,
    max_amt: 459845.94,
    order_total: 413861.35,
    billable_days: 900,
    billable_hours: 40,
    adjustments: [
      { label: 'Early Signing Discount', type: 'discount', mode: 'percent', value: 10, amount: 45984.59 },
    ],
    savings: 46430.39,
    gross_subtotal: 460291.74,
  },
```

Also add `count` to the BOCES fixtures' line items (`PAYLOAD_BOCES_QUOTE` and the contract `PAYLOAD_BOCES`) and an `order_total` to `PAYLOAD_BOCES_QUOTE.quote` so the BOCES footer renders. Use existing rate/qty with `count: 1` unless testing multi-count.

- [ ] **Step 4: Push**

Run: `cd scripts/document-generation/appsscript && npx clasp push -f`

- [ ] **Step 5: WS2 — edit the templates (manual, user's Google account)**

Ask the user to:
1. Open the contract base template (`Fullmind_Contract_Template_v1`, Drive ID `1fWtRoml___H8w9Ke0I5H_qS5MdkZQoe7pYEVkQi2zhQ`) and add a paragraph containing `<<BILLABLE_SUMMARY>>` near the budget parameters.
2. Open the BOCES Quote base template (Drive ID `1vxe5fwoG2nbqTCNotnmxmUOPbwcykNfRTLFZ8nJQQMM`) and add the same `<<BILLABLE_SUMMARY>>` paragraph.

- [ ] **Step 6: Full editor verification**

Ask the user to run, in the editor, and report results + open each doc:
- `runFooterTests`, `runBocesTests` (unit)
- `testContractFull` — verify Needed/Per columns, the Early Signing Discount footer row, "You'll save $46,430.39", and the billable line "Total billable: 900 days / 40 hours". Log `✅ All merge fields resolved`.
- `testBocesQuote` + `testDocTypeRouting` — verify BOCES Needed column, Fee row, TOTAL, billable line.
- `testContractBOCES` (regression).

- [ ] **Step 7: Commit**

```bash
git add scripts/document-generation/appsscript/MergeFields.gs scripts/document-generation/appsscript/BocesQuote.gs scripts/document-generation/appsscript/SampleData.gs
git commit -m "feat(doc-gen): BILLABLE_SUMMARY merge field + enriched sample payloads"
```

---

## Phase B — App wiring (WS3)

### Task B1: Service-account auth spike (prove token → 200 from `/exec`)

De-risk the unknown scope before building the route. This is a throwaway proof, not shipped code.

**Files:**
- Create (temporary): `scripts/document-generation/auth-spike.mjs`

- [ ] **Step 1: Confirm the manual prerequisites are done**

Ask the user to confirm: (a) a GCP service account exists with a JSON key, (b) domain-wide delegation is enabled and authorized in the Workspace Admin console for a chosen subject (e.g. a fullmind user), and (c) the web app deployment access = "anyone within fullmindlearning.com", execute-as-owner. Collect: service-account client email, private key, impersonated subject email, deployment `/exec` URL.

- [ ] **Step 2: Write the spike**

Create `scripts/document-generation/auth-spike.mjs` (reads creds from env so nothing secret is committed):

```js
import { google } from "googleapis";

const SCOPES = [
  // Candidate scopes — adjust until /exec returns 200. Start broad, then narrow.
  "https://www.googleapis.com/auth/drive",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

const jwt = new google.auth.JWT({
  email: process.env.RENDER_SA_EMAIL,
  key: process.env.RENDER_SA_KEY.replace(/\\n/g, "\n"),
  subject: process.env.RENDER_SUBJECT,
  scopes: SCOPES,
});

const { token } = await jwt.getAccessToken();
const res = await fetch(process.env.RENDER_URL, {
  method: "POST",
  headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify({ doc_type: "contract", tags: false, ping: true }),
  redirect: "follow",
});
console.log("status", res.status);
console.log((await res.text()).slice(0, 500));
```

- [ ] **Step 3: Run it**

Run (user supplies env inline):
```bash
RENDER_SA_EMAIL=... RENDER_SA_KEY="..." RENDER_SUBJECT=... RENDER_URL="https://script.google.com/.../exec" node scripts/document-generation/auth-spike.mjs
```
Expected: HTTP `200` with a JSON body (it will be an error about the ping payload, which is fine — a 200 proves auth works). If you get `401`/`403` or an HTML login page, iterate on `SCOPES` (try adding the script's own scopes) and re-run.

- [ ] **Step 4: Record the working scope set here, then delete the spike**

Write the confirmed `SCOPES` into this task's notes. Then:
```bash
rm scripts/document-generation/auth-spike.mjs
```
(No commit — the spike is never checked in.)

---

### Task B2: `renderViaAppsScript` server lib

**Files:**
- Create: `src/features/document-generation/lib/render-apps-script.ts`
- Test: `src/features/document-generation/lib/__tests__/render-apps-script.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getAccessToken = vi.fn();
vi.mock("googleapis", () => ({
  google: { auth: { JWT: vi.fn().mockImplementation(() => ({ getAccessToken })) } },
}));

import { renderViaAppsScript } from "../render-apps-script";

describe("renderViaAppsScript", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    getAccessToken.mockResolvedValue({ token: "tok-123" });
    process.env.GOOGLE_DOC_RENDER_URL = "https://script.google.com/x/exec";
    process.env.GOOGLE_DOC_RENDER_SA_EMAIL = "sa@proj.iam.gserviceaccount.com";
    process.env.GOOGLE_DOC_RENDER_SA_KEY = "-----KEY-----";
    process.env.GOOGLE_DOC_RENDER_SUBJECT = "rep@fullmindlearning.com";
  });

  it("POSTs payload+tags with a bearer token and maps url→docUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "https://docs.google.com/document/d/REAL/edit", docId: "REAL" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renderViaAppsScript({ doc_type: "contract" } as never, false);

    expect(result).toEqual({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://script.google.com/x/exec");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
    expect(JSON.parse(opts.body)).toMatchObject({ doc_type: "contract", tags: false });
  });

  it("passes through agreementUrl when present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "u", agreementUrl: "a" }),
    }));
    const r = await renderViaAppsScript({ doc_type: "boces_quote" } as never, true);
    expect(r).toEqual({ docUrl: "u", agreementUrl: "a" });
  });

  it("throws when the script reports success:false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: false, error: "boom" }),
    }));
    await expect(renderViaAppsScript({ doc_type: "contract" } as never, true)).rejects.toThrow(/boom/);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/features/document-generation/lib/__tests__/render-apps-script.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the lib**

Create `src/features/document-generation/lib/render-apps-script.ts` (use the SCOPES confirmed in Task B1):

```ts
import "server-only";
import { google } from "googleapis";
import type { DocPayload, RenderResult } from "./payload-types";

// Scopes confirmed by the Task B1 auth spike to invoke the domain-restricted web app.
const SCOPES = [
  "https://www.googleapis.com/auth/drive",
  "openid",
  "https://www.googleapis.com/auth/userinfo.email",
];

function requireEnv(name: string): string {
  const v = process.env[name];
  if (!v) throw new Error(`Missing required env var: ${name}`);
  return v;
}

/** Mints a service-account OAuth token (domain-wide delegation) and POSTs the
 *  payload to the deployed Apps Script web app, returning the doc URL. */
export async function renderViaAppsScript(payload: DocPayload, tags: boolean): Promise<RenderResult> {
  const jwt = new google.auth.JWT({
    email: requireEnv("GOOGLE_DOC_RENDER_SA_EMAIL"),
    key: requireEnv("GOOGLE_DOC_RENDER_SA_KEY").replace(/\\n/g, "\n"),
    subject: requireEnv("GOOGLE_DOC_RENDER_SUBJECT"),
    scopes: SCOPES,
  });
  const { token } = await jwt.getAccessToken();
  if (!token) throw new Error("Failed to mint service-account access token");

  const res = await fetch(requireEnv("GOOGLE_DOC_RENDER_URL"), {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ ...payload, tags }),
    redirect: "follow",
  });
  if (!res.ok) throw new Error(`Renderer returned HTTP ${res.status}`);

  const data = (await res.json()) as { success: boolean; url?: string; agreementUrl?: string; error?: string };
  if (!data.success || !data.url) throw new Error(`Renderer failed: ${data.error ?? "unknown error"}`);

  return data.agreementUrl ? { docUrl: data.url, agreementUrl: data.agreementUrl } : { docUrl: data.url };
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/features/document-generation/lib/__tests__/render-apps-script.test.ts`
Expected: PASS (all three cases).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/render-apps-script.ts src/features/document-generation/lib/__tests__/render-apps-script.test.ts
git commit -m "feat(doc-gen): renderViaAppsScript server lib (service-account auth)"
```

---

### Task B3: API route `/api/document-generation/render`

**Files:**
- Create: `src/app/api/document-generation/render/route.ts`
- Test: `src/app/api/document-generation/render/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
import { describe, it, expect, vi, beforeEach } from "vitest";

const getUser = vi.fn();
const renderViaAppsScript = vi.fn();
vi.mock("@/lib/supabase/server", () => ({ getUser }));
vi.mock("@/features/document-generation/lib/render-apps-script", () => ({ renderViaAppsScript }));

import { POST } from "../route";

function req(body: unknown) {
  return new Request("http://localhost/api/document-generation/render", {
    method: "POST", body: JSON.stringify(body), headers: { "Content-Type": "application/json" },
  });
}

describe("POST /api/document-generation/render", () => {
  beforeEach(() => { vi.clearAllMocks(); });

  it("401s when unauthenticated", async () => {
    getUser.mockResolvedValue(null);
    const res = await POST(req({ payload: { doc_type: "contract" }, tags: true }));
    expect(res.status).toBe(401);
  });

  it("returns the rendered doc url for an authed rep", async () => {
    getUser.mockResolvedValue({ id: "u1" });
    renderViaAppsScript.mockResolvedValue({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    const res = await POST(req({ payload: { doc_type: "contract" }, tags: false }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    expect(renderViaAppsScript).toHaveBeenCalledWith({ doc_type: "contract" }, false);
  });

  it("400s when payload is missing", async () => {
    getUser.mockResolvedValue({ id: "u1" });
    const res = await POST(req({ tags: true }));
    expect(res.status).toBe(400);
  });

  it("500s when the renderer throws", async () => {
    getUser.mockResolvedValue({ id: "u1" });
    renderViaAppsScript.mockRejectedValue(new Error("boom"));
    const res = await POST(req({ payload: { doc_type: "contract" }, tags: true }));
    expect(res.status).toBe(500);
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/app/api/document-generation/render/__tests__/route.test.ts`
Expected: FAIL — module not found.

- [ ] **Step 3: Implement the route**

Create `src/app/api/document-generation/render/route.ts`:

```ts
// POST /api/document-generation/render — render a document via the deployed Apps Script.
// Body: { payload: DocPayload, tags: boolean }. Returns { docUrl, agreementUrl? }.
import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { renderViaAppsScript } from "@/features/document-generation/lib/render-apps-script";
import type { DocPayload } from "@/features/document-generation/lib/payload-types";

export const dynamic = "force-dynamic";

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

    const body = (await request.json()) as { payload?: DocPayload; tags?: boolean };
    if (!body.payload || !body.payload.doc_type) {
      return NextResponse.json({ error: "Missing payload" }, { status: 400 });
    }

    const result = await renderViaAppsScript(body.payload, body.tags === true);
    return NextResponse.json(result);
  } catch (error) {
    console.error("Document render error:", error);
    return NextResponse.json({ error: "Failed to render document" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/app/api/document-generation/render/__tests__/route.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/document-generation/render/route.ts src/app/api/document-generation/render/__tests__/route.test.ts
git commit -m "feat(doc-gen): /api/document-generation/render route"
```

---

### Task B4: `appsScriptRenderClient` (client → route)

**Files:**
- Modify: `src/features/document-generation/lib/render-client.ts`
- Test: `src/features/document-generation/lib/__tests__/render-client.test.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/features/document-generation/lib/__tests__/render-client.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from "vitest";
import { appsScriptRenderClient } from "../render-client";

afterEach(() => vi.restoreAllMocks());

describe("appsScriptRenderClient", () => {
  it("POSTs payload+tags to the render route and returns the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ docUrl: "https://docs.google.com/document/d/REAL/edit" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await appsScriptRenderClient({ doc_type: "contract" } as never, { tags: true });

    expect(result.docUrl).toBe("https://docs.google.com/document/d/REAL/edit");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/document-generation/render");
    expect(JSON.parse(opts.body)).toEqual({ payload: { doc_type: "contract" }, tags: true });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(appsScriptRenderClient({ doc_type: "contract" } as never, { tags: false })).rejects.toThrow();
  });
});
```

- [ ] **Step 2: Run it to confirm it fails**

Run: `npx vitest run src/features/document-generation/lib/__tests__/render-client.test.ts`
Expected: FAIL — `appsScriptRenderClient` is not exported.

- [ ] **Step 3: Add the client (keep the stub for tests/dev)**

Append to `src/features/document-generation/lib/render-client.ts`:

```ts
/** Real renderer: POSTs to the app's render route, which calls the Apps Script. */
export const appsScriptRenderClient: RenderClient = async (payload, opts) => {
  const res = await fetch("/api/document-generation/render", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ payload, tags: opts.tags }),
  });
  if (!res.ok) throw new Error(`Render failed: HTTP ${res.status}`);
  return (await res.json()) as Awaited<ReturnType<RenderClient>>;
};
```

- [ ] **Step 4: Run the test to confirm it passes**

Run: `npx vitest run src/features/document-generation/lib/__tests__/render-client.test.ts`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/render-client.ts src/features/document-generation/lib/__tests__/render-client.test.ts
git commit -m "feat(doc-gen): appsScriptRenderClient (calls render route)"
```

---

### Task B5: Wire the real client into the page + document env

**Files:**
- Modify: `src/app/document-generator/page.tsx:82`
- Modify: `.env.example`

- [ ] **Step 1: Pass the real client to the modal**

In `page.tsx`, import the client and pass it:

```tsx
import { appsScriptRenderClient } from "@/features/document-generation/lib/render-client";
```

Change line 82 from:

```tsx
      {open && detail && <GenerateDocumentModal prefill={prefill} onClose={() => setOpen(false)} />}
```

to:

```tsx
      {open && detail && (
        <GenerateDocumentModal prefill={prefill} onClose={() => setOpen(false)} renderClient={appsScriptRenderClient} />
      )}
```

- [ ] **Step 2: Document the env vars**

Add to `.env.example`:

```
# Sea Monkey document renderer (Apps Script web app, service-account auth)
GOOGLE_DOC_RENDER_URL=
GOOGLE_DOC_RENDER_SA_EMAIL=
GOOGLE_DOC_RENDER_SA_KEY=
GOOGLE_DOC_RENDER_SUBJECT=
```

- [ ] **Step 3: Typecheck + run the doc-gen suite**

Run: `npx tsc --noEmit` (or the project's typecheck script) and `npx vitest run src/features/document-generation src/app/api/document-generation`
Expected: clean typecheck; all tests pass.

- [ ] **Step 4: Commit**

```bash
git add src/app/document-generator/page.tsx .env.example
git commit -m "feat(doc-gen): wire real render client into the dev route + env docs"
```

---

### Task B6: End-to-end manual verification

- [ ] **Step 1: Ensure the four env vars are set in `.env.local`** (values from Task B1). Restart `npm run dev` (port 3005) so the route picks them up.

- [ ] **Step 2: Drive the flow**

Open `http://localhost:3005/document-generator`, build a quote with a multi-count line + an order-level discount, click **Generate document**. Confirm a real Google Doc opens (not a `STUB-…` URL) and renders: Needed/Per columns, the adjustment footer row, "You'll save", and the billable line. Click **Open Google Doc (manual)** and confirm the re-render has no `\s1\`/`\d1\` tokens.

- [ ] **Step 3: BOCES path**

Repeat with a BOCES quote (the dev harness `docType` is `contract`; temporarily set the prefill `docType` to `boces_quote`, or use the modal's doc-type selector if present) and confirm the BOCES table + Fee row + TOTAL render from the real doc.

- [ ] **Step 4: Report results** (no commit — this is verification). If anything fails, debug with `superpowers:systematic-debugging`.

---

## Self-Review

**Spec coverage:**
- Count×qty line display → A3 (contract), A4 (BOCES). ✓
- Order-level adjustments footer → A2 (helper), A3/A4 (render). ✓
- Savings callout → A2/A3/A4. ✓
- Gross subtotal anchor → savings is forwarded; subtotal computed from line totals in A3, `t.subtotal` in A4. ✓
- Billable summary → A6 (`<<BILLABLE_SUMMARY>>` + helper in A2). ✓
- Tags on/off → A5. ✓
- Both doc types → A3 + A4. ✓
- App wiring (route + client + service-account auth) → B2/B3/B4/B5. ✓
- BOCES `order_total` forwarding (renderer stays pure) → A1. ✓
- Out of scope (eSign send, section subtotals, URL persistence) → not present. ✓

**Placeholder scan:** No TBD/TODO. The two genuine unknowns are handled by verification steps (A5 Step 1 confirms the tag regex; B1 spike confirms the OAuth scopes) rather than guessed code. ✓

**Type/name consistency:** `buildQuoteFooterRows(numCols, opts)` and `formatBillableSummary(days, hours)` are defined in A2 and called identically in A3/A4/A6. `renderViaAppsScript(payload, tags)` defined in B2, called in B3. `appsScriptRenderClient` defined in B4, used in B5. Env var names (`GOOGLE_DOC_RENDER_URL/_SA_EMAIL/_SA_KEY/_SUBJECT`) match across B2/B5. ✓
