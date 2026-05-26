# Document Generation — Google Apps Script POC

Generates a completed Fullmind Purchase Order document and PDF from a Google
Docs template. Runs entirely inside [Google Apps Script](https://script.google.com)
— no local build step required.

---

## Overview

The script copies a Google Doc template, replaces 12 `«FIELD»` merge tokens,
inserts a dynamic pricing table, pre-fills the Fullmind seller signature block,
and exports a PDF — all in one function call.

**Files in this directory** are the source of truth. Paste them verbatim into
the Apps Script editor; they share a single global namespace so functions
defined in one file are callable from any other.

---

## Task 0 — Drive Setup (do this before anything else)

Create three items in Google Drive:

| Item | Suggested name |
|------|----------------|
| Google Doc (template) | `[TEMPLATE] Purchase Order Agreement` |
| Folder for generated Docs | `Generated Orders` |
| Folder for generated PDFs | `Generated PDFs` |

Copy the Drive ID from each item's URL:
- Doc URL: `https://docs.google.com/document/d/<ID>/edit`
- Folder URL: `https://drive.google.com/drive/folders/<ID>`

---

## Task 1 — Create the Apps Script Project

1. Go to [script.google.com](https://script.google.com) and click **New project**.
2. Rename the project (e.g., `Fullmind Document Generation POC`).
3. You will see one default file (`Code.gs`). Delete its contents — you will
   paste the real content in the next step.

---

## Task 2 — Paste Each File

For each `.gs` file below, create a matching script file and paste the contents:

| File | Script file name (in editor) |
|------|------------------------------|
| `Config.gs` | `Config` |
| `SampleData.gs` | `SampleData` |
| `MergeFields.gs` | `MergeFields` |
| `TableInsertion.gs` | `TableInsertion` |
| `SignatureBlock.gs` | `SignatureBlock` |
| `Code.gs` | `Code` |

To add a new file: click the **+** icon next to "Files" in the left panel and
choose **Script**.

> **Important:** The `«` and `»` characters in `MergeFields.gs` are Unicode
> guillemets (U+00AB / U+00BB). If copy-paste garbles them, retype directly or
> copy from the Google Doc template itself to ensure an exact match.

---

## Task 3 — Fill in Drive IDs

Open `Config.gs` in the editor and replace the three placeholder strings:

```javascript
var TEMPLATE_ID      = 'YOUR_TEMPLATE_DOC_ID_HERE';
var OUTPUT_FOLDER_ID = 'YOUR_GENERATED_ORDERS_FOLDER_ID_HERE';
var PDF_FOLDER_ID    = 'YOUR_GENERATED_PDFS_FOLDER_ID_HERE';
```

Run `testConfig()` (select it in the function dropdown and click **Run**) to
confirm all three IDs resolve correctly. Expected log output:

```
Template name: [TEMPLATE] Purchase Order Agreement
Output folder: Generated Orders
PDF folder:    Generated PDFs
```

---

## Task 4 — Grant Permissions

The first time you run any function, Apps Script will ask you to authorize
access to Google Drive and Docs. Click **Review permissions** → choose your
account → **Allow**.

---

## Task 5 — Run the End-to-End Test

Select `runEndToEndTest` in the function dropdown and click **Run**.

Check the Execution log for two URLs (Doc + PDF), then open each file and
verify against the checklist printed in the log:

- All `«FIELD»` tokens replaced (use Ctrl+F for `«` to confirm none remain)
- Pricing table present with 7 rows (header + 5 line items + total row)
- Grand total = **$3,956.36**
- Fullmind signature block shows **Marcus Webb** / Account Manager, Fullmind Learning
- PDF opens correctly and layout is intact

---

## Individual Test Functions

Each module has its own test function for isolated debugging:

| Function | Tests |
|----------|-------|
| `testConfig()` | Drive IDs resolve |
| `testSampleData()` | Sample data shape |
| `testMergeFields()` | Token replacement only |
| `testTableInsertion()` | Table insertion only |
| `testSignatureBlock()` | Merge fields + signature block |
| `runEndToEndTest()` | Full pipeline |

Each test that creates a document copy will log a URL. Delete the test copy
from Drive before re-running to avoid accumulating drafts.

---

## Production — LMS Injection Point

The `insertPricingTable(body, lineItems)` function accepts `lineItems` as a
plain array parameter. In the POC, this is populated from `getSampleOrderData()`
(5 hardcoded SKUs).

When connecting to the Fullmind LMS, replace the call site in `Code.gs` — the
comment `// ── FUTURE INJECTION POINT ──` marks the exact line. Pass the
opportunity's line items array there. No other code changes are required; the
table handles any number of rows automatically.

Similarly, the scalar field values in `getSampleOrderData()` will be replaced
by fields from the Fullmind plan/district record for the real buyer.
