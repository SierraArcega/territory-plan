# Sea Monkey Renderer (SP1) — Design

**Date:** 2026-06-08
**Branch:** `feat/sea-monkey-renderer`
**Status:** Approved (brainstorm), pending implementation plan
**Predecessors:** Generate Document form (PR #265, merged), BOCES Quote doc type (PR #261, merged), Sea Monkey PoC (PR #254, merged)

## Background

The Generate Document **form** ships and emits a rich JSON payload, but the app's
"Render document" action calls `stubRenderClient`, which returns a fake URL
(`https://docs.google.com/document/d/STUB-…/edit`). The deployed Apps Script web
app *already returns a real Google Doc URL* (`generateFullContract` /
`generateBocesQuote` → `{ success, url, docId }`); the stub is hiding **missing
app-side wiring**, not a missing renderer.

Separately, the deployed renderer does **not** consume several fields the form now
emits. The headline issue: the form computes each line as
`total = count × qty × netRate`, but `buildQuoteTableFromScratch` renders only a
single `qty` column and ignores `count` — so any line with `count > 1` (e.g.
5 educators × 180 days) renders the wrong quantity next to its total **today**.

The goal of this sub-project: make the Apps Script + Google Doc faithfully receive
and render the **full payload** the form emits (no dropped fields), and replace the
stub with a real client. We are **not** matching PandaDoc; the recent test output
(Google Doc `1hvDRV9ZiGVg…`) is the look to land on, extended to carry the fuller
payload. The Quote Table is the main area of variance.

## Scope

**In scope** — one spec, three workstreams, **both doc types** (`contract` and
`boces_quote`):

1. **WS1 — Apps Script `.gs`**: quote-table count×qty columns, order-level
   adjustment footer, savings callout, billable summary, `tags` on/off mode.
2. **WS2 — Google Doc templates**: new `<<BILLABLE_SUMMARY>>` placeholder
   (manual edits in the user's Google account).
3. **WS3 — App wiring**: API route + real `RenderClient` that authenticates via
   a service account (domain-wide delegation) and POSTs the payload to the
   deployed web app.

**Out of scope** (deferred):

- **Dropbox Sign delivery** ("Send for signature", re-fire existing URL) — its own
  SP4. The `tags` mode is plumbed here so SP4 can use it, but no send happens.
- **Per-line section subtotals** ("Total Educator Costs" / "Total Fees"). Decided
  during brainstorm: line items are one flat table; "Staffing Fee" is a normal SKU,
  not a separate fee section. The only fees that get their own footer line are
  *order-level* `fee`/`tax` adjustments. No per-line category, no form change.
- **Persisting generated doc URLs** — SP4 owns that data-model question.

## Payload coverage matrix

What the form emits vs. what the deployed `.gs` consumes today:

| Field | Consumed today? | Action |
|---|---|---|
| `deal.*`, `payment.*`, `sections.*` | ✅ merge fields | — |
| `quote.min_amt` / `max_amt` / `order_total` | ✅ `<<min_amt>>` / `<<max_amt>>` / `<<ORDER_TOTAL>>` | — |
| line `service` / `description` / `qty` / `unit` / `list_rate` / `discount_pct` / `net_rate` / `total` | ✅ table columns | — |
| **line `count`** | ❌ ignored | WS1: render `Needed` column; total stays `count × qty × netRate` |
| **`quote.adjustments[]`** | ❌ ignored | WS1: footer rows |
| **`quote.savings`** | ❌ ignored | WS1: "You'll save $X" callout |
| **`quote.gross_subtotal`** | ❌ ignored | WS1: anchors subtotal/savings |
| **`quote.billable_days` / `billable_hours`** | ❌ no template home | WS1+WS2: `<<BILLABLE_SUMMARY>>` line |
| **`tags` render mode** | ❌ always baked in | WS1: strip text tags when `tags:false` |

## WS1 — Apps Script `.gs` changes

Files: `scripts/document-generation/appsscript/`.

### Quote table (the main variance)

Applies to **both** `buildQuoteTableFromScratch` (contract, `QuoteTable.gs`) and
`buildBocesQuoteTable` (`BocesQuote.gs`).

**Line rows — explicit Count / Per columns:**

```
Service           Needed  Per   Unit   Rate       Total
-------------------------------------------------------
Standard Educator    5    180   days  $500.23   $450,207.00
Credit Recovery      1     40   hrs   $100.28     $4,011.20
Staffing Fee         1      1   flat  $5,627.54   $5,627.54
```

- Add a **`Needed`** column (from line `count`) and a **`Per`** column (from `qty`)
  alongside `Unit`. Line `total` remains `count × qty × netRate`. This fixes the
  current bug where `count > 1` showed the wrong quantity beside its total.
- Column widths re-proportioned to fit 540pt content width (8.5" − 0.5" margins
  each side), preserving the existing 9pt font / 5pt padding for multi-column fit.
- `show_pricing: false` continues to hide rate/discount columns (existing behavior).

**Footer block** (replaces the bare `TOTAL:` row):

```
                          Subtotal:        $459,845.94
        Early Signing Discount (10%):       −$45,984.59   ← per adjustment
                             TOTAL:        $413,861.35
                   You'll save $46,430.39                 ← when savings > 0
```

- `Subtotal` = sum of line totals (post per-line discount).
- One row per **order-level adjustment** (`quote.adjustments[]`): discounts shown
  as `−$X`, fees/taxes as `+$X`, each with its label and (for percent mode) the
  percentage. BOCES keeps its existing `fee_pct` row.
- `TOTAL` = `quote.order_total`.
- **"You'll save $X"** callout from `quote.savings`, rendered only when `> 0`.

**Shared footer helper:** extract a single helper that renders the
subtotal → adjustments → total → savings block, called by both the contract and
BOCES table builders, so the two cannot drift (per CLAUDE.md "mirror logic =
extract a helper"). BOCES-specific bits (the fee row) compose with it.

### Billable summary

- New merge field `<<BILLABLE_SUMMARY>>` populated from `quote.billable_days` /
  `quote.billable_hours`, e.g. `Total billable: 940 days / 40 hours` (omit a unit
  when its count is 0). Rendered near the budget parameters.

### Tags mode

- `doPost` reads a top-level `tags` boolean (default `true` for back-compat) and
  threads it to the orchestrators.
- `tags: true` — current behavior: signature-page text tags (`\s1\`, `\d1\`) baked
  in, eSign-ready.
- `tags: false` — **strip the text tags but keep the blank signature lines** so the
  doc is a clean, printable contract. (Confirmed during brainstorm: keep-but-clean,
  not omit the page.)

### Sample data

- Update `SampleData.gs` fixtures (`PAYLOAD_FULL`, BOCES fixtures) to include
  `count`, `adjustments[]`, `savings`, `gross_subtotal`, and a multi-`count` line,
  so editor test functions exercise the new code paths.

## WS2 — Google Doc template changes (manual, user's Google account)

- Add a `<<BILLABLE_SUMMARY>>` placeholder paragraph to the **contract base
  template** and the **BOCES Quote base template** (near budget parameters).
- The quote table is built from scratch in code, so no table placeholders change.
- Workflow mirrors the BOCES Quote asset work: edit in the user's account, then
  `npx clasp push` for the `.gs` from `scripts/document-generation/appsscript/`.

## WS3 — App wiring (replaces the stub)

- **API route**: `src/app/api/document-generation/render/route.ts`. Accepts
  `{ payload, tags }`, mints a **service-account OAuth access token** (domain-wide
  delegation, impersonating a designated fullmind identity), POSTs to the deployed
  web app `/exec` with `Authorization: Bearer <token>`, parses `{ success, url,
  docId, agreementUrl? }`, and returns `{ docUrl, agreementUrl? }`. Surfaces
  upstream `success: false` as an error.
- **Real `RenderClient`**: replace `stubRenderClient` with a client that POSTs to
  this route and honors `opts.tags`. Keep the `RenderClient` type unchanged so the
  form/modal need no edits beyond swapping the default client.
- **Deployment**: web app stays **execute-as-owner, access = anyone within
  fullmindlearning.com**. Output docs land in the fixed `_output` Drive folder
  regardless of caller.
- **Secrets / env**: service-account JSON key, impersonated subject, and deployment
  `/exec` URL as env vars (e.g. `GOOGLE_DOC_RENDER_SA_KEY`,
  `GOOGLE_DOC_RENDER_SUBJECT`, `GOOGLE_DOC_RENDER_URL`). Documented in
  `.env.example`.

## Testing

- **Editor (user runs — clasp cannot run editor functions headlessly):**
  `testContractFull`, `testContractBOCES`, `testBocesQuote`, `testDocTypeRouting`
  against the updated fixtures. Visual check: Count/Per columns, adjustment footer,
  savings callout, billable line, and `tags:false` clean signature page.
- **App (vitest, co-located `__tests__/`):** the route handler and `RenderClient`
  with the token mint + fetch mocked — assert payload/tags pass-through, response
  mapping (`url`→`docUrl`, `agreementUrl`), and error handling on `success:false`
  / non-200.

## Manual prerequisites (user's Google account / GCP)

1. Create a GCP **service account**; enable **domain-wide delegation**; authorize
   the required scopes in the Workspace Admin console for the impersonated subject.
2. Set the web-app deployment to **execute-as-owner, access = anyone within
   domain**.
3. Edit the two base templates to add `<<BILLABLE_SUMMARY>>`; `clasp push` the
   `.gs`; run the editor test functions.

## Build order

1. **WS1 + WS2** — rendering fidelity, verified via editor test functions against
   updated fixtures (no app wiring needed, mirrors how BOCES was built).
2. **WS3** — API route + service-account auth + real `RenderClient`.
3. **End-to-end** — verify "Render document" from `/document-generator` produces a
   real doc with the full payload rendered.

## Decisions log (from brainstorm)

- One spec = fidelity (WS1+WS2) + wiring (WS3); eSign delivery deferred to SP4.
- Quote table uses **explicit Count / Per / Unit columns** (not a composite cell
  or effective-qty-only).
- **No per-line section subtotals**; flat line-item table + order footer only.
- **Service-account OAuth (domain-wide delegation)** for server→web-app auth (not
  an "Anyone + shared secret" deployment, not the rep's per-user Google token).
- **Billable units rendered** as a scope/summary line (`<<BILLABLE_SUMMARY>>`).
- `tags:false` keeps the signature page but strips text tags (clean/printable).
