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
| `ESign.gs` | `ESign` |
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

## Phase 2: Dropbox Sign eSign Setup

Before running `runEndToEndTest` with eSign enabled:

### 1. Set Script Properties

In the Apps Script editor → click the ⚙ icon (Project Settings) → scroll to **Script Properties** → click **Add script property** for each:

| Property | Value |
|---|---|
| `DROPBOX_SIGN_API_KEY` | Your Dropbox Sign API key |
| `TEST_SIGNER_EMAIL` | Your own email (for POC testing) |
| `TEST_SIGNER_NAME` | Your full name |

The API key is stored securely in Google's Script Properties store — it is never saved in code or committed to the repo.

### 2. Run the end-to-end test

Select `runEndToEndTest` → Run. With a real `signerEmail` in the sample data (not `test@example.com`), the script will:
1. Generate and fill the document
2. Add invisible anchor tags to the client signature cell
3. Export the PDF
4. Send it to Dropbox Sign (in test_mode — no real email sent, but visible in the dashboard)

Check your [Dropbox Sign dashboard](https://app.hellosign.com) to confirm the signature request was created and the fields are correctly placed.

### 3. Go live

To send real signing requests:
- Set `data.signerEmail` to the actual client's email in `SampleData.gs`
- Remove `'test_mode': '1'` from `ESign.gs` `sendForDropboxSign()`

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
| `testESign()` | Dropbox Sign send (uses most recent PDF) |
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
