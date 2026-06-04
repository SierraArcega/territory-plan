# Document Generation POC — Design Spec
**Date:** 2026-05-26  
**Status:** Approved for implementation planning  
**Goal:** Validate replacing PandaDoc with Google Apps Script + Google Docs API for order form generation and client e-signature

---

## 1. Problem & Goal

Fullmind currently uses PandaDoc to generate client-facing order/proposal documents. The goal is to validate whether the same capability can be achieved using tools already available in the Google Workspace Business Plus plan, reducing cost.

**Three things to prove:**
1. PDF generation from a Google Doc template
2. A calculated pricing table pulled from external SKU data (`flat_priced_products.csv`)
3. Dynamic merge field replacement — fields placed anywhere in the document, not tied to fixed coordinates

---

## 2. Scope (POC only)

This spec covers a **proof-of-concept only**. No production UI, no database records, no territory-plan app changes in Phase 1.

**In scope:**
- Google Apps Script that fills a template Doc, inserts a pricing table, and exports PDF
- Single client e-signature request (Phase 2)
- 5 hardcoded sample SKUs from `flat_priced_products.csv` as test data

**Out of scope (deferred to production spec):**
- UI for selecting SKUs or entering field values
- Persistent storage of generated documents
- Integration with territory-plan Next.js app
- Multi-document batch generation

---

## 3. Template

**File:** `PurchaseOrderAgreement.docx` (existing ACME template, located at `/Users/astonfurious/Desktop/PurchaseOrderAgreement.docx`)  
**Setup:** Upload to Google Drive and convert to Google Doc format. This becomes the master template — it is never edited directly; the script always works on a copy.

### Merge fields already in template (12 total)

| Token | Maps to |
|---|---|
| `«BUYER_COMPANY_NAME»` | District / client name |
| `«BUYER_CONTACT_NAME»` | District contact person |
| `«ACCT_MANAGER_NAME»` | Fullmind rep name |
| `«ORDER_DATE»` | Document generation date |
| `«DELIVERY_DATE»` | Requested service start date |
| `«CONTRACT_REF»` | Contract reference number |
| `«PAYMENT_TERMS»` | e.g. "Net 30" |
| `«SHIP_TO_LOCATION»` | District address |
| `«FREIGHT_TERMS»` | e.g. "N/A — Services" |
| `«ORDER_TOTAL»` | Calculated grand total from line items |
| `«DOCUMENT_REF_ID»` | Auto-generated doc ID |
| `«EFFECTIVE_DATE»` | Contract effective date |

### Table insertion zone

The template contains the literal text:

```
[ DYNAMIC TABLE INSERTION ZONE ]
Variable number of line-item rows will be inserted here at runtime.
```

The script finds this paragraph by text match and replaces it with a populated table.

### Signature blocks

The template has two signature blocks at the end:

- **Fullmind block** (`Acme Industrial Supply Co.` in the template) — pre-filled programmatically at generation time (rep name, title, date). No live signature required.
- **Client block** (`«BUYER_COMPANY_NAME»`) — sent to the client contact for a single e-signature.

---

## 4. Architecture

### Phase 1: Document generation (Apps Script)

**Where it runs:** Google Apps Script editor (`script.google.com`) — standalone script attached to the Fullmind Google Drive account. No Next.js changes, no server setup, no OAuth config.

**Script structure:**

```
generateOrderDocument(data)
  ├── DriveApp.getFileById(TEMPLATE_ID).makeCopy(title, folder)
  ├── DocumentApp.openById(newDocId)
  ├── replaceAllMergeFields(body, data)          // loops «FIELD» → value
  ├── insertPricingTable(body, data.lineItems)   // finds zone, replaces with table
  ├── fillFullmindSignatureBlock(body, data)     // pre-fills rep name/title/date
  └── exportAsPdf(newDocId)                      // returns PDF blob
```

**Input data object:**

```javascript
{
  buyerCompanyName:  "Springfield Unified School District",
  buyerContactName:  "Dr. Jane Holloway",
  acctManagerName:   "Marcus Webb",
  orderDate:         "May 26, 2026",
  deliveryDate:      "August 25, 2026",
  contractRef:       "FM-2026-0042",
  paymentTerms:      "Net 30",
  shipToLocation:    "742 Evergreen Terrace, Springfield, IL 62701",
  freightTerms:      "N/A — Educational Services",
  documentRefId:     "DOC-FM-0042",
  effectiveDate:     "July 1, 2026",
  lineItems: [
    // 5 sample rows from flat_priced_products.csv (see Section 5)
  ]
}
```

### Fullmind signature block pre-fill

The script replaces the seller signature area (currently "Acme Industrial Supply Co.") with:
- **Name:** `data.acctManagerName`
- **Title:** `"Account Manager, Fullmind Learning"`
- **Date:** generation date (auto-populated)

This means the document arrives at the client already showing Fullmind's rep details — the client only needs to add their own signature.

### Phase 2: Client e-signature (two options, validated separately)

**Option A — Google Workspace eSign (zero additional cost)**  
After the script generates the Doc, the Fullmind rep opens it in Drive and clicks "Request eSignature." They enter the client contact's email. Client receives a signing link, signs, final PDF is saved to Drive.  
*One manual step required (clicking in Drive UI) — acceptable for POC and potentially for production.*

**Option B — Dropbox Sign API (fully headless)**  
The Apps Script calls the Dropbox Sign REST API with the exported PDF, specifying one signer (client email). The client receives an email with a signing link. Free tier supports 3 requests/month — sufficient for POC.  
*Fully automated, ~$15/mo if adopted for production.*

---

## 5. Sample SKU Data (POC hardcoded)

Five rows selected from `flat_priced_products.csv` to represent a realistic mixed order:

| Name | SKU | Unit Price | Qty | Extended Total |
|---|---|---|---|---|
| Whole Class Instruction - SG | WCVI-SG-FY27 | $168.83 | 10 | $1,688.30 |
| Educator Prep Time | EDPREP-FY27 | $83.59 | 5 | $417.95 |
| Co Teaching | COT-FY27 | $78.02 | 8 | $624.16 |
| Assessments (Pre and Post Testing) | ASSESS-FY27 | $44.58 | 20 | $891.60 |
| Students with Disabilities | SWD-FY27 | $22.29 | 15 | $334.35 |
| | | | **TOTAL** | **$3,956.36** |

`Extended Total = Unit Price × Qty`, calculated in the script before table insertion. `ORDER_TOTAL` merge field is set to the grand total.

---

## 6. Table Insertion Approach

Google Apps Script's `DocumentApp` does not have a direct `replaceTextWithTable()` method. The insertion works in two steps:

1. **Find** the paragraph containing `[ DYNAMIC TABLE INSERTION ZONE ]` by iterating `body.getParagraphs()`
2. **Get its index** via `body.getChildIndex(paragraph)`
3. **Insert a table** at that index via `body.insertTable(index, rowsData)` — `rowsData` is a 2D array (header row + one row per SKU + total row)
4. **Remove** the original placeholder paragraph

This places the table exactly where the placeholder was, regardless of page position.

---

## 7. Success Criteria

### Phase 1 (document generation)
- [ ] Template copy created in Drive with a unique filename
- [ ] All 12 `«FIELD»` tokens replaced with correct values
- [ ] `[ DYNAMIC TABLE INSERTION ZONE ]` replaced with a 7-row table (header + 5 SKUs + total)
- [ ] Extended totals and grand total calculated correctly
- [ ] Fullmind signature block pre-filled with rep name, title, and date
- [ ] Document exported as PDF without layout errors

### Phase 2 (signing — validate one option)
- [ ] Client receives a signing request at their email address
- [ ] Signed document is returned as a final PDF
- [ ] Two signature blocks are visible in the final document (Fullmind pre-filled, client signed)

---

## 8. Files & Locations

| Artifact | Location |
|---|---|
| ACME template DOCX | `/Users/astonfurious/Desktop/PurchaseOrderAgreement.docx` |
| SKU source CSV | `/Users/astonfurious/Desktop/biCCbx4cvygLuGBK7dxvWj/flat_priced_products.csv` |
| Apps Script (to be created) | Google Apps Script editor — standalone project in Fullmind Drive |
| Template Doc (to be uploaded) | Fullmind Google Drive — `/Document Templates/` folder (to be created) |
| Generated docs (to be created) | Fullmind Google Drive — `/Generated Orders/` folder (to be created) |

---

## 9. Future: Production Integration

Once the POC is validated, the production version would:
- Move the script logic to a Next.js API route (`POST /api/documents/generate-order`) calling the Google Docs REST API
- Pull field values from the territory-plan data model (plan, district, rep profile)
- Allow reps to select SKUs and enter quantities from within the app
- Store a reference (Drive URL, doc ID) on the Plan record in the database
- Trigger the signing request automatically on document creation
