# FY27 BOCES Quote — Document Type Design

**Date:** 2026-06-04
**Status:** Approved for implementation
**Branch:** `feat/boces-quote-doc-type`
**Project:** Sea Monkey (Fullmind contract generation pipeline)

---

## Overview

A second document type — **FY27 BOCES Quote** — generatable from the same Google
Apps Script web app that produces the full Fullmind contract. It is a
**quote-only** document: no signature page, no Dropbox Sign, no `auto_send`
branch. A rep generates it and sends it as a Google Doc / PDF; the legal
signing (the BOCES Master License & Service Agreement) happens separately on the
BOCES/RIC side.

This sits alongside the existing full-contract pipeline (PR #254, merged to
`main` 2026-06-04). Both document types are selectable from one web-app entry
point.

### Related rename (no code impact)

The base contract template Google Doc will be renamed
`Fullmind_Contract_Template_v1` → **"FY27 - Contract Template - All Services"**.
This is safe: the Apps Script references it only by Drive file ID
(`TEMPLATE_BASE_ID` in `Config.gs`, via `DriveApp.getFileById`), never by name,
and the generated output name is built from payload data — not the template
name. No code change required for the rename.

---

## Document Anatomy

Top to bottom, the BOCES Quote contains:

| # | Element | Source |
|---|---------|--------|
| 1 | Fixed title **"Quote for Fullmind Services"** | Baked into base template |
| 2 | **Quote #** + Start Date + End Date | `<<quote_number>>`, `<<start_date>>`, `<<end_date>>` merge fields |
| 3 | **"Anticipated Educator Need"** quote table | New `buildBocesQuoteTable()` |
| 4 | **BOCES Payment Terms** (single fixed block) | Baked into base template |
| 5 | *Optional:* Staffing Type Descriptions | Existing Drive doc (same as All Services contract) |
| 6 | *Optional:* BOCES pricing table | Existing Drive doc |
| 7 | *Optional:* Erie 1 / WNYRIC MLSA | Standing PDF in Drive, returned as a separate attachment URL |

Differences from the full contract: no cover-page legal preamble specific to the
contract, no SOW, no MSA append, no A/B/C payment-term choice, no signature
page.

---

## The Quote Table

New builder `buildBocesQuoteTable(body, quote)` in `BocesQuote.gs`.

**Columns:** `Product · Hourly Rate · Hours · Total` — **no discount column.**

**Computation:**
- Per line: `total = rate × qty`
- `subtotal` = sum of all line totals
- **Fee row** = `fee_pct × subtotal`, where `fee_pct` is a payload field
  defaulting to **10.6%**. The fee is fixed for FY27–FY29 by the standing BOCES
  agreement and is only ever changed by an administrator — it is a payload field
  for flexibility, not because it varies per deal.
- **Total** = `subtotal + fee`

**Rates:** raw FY27 BOCES pricebook rates (e.g. `BOC27-HB11` Homebound 1:1 =
$53.06, `BOC27-SWD` Students with Disabilities = $21.23). Line items arrive in
the payload with rates already calculated. The "only FY27 BOCES SKUs"
restriction is enforced **upstream in the Territory Planner picker**, not in the
script — the script renders whatever line items it is given.

**Styling:** Fullmind plum table style, consistent with the existing quote
table.

---

## Architecture

### Doc-type routing (A1 — discriminator + two orchestrators)

`doPost(e)` reads a top-level discriminator:

```json
{ "doc_type": "contract" | "boces_quote", ... }
```

- Default `"contract"` when absent (back-compat with existing payloads).
- `"contract"` → `generateFullContract(payload)` (today's `generateContract`,
  renamed).
- `"boces_quote"` → new `generateBocesQuote(payload)`.

Both orchestrators share the existing helpers — `Utils.gs`, `MergeFields.gs`,
the `PropertiesService` Drive-ID config pattern. Each owns its own base template
and section sequence. No flag-soup inside a single mega-function.

### New code

- **`BocesQuote.gs`** — `generateBocesQuote(payload)` orchestrator +
  `buildBocesQuoteTable(body, quote)`.
- **`Code.gs`** — rename `generateContract` → `generateFullContract`; add
  `doc_type` routing in `doPost` (and a thin dispatcher usable from the editor).

### Shared inserts (refactor)

The BOCES Quote reuses two of the contract's appended sections — **Staffing Type
Descriptions** and the **BOCES pricing table**. Factor these two inserts out of
`handleAppendedSections` into helpers both orchestrators call (e.g.
`appendStaffingSection(doc, props)`, `appendBocesPricingSection(doc, props)`),
rather than duplicating the append + page-break logic. The contract's
`handleAppendedSections` continues to own the signature / MSA / SOW path.

### New script properties

- `TEMPLATE_BOCES_QUOTE_ID` — the BOCES Quote base template Google Doc
- `BOCES_AGREEMENT_PDF_ID` — the standing Erie 1 / WNYRIC MLSA PDF

---

## Payload Schema (BOCES Quote)

```json
{
  "doc_type": "boces_quote",
  "deal": {
    "client_company",
    "quote_number",
    "start_date", "end_date",
    "today"
  },
  "quote": {
    "fee_pct": 10.6,
    "line_items": [
      { "sku": "BOC27-HB11", "product": "Homebound 1:1", "rate": 53.06, "qty": 250 },
      { "sku": "BOC27-SWD",  "product": "Students with Disabilities", "rate": 21.23, "qty": 100 }
    ]
  },
  "payment": {
    "pay_terms", "contract_end", "unused_funds",
    "billing_name", "billing_add", "billing_email", "billing_phone",
    "po_yn", "pay_prepost", "boces_name", "po_number"
  },
  "sections": {
    "staffing_include": true,
    "pricing_boces": true,
    "boces_agreement": true
  }
}
```

The BOCES payment terms are a single fixed block (no A/B/C choice), but the
block's deal-specific values — terms, billing contact, PO — are filled per deal
from this `payment` object. `replaceBocesMergeFields` maps these with the same
field semantics as the contract's `replaceMergeFields`; `payment` is optional
and any missing value resolves to an empty string.

Notes:
- The full-contract payload schema is unchanged; `doc_type` is additive and
  defaults to `"contract"`.
- `subtotal`, `fee`, and `order_total` are computed by the table builder from
  `line_items` + `fee_pct` — not supplied in the payload — to keep the rendered
  math authoritative.

---

## The Agreement Attachment (simplified, merge deferred)

When `sections.boces_agreement === true`, `generateBocesQuote` includes the
standing MLSA PDF's Drive URL in its response:

```json
{ "success": true, "url": "<quote doc url>", "docId": "...", "agreementUrl": "<drive url of standing MLSA pdf>" }
```

No merging, no copying — just a reference to the standing Drive file. When the
flag is false, `agreementUrl` is omitted.

**Deferred:** physically merging the quote PDF + the 25-page agreement PDF into a
single download. Apps Script has no native PDF merge; the clean path is to do it
server-side (`pdf-lib` in Node) once the Territory Planner backend exists. Until
then, the two files are delivered separately.

---

## Deliverable Model

- **Agreement insert OFF** → return an editable **Google Doc URL** (like the
  contract).
- **Agreement insert ON** → same Google Doc URL **plus** `agreementUrl` for the
  standing MLSA PDF.

(There is no Dropbox Sign / PDF-export-and-send path for the BOCES Quote.)

---

## Drive Assets to Create / Collect

| Asset | Action |
|---|---|
| BOCES Quote base template Google Doc | Create new: title + quote-# block + Start/End date + BOCES payment terms baked in; `<<merge fields>>` + section markers for the optional inserts |
| Erie 1 / WNYRIC MLSA PDF | Upload to Drive, store ID in `BOCES_AGREEMENT_PDF_ID` |
| Staffing Type Descriptions doc | Reuse existing (already in script properties) |
| BOCES pricing table doc | Reuse existing (already in script properties) |

---

## Error Handling

Mirrors the existing contract pipeline:
- Catch block deletes any partially-generated doc and returns
  `{ success: false, error }`.
- Missing optional-insert Drive IDs log a warning via `Logger.log()` and skip
  the insert rather than throwing.
- `boces_agreement: true` with an unset `BOCES_AGREEMENT_PDF_ID` logs a warning
  and omits `agreementUrl` — the quote still generates.

---

## Testing

New fixture **`PAYLOAD_BOCES_QUOTE`** in `SampleData.gs`: 2–3 BOCES line items
(mixed rates), `fee_pct: 10.6`, all optional inserts on.

Visual / functional checklist per generated doc:
- [ ] Title "Quote for Fullmind Services" + Quote # rendered, no literal `<<merge_fields>>`
- [ ] No `{{MARKERS}}` visible
- [ ] Quote table: correct columns (no discount), per-line totals, Fee row = 10.6% × subtotal, Total = subtotal + fee
- [ ] BOCES payment terms block present
- [ ] Staffing + BOCES pricing inserts toggle correctly with clean page breaks
- [ ] `agreementUrl` present in response when `boces_agreement: true`, absent otherwise
- [ ] Existing full-contract path unchanged when `doc_type` omitted or `"contract"`

---

## Out of Scope / Deferred

- PDF merge of quote + agreement into a single file (later, server-side in TP backend)
- Script-side SKU validation (upstream TP picker owns it)
- Territory Planner UI for choosing document type (separate future phase)
- Any change to the full-contract pipeline beyond the `generateContract` →
  `generateFullContract` rename and the shared-insert refactor
