# Project Sea Monkey — Contract Generator Design

**Date:** 2026-05-29  
**Status:** Approved for implementation  
**Branch target:** `feat/document-generation-poc` (existing PoC branch)

---

## Overview

A contract generation pipeline for Fullmind sales reps. The Territory Planner app sends a JSON payload to a Google Apps Script web app. The script assembles a fully-populated Google Doc contract from a base template and a set of sub-template docs stored in Google Drive. The script returns a doc URL to the TP app, which either routes the rep through an optional review step or triggers the Playwright eSign automation directly.

This replaces the manual PandaDoc workflow. PandaDoc could not render quote tables in PDF export. Apps Script builds quote tables programmatically from line item data — no static template needed for that section.

---

## What Was Proven in the PoC

Branch: `feat/document-generation-poc`

The PoC (against a simpler order doc) proved the core patterns this project reuses:
- Merge field replacement via `body.replaceText()`
- Dynamic table construction from line item arrays
- Marker-based section deletion (`{{MARKER}}` in white 1pt text)
- `appendDocContent()` for stitching Drive docs together
- Playwright automation for Google native eSign (7-step flow, proven end-to-end)

---

## Architecture

```
Territory Planner app
    │  POST JSON payload
    ▼
Google Apps Script (web app endpoint)
    │
    ├── 1. Copy base template → new Google Doc in output folder
    ├── 2. Replace all <<merge_fields>>
    ├── 3. Build quote table from scratch (or delete section)
    ├── 4. Select payment term block A/B/C (delete other two)
    ├── 5. Append sub-templates from Drive (SOW, Staffing, Pricing, MSA)
    ├── 6. [If auto_send] POST to Playwright trigger URL
    └── 7. Return { success, url, docId } to TP app
```

**Two post-generation paths:**

```
auto_send = false → TP shows doc URL to rep
                    → rep optionally edits in Google Docs
                    → TP triggers Playwright eSign separately

auto_send = true  → Script POSTs to PLAYWRIGHT_TRIGGER_URL
                    → Playwright sets signature field + sends to signer
                    → TP receives { success, url, docId, sent: true }
```

---

## Project Structure

### CLASP (version-controlled in repo)

```
scripts/document-generation/appsscript/
  appsscript.json       ← manifest: timezone, OAuth scopes, webapp config
  .clasp.json           ← Drive script project ID (gitignored)
  Code.gs               ← doPost(e) + generateContract(payload)
  Config.gs             ← PropertiesService keys, no hardcoded IDs
  Utils.gs              ← findParagraphIndex, deleteMarkerParagraph,
                           deleteBetweenMarkers, appendDocContent,
                           formatCurrency, escapeRegex
  MergeFields.gs        ← replaceMergeFields(body, payload)
  QuoteTable.gs         ← handleQuoteSection(), buildQuoteTableFromScratch()
  PaymentTerms.gs       ← handlePaymentTerms(body, payment)
  AppendedSections.gs   ← handleAppendedSections(doc, sections, props)
  SampleData.gs         ← PAYLOAD_FULL, PAYLOAD_NO_QUOTE, PAYLOAD_BOCES_ONLY
```

### Google Drive

```
/Fullmind Templates/
  base/       → Fullmind_Contract_Template_v1   (converted from .docx)
  sow/        → SOW_LiveStreaming
                SOW_InstructionalServices
  staffing/   → StaffingTypeDescriptions
  pricing/    → PricingSheet_EK12
                PricingSheet_LiveStaffing
                PricingSheet_Hourly
                PricingSheet_BOCES
  msa/        → MasterServicesAgreement
  _output/    → generated contracts land here
```

All file IDs stored in `PropertiesService.getScriptProperties()`. Never hardcoded in script files.

**Note:** Quote tables are NOT Drive docs. They are built entirely by `buildQuoteTableFromScratch()` from the line items in the JSON payload. The Pricebook CSVs (`flat_priced_products.csv`, `volume_priced_products.csv`) are used by the Territory Planner UI to look up rates — by the time the payload reaches the script, rates are already calculated.

---

## Sub-Template Asset Status

| Doc | Source exists? | Action |
|---|---|---|
| Cover page | ✅ Yes | Upload to Drive `base/` |
| MSA | ✅ Yes | Upload to Drive `msa/` |
| BOCES pricing sheet | ✅ Yes | Upload to Drive `pricing/` |
| SOW — Live Streaming | ❌ No | Recreate from PandaDoc export (pp. 8–11) |
| SOW — Instructional Services | ❌ No | Recreate from PandaDoc export (pp. 12–15) |
| Staffing Type Descriptions | ❌ No | Recreate from PandaDoc export (p. 16) |
| EK12 pricing sheet | ❌ No | Recreate from PandaDoc export (pp. 17–18) |
| Live Staffing pricing sheet | ❌ No | Recreate from PandaDoc export (p. 19) |
| Hourly pricing sheet | ❌ No | Recreate from PandaDoc export (p. 21) |

---

## JSON Payload Schema

```json
{
  "deal": {
    "sender_first", "sender_last", "sender_title", "sender_email",
    "client_first", "client_last", "client_title", "client_company", "client_email",
    "start_date", "end_date",
    "signer_first", "signer_last", "signer_salut", "signer_title",
    "today"
  },
  "quote": {
    "include": true,
    "show_pricing": true,
    "line_items": [
      { "sku", "service", "description", "qty", "unit", "list_rate",
        "discount_pct", "net_rate", "total" }
    ],
    "min_amt", "max_amt", "order_total"
  },
  "payment": {
    "type": "A" | "B" | "C",
    "pay_terms", "invoice_date", "contract_end", "unused_funds",
    "billing_name", "billing_add", "billing_email", "billing_phone",
    "po_yn", "add_terms", "imp_detail", "pay_prepost", "boces_name", "po_number"
  },
  "sections": {
    "sow_type": "live_streaming" | "instructional_services",
    "staffing_include": true,
    "pricing_ek12": false,
    "pricing_livestaff": true,
    "pricing_hourly": true,
    "pricing_boces": true
  },
  "auto_send": false
}
```

---

## Template Marker System

Section boundaries use `{{MARKER}}` tags in **white 1pt text** — invisible to signers, findable by `body.getText()`. All markers are standalone paragraphs (not inside table cells) so `findParagraphIndex()` can locate them by direct body child traversal.

Merge fields use `<<FIELD_NAME>>` syntax, replaced in a single pass by `replaceMergeFields()`.

Full marker reference: see `Fullmind_AppScript_Build_Reference.md` § 6.

---

## Build Phases

### Phase 1 — Scaffolding
- Create Google Apps Script project in Drive
- Set up CLASP: `clasp login`, `clasp create`, `.clasp.json`
- Create Drive folder structure (`/Fullmind Templates/` tree + `_output/`)
- Stub all `.gs` files (empty functions)
- Confirm `clasp push` → `clasp pull` round-trip works
- **Exit criteria:** `clasp push` succeeds, project visible in script.google.com

### Phase 2 — Base template + merge fields
- Upload `Fullmind_Contract_Template_v1.docx` to Drive, convert to Google Doc
- Insert all `<<merge_fields>>` and `{{PAY_A/B/C_START/END}}` payment term markers
- Write `Utils.gs` (all shared helpers — these are the foundation)
- Write `MergeFields.gs` + `PaymentTerms.gs`
- Write `Config.gs` with script property keys
- Set script properties with Drive file IDs
- Write `PAYLOAD_FULL` in `SampleData.gs`
- **Exit criteria:** Generated doc has all fields filled, one payment term block, signature block with `[GSIGN_SIG]` intact, no visible markers

### Phase 3 — Quote table
- Write `QuoteTable.gs` with `buildQuoteTableFromScratch()`
- Update `PAYLOAD_FULL` with 3 line items (mixed units)
- Add `PAYLOAD_NO_QUOTE` fixture
- **Exit criteria:** `quote.include = true` → correct table with TOTAL row; `quote.include = false` → section cleanly absent; `show_pricing = false` → List Rate + Disc % columns suppressed

### Phase 4 — Existing appended sections
- Upload Cover page, MSA, BOCES pricing sheet to Drive
- Store IDs in script properties
- Write `AppendedSections.gs` for these three sections
- **Exit criteria:** All three append with correct page breaks; MSA always present; BOCES only present when `pricing_boces = true`

### Phase 5 — Build + wire missing sub-templates
- Recreate 6 missing docs from PandaDoc export as Google Docs
- Upload to Drive, store IDs in script properties
- Wire remaining sections in `AppendedSections.gs`
- Add `PAYLOAD_BOCES_ONLY` fixture
- **Exit criteria:** All three test payloads produce correct contracts for all section combinations

### Phase 6 — Web app deployment
- Implement `doPost(e)` entry point with `auto_send` branching
- Add `PLAYWRIGHT_TRIGGER_URL` to script properties (empty initially)
- Deploy as web app: execute as me, access to anyone with link
- Test with `curl` / Postman using `PAYLOAD_FULL`
- **Exit criteria:** `doPost()` returns `{ success: true, url, docId }`; doc appears in `_output/` folder

---

## Error Handling

**On failure:**
- Catch block emails `payload.deal.sender_email` with error message + stack trace
- Partially-generated doc (if created) is deleted from Drive
- `doPost()` returns `{ success: false, error: message }`

**Marker warnings:**
- `deleteBetweenMarkers()` logs via `Logger.log()` if a marker is not found — does not throw
- Warnings surface in failure email if the run also fails; silently logged otherwise

**`auto_send` path:**
- If `PLAYWRIGHT_TRIGGER_URL` is empty, `auto_send` is treated as `false` (no-op, no error)
- If the Playwright trigger call fails, the error is logged but the doc URL is still returned — contract generation succeeded even if send failed

---

## Testing

Three `SampleData.gs` fixtures:

| Fixture | Key coverage |
|---|---|
| `PAYLOAD_FULL` | All sections on, quote + pricing shown, payment type A, live streaming SOW |
| `PAYLOAD_NO_QUOTE` | `quote.include = false`, payment type B, instructional services SOW, no staffing |
| `PAYLOAD_BOCES_ONLY` | Payment type C + PO number, BOCES only, quote pricing hidden |

Visual checklist per generated doc:
- [ ] No `<<merge_fields>>` visible as literal text
- [ ] No `{{MARKERS}}` visible anywhere
- [ ] Correct payment term block present; other two absent with no whitespace gap
- [ ] Quote table present/absent per flag; columns correct; TOTAL row formatted `$X,XXX.XX`
- [ ] Appended sections in correct order with page breaks
- [ ] `[GSIGN_SIG]` preserved exactly in signature block
- [ ] No orphaned blank pages

Web app test (Phase 6):
- `curl -X POST <endpoint> -H "Content-Type: application/json" -d @payload_full.json`
- Expected: `{ "success": true, "url": "https://docs.google.com/...", "docId": "..." }`

---

## Key Reference Files

| File | Location |
|---|---|
| Technical blueprint | `/Users/astonfurious/Desktop/Work Documents/Project Sea Monkey/Fullmind_AppScript_Build_Reference.md` |
| Base template (.docx) | `/Users/astonfurious/Desktop/Work Documents/Project Sea Monkey/Fullmind_Contract_Template_v1.docx` |
| PandaDoc export (sub-template source) | `/Users/astonfurious/Downloads/FY27 - Contract Template - All Services - No Variables, No Tables.pdf` |
| Pricebook CSVs | `/Users/astonfurious/Desktop/Work Documents/Project Sea Monkey/Fullmind Pricebook - PandaDoc Export May 2026/` |
| PoC branch | `feat/document-generation-poc` |
