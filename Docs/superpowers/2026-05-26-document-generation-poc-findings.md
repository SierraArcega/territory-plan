# Document Generation POC — Findings & Production Path

**Date:** 2026-05-26  
**Author:** Aston Arcega  
**Status:** ✅ Validated — ready for production planning

---

## Problem

Fullmind uses PandaDoc to generate client-facing order/proposal documents. PandaDoc is a cost driver. This POC tested whether the same capability can be achieved using tools already available in Google Workspace Business Plus — at zero additional cost.

**Three things to prove:**
1. PDF generation from a Google Doc template
2. A calculated pricing table from external SKU data
3. Dynamic field replacement and signature field placement without fixed coordinates

---

## Result: All Three Proven

Every capability was validated end-to-end in a single test run today.

---

## How It Works

### Document Generation (Google Apps Script)

A standalone Apps Script project (no server, no OAuth configuration required) runs the following pipeline:

1. **Copy template** — `DriveApp.getFileById(TEMPLATE_ID).makeCopy()` creates a fresh copy for each order; the master template is never modified
2. **Replace merge fields** — `body.replaceText('«TOKEN»', value)` replaces all 12 field tokens anywhere in the document (body, headers, footers); no fixed coordinates
3. **Insert pricing table** — `body.getParagraphs()` locates the `[ DYNAMIC TABLE INSERTION ZONE ]` placeholder, detects whether it lives inside an existing table cell (ACME template structure) or as a direct body child, and inserts rows accordingly; the row count is variable and driven by the input data
4. **Pre-fill Fullmind signature block** — rep name and title are written into the seller signature area; the document arrives at the client already showing Fullmind's rep details
5. **Export PDF** — `DriveApp.getFileById(id).getAs('application/pdf')` converts the completed Doc to PDF and saves it to a designated Drive folder
6. **Send for e-signature** — Dropbox Sign REST API receives the PDF, detects text anchor tags embedded in the client signature cell, and auto-places the signature and date fields

### E-Signature (Dropbox Sign API)

The script embeds invisible text anchor tags (`[sig|req|signer1]`, `[date|req|signer1]`) as 1pt white text into the client signature cell before PDF export. Dropbox Sign scans the PDF text stream, detects the tags, and places signature fields at those exact positions — no manual drag-and-drop, no coordinate math, no layout assumptions. The client receives an email with the fields already placed correctly.

**Test mode** (`test_mode: 1`) was used throughout — no real emails were sent during testing. The full flow is visible in the Dropbox Sign dashboard.

---

## Test Run Results

| Step | Result |
|---|---|
| Template copy created in Drive | ✅ |
| All 12 `«FIELD»` tokens replaced | ✅ |
| Document reference (`DOC-FM-0042`) in footer | ✅ |
| Pricing table inserted (5 SKUs + subtotal row) | ✅ |
| Grand total calculated correctly ($3,956.36) | ✅ |
| Fullmind rep block pre-filled (name + title) | ✅ |
| PDF exported to Drive | ✅ |
| Dropbox Sign request sent via REST API | ✅ |
| Signature field auto-placed in client block | ✅ |
| Client signing email received | ✅ |

---

## Cost Comparison

| | PandaDoc | Google Apps Script + Dropbox Sign |
|---|---|---|
| Document generation | Included | Free (Google Workspace already licensed) |
| E-signature (production) | Included | ~$15/mo (Dropbox Sign Essentials) |
| E-signature (POC / low volume) | — | Free (3 requests/month on free tier) |
| Custom integration work | API available | API available |

---

## Script Files

All files live in `scripts/document-generation/` in this repo and are pasted into a standalone Google Apps Script project:

| File | Responsibility |
|---|---|
| `Config.gs` | Drive IDs (template, output folder, PDF folder) |
| `SampleData.gs` | Hardcoded test input — 5 SKUs + all merge field values |
| `MergeFields.gs` | `replaceAllMergeFields(doc, data)` — all 12 token replacements incl. header/footer |
| `TableInsertion.gs` | `insertPricingTable(body, lineItems)` — variable-row table at placeholder zone |
| `SignatureBlock.gs` | `fillFullmindSignatureBlock(body, data)` — pre-fills seller rep name + title |
| `ESign.gs` | `addESignAnchorTags(body)` + `sendForDropboxSign()` — anchor placement + API call |
| `Code.gs` | `generateOrderDocument(data)` — full pipeline orchestrator |

The API key (`DROPBOX_SIGN_API_KEY`) is stored in Apps Script Script Properties — never in code or version control.

---

## Production Integration Path

When moving from POC to production, three things change:

### 1. Data source
The `data` object currently comes from `getSampleOrderData()` (hardcoded). In production it comes from a Fullmind LMS Opportunity record. The `generateOrderDocument(data)` function signature stays exactly the same — the LMS calls it with a populated object.

```javascript
// POC
var data = getSampleOrderData();
generateOrderDocument(data);

// Production
var data = buildDataFromOpportunity(opportunityId);  // new function
generateOrderDocument(data);  // unchanged
```

### 2. Template
The ACME test template is replaced with the production Fullmind order template. Only `TEMPLATE_ID` in `Config.gs` changes. The insertion logic is template-agnostic — it finds the placeholder zone by text match regardless of document structure.

### 3. Remove test mode
One line removed from `ESign.gs`:
```javascript
// Remove this line for production:
'test_mode': '1',
```

### Optional: Move to Next.js API route
For full integration with the territory-plan app, the script logic can be moved to a Next.js API route (`POST /api/documents/generate-order`) calling the Google Docs REST API. The Apps Script version can continue to run standalone for as long as needed — there is no hard dependency on the Next.js app.

The production spec should cover:
- UI for selecting SKUs and entering quantities from within the app
- Storing the Drive URL and doc ID on the Plan record in the database
- Triggering the signing request automatically on document creation
- Webhook to mark the document as signed when Dropbox Sign confirms

---

## Decision

The Google Workspace + Dropbox Sign approach is a viable replacement for PandaDoc. The POC proves all three required capabilities with zero new infrastructure — the only new cost is Dropbox Sign at ~$15/mo if adopted at production volume.

**Recommended next step:** Write a production spec scoping the Next.js integration, SKU selection UI, and database record linkage.
