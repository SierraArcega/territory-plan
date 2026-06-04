# Document Generation POC — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Prove that Google Apps Script can replace PandaDoc — fill merge fields, insert a calculated pricing table, export a PDF, and send a single client e-signature request.

**Architecture:** A standalone Google Apps Script project (no server, no OAuth setup) copies the ACME template Doc in Drive, replaces all `«FIELD»` tokens via `replaceText()`, inserts a 7-row pricing table at the marked placeholder zone, pre-fills the Fullmind signature block, exports a PDF, and (Phase 2) initiates a Google Workspace eSign request.

**Tech Stack:** Google Apps Script (V8 runtime), Google Drive API (built-in DriveApp), Google Docs API (built-in DocumentApp), Google Workspace eSign (Drive UI, Phase 2)

---

## File Map

All files are `.gs` script files created inside a single Apps Script project. They share one global namespace — functions defined in any file are accessible from all others.

| File | Responsibility |
|---|---|
| `Config.gs` | `TEMPLATE_ID`, `OUTPUT_FOLDER_ID`, `PDF_FOLDER_ID` constants |
| `SampleData.gs` | Hardcoded test input: 5 SKUs + all merge field values |
| `MergeFields.gs` | `replaceAllMergeFields(body, data)` — replaces all 12 `«FIELD»` tokens |
| `TableInsertion.gs` | `insertPricingTable(body, lineItems)` — finds placeholder, inserts table, returns grand total |
| `SignatureBlock.gs` | `fillFullmindSignatureBlock(body, data)` — pre-fills seller rep name + title |
| `Code.gs` | `generateOrderDocument(data)` — orchestrates all steps, exports PDF |

---

## Task 0: Drive Setup (manual, no script)

**No script files involved — this is all done in the browser.**

- [ ] **Step 1: Upload the ACME template to Drive**

  Go to [drive.google.com](https://drive.google.com). Click **New → File upload**. Select:
  ```
  /Users/astonfurious/Desktop/PurchaseOrderAgreement.docx
  ```
  After upload, right-click the file → **Open with → Google Docs**. This creates a Google Doc version. Rename it to `[TEMPLATE] Purchase Order Agreement`.

- [ ] **Step 2: Create folder structure**

  In Drive, create two folders:
  - `Document Templates` — move `[TEMPLATE] Purchase Order Agreement` into it
  - `Generated Orders` — leave empty for now (script will save docs here)
  - `Generated PDFs` — leave empty for now (script will save PDFs here)

- [ ] **Step 3: Note the three IDs**

  For each item, open it in Drive, look at the URL:
  - Template Doc URL: `https://docs.google.com/document/d/FILE_ID/edit` → copy `FILE_ID`
  - `Generated Orders` folder URL: `https://drive.google.com/drive/folders/FOLDER_ID` → copy `FOLDER_ID`
  - `Generated PDFs` folder URL: same pattern → copy `FOLDER_ID`

  Keep these three IDs handy — you'll paste them into `Config.gs` in Task 1.

- [ ] **Step 4: Create the Apps Script project**

  Go to [script.google.com](https://script.google.com). Click **New project**. Rename it to `Fullmind Document Generation POC`. Delete the default `Code.gs` content (leave the file, you'll fill it in Task 6).

---

## Task 1: Config.gs — Constants

**File:** Create `Config.gs` in the Apps Script project (click the `+` next to Files → Script).

- [ ] **Step 1: Paste the constants**

  Replace all content in `Config.gs` with:

  ```javascript
  // Paste the IDs you collected in Task 0 Step 3
  var TEMPLATE_ID     = 'YOUR_TEMPLATE_DOC_ID_HERE';
  var OUTPUT_FOLDER_ID = 'YOUR_GENERATED_ORDERS_FOLDER_ID_HERE';
  var PDF_FOLDER_ID   = 'YOUR_GENERATED_PDFS_FOLDER_ID_HERE';
  ```

- [ ] **Step 2: Write a connectivity test**

  Still in `Config.gs`, add below the constants:

  ```javascript
  function testConfig() {
    var template = DriveApp.getFileById(TEMPLATE_ID);
    var outFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    var pdfFolder = DriveApp.getFolderById(PDF_FOLDER_ID);

    Logger.log('Template name: ' + template.getName());
    Logger.log('Output folder: ' + outFolder.getName());
    Logger.log('PDF folder:    ' + pdfFolder.getName());
  }
  ```

- [ ] **Step 3: Run the test**

  In the Apps Script editor, select `testConfig` from the function dropdown and click **Run**. Accept any permission prompts (Drive access).

  Check the **Execution log** at the bottom. Expected output:
  ```
  Template name: [TEMPLATE] Purchase Order Agreement
  Output folder: Generated Orders
  PDF folder:    Generated PDFs
  ```

  If you see an error like `Exception: No item with the given ID`, the ID in `Config.gs` is wrong — go back and re-copy it from the Drive URL.

- [ ] **Step 4: Save**

  Press `Ctrl+S` (or `Cmd+S`). No git commit needed — Apps Script auto-saves versions.

---

## Task 2: SampleData.gs — Hardcoded Test Input

**File:** Create `SampleData.gs` in the Apps Script project.

- [ ] **Step 1: Paste the sample data function**

  ```javascript
  function getSampleOrderData() {
    return {
      buyerCompanyName:  'Springfield Unified School District',
      buyerContactName:  'Dr. Jane Holloway',
      acctManagerName:   'Marcus Webb',
      orderDate:         'May 26, 2026',
      deliveryDate:      'August 25, 2026',
      contractRef:       'FM-2026-0042',
      paymentTerms:      'Net 30',
      shipToLocation:    '742 Evergreen Terrace, Springfield, IL 62701',
      freightTerms:      'N/A — Educational Services',
      documentRefId:     'DOC-FM-0042',
      effectiveDate:     'July 1, 2026',
      lineItems: [
        { name: 'Whole Class Instruction - SG',       sku: 'WCVI-SG-FY27',  unitPrice: 168.83, qty: 10 },
        { name: 'Educator Prep Time',                 sku: 'EDPREP-FY27',   unitPrice: 83.59,  qty: 5  },
        { name: 'Co Teaching',                        sku: 'COT-FY27',      unitPrice: 78.02,  qty: 8  },
        { name: 'Assessments (Pre and Post Testing)', sku: 'ASSESS-FY27',   unitPrice: 44.58,  qty: 20 },
        { name: 'Students with Disabilities',         sku: 'SWD-FY27',      unitPrice: 22.29,  qty: 15 }
      ]
    };
  }
  ```

- [ ] **Step 2: Write a quick sanity test**

  ```javascript
  function testSampleData() {
    var data = getSampleOrderData();
    Logger.log('Buyer: ' + data.buyerCompanyName);
    Logger.log('Line items: ' + data.lineItems.length);
    Logger.log('First SKU: ' + data.lineItems[0].sku);
  }
  ```

- [ ] **Step 3: Run `testSampleData`**

  Expected log:
  ```
  Buyer: Springfield Unified School District
  Line items: 5
  First SKU: WCVI-SG-FY27
  ```

---

## Task 3: MergeFields.gs — Token Replacement

**File:** Create `MergeFields.gs`.

- [ ] **Step 1: Write the replace function**

  ```javascript
  /**
   * Replaces all 12 «FIELD» tokens in the document body with values from data.
   * Also computes and substitutes ORDER_TOTAL from lineItems.
   * @param {GoogleAppsScript.Document.Body} body
   * @param {Object} data  getSampleOrderData() shape
   */
  function replaceAllMergeFields(body, data) {
    var grandTotal = data.lineItems.reduce(function(sum, item) {
      return sum + (item.unitPrice * item.qty);
    }, 0);

    // Build the token → value map.
    // Note: replaceText uses Java regex replacement syntax.
    // Escape any special regex chars in the token strings (« and » are safe literals).
    var fields = {
      '«BUYER_COMPANY_NAME»': data.buyerCompanyName,
      '«BUYER_CONTACT_NAME»': data.buyerContactName,
      '«ACCT_MANAGER_NAME»':  data.acctManagerName,
      '«ORDER_DATE»':         data.orderDate,
      '«DELIVERY_DATE»':      data.deliveryDate,
      '«CONTRACT_REF»':       data.contractRef,
      '«PAYMENT_TERMS»':      data.paymentTerms,
      '«SHIP_TO_LOCATION»':   data.shipToLocation,
      '«FREIGHT_TERMS»':      data.freightTerms,
      '«ORDER_TOTAL»':        'USD ' + grandTotal.toFixed(2),
      '«DOCUMENT_REF_ID»':    data.documentRefId,
      '«EFFECTIVE_DATE»':     data.effectiveDate
    };

    Object.keys(fields).forEach(function(token) {
      body.replaceText(token, fields[token]);
    });
  }
  ```

  > **Note on `«` / `»`:** These are literal Unicode guillemet characters (U+00AB / U+00BB). If copy-pasting this code into Apps Script causes garbled characters, retype them directly or use `«` and `»` in the token strings. The key requirement is that they match the characters in the uploaded template exactly.

  > **Note on ORDER_TOTAL:** The value uses `'USD '` prefix instead of `'$'` to avoid Java replacement-string escaping issues with `$`. If you prefer `$3,956.36` format, use `'$' + grandTotal.toFixed(2)` and test — in practice Apps Script handles it, but `USD` is the safe default.

- [ ] **Step 2: Write a test that works on a real copy**

  ```javascript
  function testMergeFields() {
    var data = getSampleOrderData();

    // Make a test copy of the template so we don't modify the original
    var template = DriveApp.getFileById(TEMPLATE_ID);
    var testCopy = template.makeCopy('TEST — MergeFields', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
    var doc = DocumentApp.openById(testCopy.getId());
    var body = doc.getBody();

    replaceAllMergeFields(body, data);
    doc.saveAndClose();

    Logger.log('Test doc created: ' + testCopy.getUrl());
    Logger.log('Open it and verify all « » tokens are replaced.');
  }
  ```

- [ ] **Step 3: Run `testMergeFields`**

  After it runs, click the URL in the log to open the test doc. Visually verify:
  - "BUYER / CLIENT" section shows "Springfield Unified School District" and "Dr. Jane Holloway"
  - "Order Date" shows "May 26, 2026"
  - "ORDER TOTAL" in the pricing section shows "USD 3956.36"
  - No `«` or `»` characters remain in the document

  Delete the test copy from Drive (`TEST — MergeFields`) before continuing.

---

## Task 4: TableInsertion.gs — Dynamic Pricing Table

**File:** Create `TableInsertion.gs`.

- [ ] **Step 1: Write the table insertion function**

  ```javascript
  /**
   * Finds the [ DYNAMIC TABLE INSERTION ZONE ] paragraph in the body,
   * inserts a formatted pricing table at that position, then removes the placeholder.
   * @param {GoogleAppsScript.Document.Body} body
   * @param {Array} lineItems  array of { name, sku, unitPrice, qty }
   * @returns {number} grandTotal
   */
  function insertPricingTable(body, lineItems) {
    // Build the 2D array that insertTable() accepts
    var grandTotal = 0;

    var tableData = [
      ['Description / Service', 'SKU', 'Unit Price', 'Qty', 'Extended Total']
    ];

    lineItems.forEach(function(item) {
      var extended = item.unitPrice * item.qty;
      grandTotal += extended;
      tableData.push([
        item.name,
        item.sku,
        '$' + item.unitPrice.toFixed(2),
        String(item.qty),
        '$' + extended.toFixed(2)
      ]);
    });

    // Total row
    tableData.push(['', '', '', 'ORDER TOTAL', '$' + grandTotal.toFixed(2)]);

    // Locate the placeholder paragraph(s)
    var paragraphs    = body.getParagraphs();
    var zonePlaceholder     = null;
    var descPlaceholder     = null;

    for (var i = 0; i < paragraphs.length; i++) {
      var text = paragraphs[i].getText();
      if (text.indexOf('[ DYNAMIC TABLE INSERTION ZONE ]') !== -1) {
        zonePlaceholder = paragraphs[i];
      }
      if (text.indexOf('Variable number of line-item rows') !== -1) {
        descPlaceholder = paragraphs[i];
      }
    }

    if (!zonePlaceholder) {
      throw new Error('insertPricingTable: placeholder "[ DYNAMIC TABLE INSERTION ZONE ]" not found. Check template.');
    }

    // Insert the table at the placeholder's child index
    var insertIndex = body.getChildIndex(zonePlaceholder);
    body.insertTable(insertIndex, tableData);

    // Remove both placeholder paragraphs (references stay valid after insertion)
    zonePlaceholder.removeFromParent();
    if (descPlaceholder) {
      descPlaceholder.removeFromParent();
    }

    return grandTotal;
  }
  ```

- [ ] **Step 2: Write the test**

  ```javascript
  function testTableInsertion() {
    var data = getSampleOrderData();

    var template = DriveApp.getFileById(TEMPLATE_ID);
    var testCopy = template.makeCopy('TEST — TableInsertion', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
    var doc = DocumentApp.openById(testCopy.getId());
    var body = doc.getBody();

    var total = insertPricingTable(body, data.lineItems);
    doc.saveAndClose();

    Logger.log('Grand total: $' + total.toFixed(2) + ' (expected: $3956.36)');
    Logger.log('Test doc: ' + testCopy.getUrl());
    Logger.log('Open doc and confirm: table appears where placeholder was, 7 rows (header + 5 items + total), no placeholder text remains.');
  }
  ```

- [ ] **Step 3: Run `testTableInsertion`**

  Expected log:
  ```
  Grand total: $3956.36 (expected: $3956.36)
  Test doc: https://docs.google.com/document/d/...
  ```

  Open the doc. Verify:
  - A table appears where `[ DYNAMIC TABLE INSERTION ZONE ]` was
  - 7 rows: 1 header + 5 item rows + 1 total row
  - "Whole Class Instruction - SG" appears in row 2, column 1
  - Last row shows "ORDER TOTAL" and "$3956.36"
  - Neither placeholder paragraph remains

  Delete the test copy before continuing.

---

## Task 5: SignatureBlock.gs — Fullmind Pre-fill

**File:** Create `SignatureBlock.gs`.

- [ ] **Step 1: Write the pre-fill function**

  ```javascript
  /**
   * Replaces the seller "Authorized Representative, Seller" line with the
   * Fullmind rep's name and title. Called after replaceAllMergeFields so that
   * acctManagerName is still available from data.
   * @param {GoogleAppsScript.Document.Body} body
   * @param {Object} data  getSampleOrderData() shape
   */
  function fillFullmindSignatureBlock(body, data) {
    // Replace the seller role label with rep name + title on two lines.
    // \n in replacement string inserts a newline in Apps Script replaceText.
    body.replaceText(
      'Authorized Representative, Seller',
      data.acctManagerName + '\nAccount Manager, Fullmind Learning'
    );
  }
  ```

- [ ] **Step 2: Write the test**

  ```javascript
  function testSignatureBlock() {
    var data = getSampleOrderData();

    var template = DriveApp.getFileById(TEMPLATE_ID);
    var testCopy = template.makeCopy('TEST — SignatureBlock', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
    var doc = DocumentApp.openById(testCopy.getId());
    var body = doc.getBody();

    // Run merge fields first so «ACCT_MANAGER_NAME» is replaced
    replaceAllMergeFields(body, data);
    fillFullmindSignatureBlock(body, data);
    doc.saveAndClose();

    Logger.log('Test doc: ' + testCopy.getUrl());
    Logger.log('Open and scroll to signatures. Verify: seller block shows "Marcus Webb" and "Account Manager, Fullmind Learning". Buyer block is unchanged.');
  }
  ```

- [ ] **Step 3: Run `testSignatureBlock`**

  Open the test doc and scroll to the last page. Verify:
  - Seller signature area reads `Marcus Webb` on one line, `Account Manager, Fullmind Learning` on the next
  - Buyer signature area still shows the buyer name (already replaced by `replaceAllMergeFields`) and an empty date line

  Delete the test copy before continuing.

---

## Task 6: Code.gs — Orchestrator + PDF Export

**File:** `Code.gs` (the default file, should already exist — clear its contents and replace entirely).

- [ ] **Step 1: Write the main function**

  ```javascript
  /**
   * Main entry point. Copies the template, fills all fields, inserts the
   * pricing table, pre-fills the Fullmind signature block, saves the Doc,
   * and exports a PDF to the Generated PDFs folder.
   *
   * @param {Object} data  Shape defined by getSampleOrderData()
   * @returns {Object} { docUrl: string, pdfUrl: string }
   */
  function generateOrderDocument(data) {
    // 1. Copy template into Generated Orders folder
    var template   = DriveApp.getFileById(TEMPLATE_ID);
    var outputFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
    var pdfFolder  = DriveApp.getFolderById(PDF_FOLDER_ID);

    var docTitle   = 'Order — ' + data.buyerCompanyName + ' — ' + data.contractRef;
    var docCopy    = template.makeCopy(docTitle, outputFolder);
    var doc        = DocumentApp.openById(docCopy.getId());
    var body       = doc.getBody();

    Logger.log('Created doc copy: ' + docCopy.getUrl());

    // 2. Replace merge fields (includes ORDER_TOTAL placeholder replacement)
    replaceAllMergeFields(body, data);
    Logger.log('Merge fields replaced.');

    // 3. Insert pricing table at placeholder zone
    var grandTotal = insertPricingTable(body, data.lineItems);
    Logger.log('Pricing table inserted. Grand total: $' + grandTotal.toFixed(2));

    // 4. Pre-fill Fullmind signature block
    fillFullmindSignatureBlock(body, data);
    Logger.log('Fullmind signature block filled.');

    // 5. Save the Doc
    doc.saveAndClose();
    Logger.log('Document saved.');

    // 6. Export as PDF and save to Generated PDFs folder
    var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs('application/pdf');
    pdfBlob.setName(docTitle + '.pdf');
    var pdfFile = pdfFolder.createFile(pdfBlob);
    Logger.log('PDF exported: ' + pdfFile.getUrl());

    return {
      docUrl: docCopy.getUrl(),
      pdfUrl: pdfFile.getUrl()
    };
  }
  ```

- [ ] **Step 2: Write the end-to-end test runner**

  Below `generateOrderDocument`, add:

  ```javascript
  /**
   * Run this from the Apps Script editor to execute the full end-to-end test.
   * Check the Execution log for URLs and open both files to verify output.
   */
  function runEndToEndTest() {
    var data   = getSampleOrderData();
    var result = generateOrderDocument(data);

    Logger.log('=== END-TO-END TEST COMPLETE ===');
    Logger.log('Doc URL: '  + result.docUrl);
    Logger.log('PDF URL: '  + result.pdfUrl);
    Logger.log('');
    Logger.log('Verification checklist:');
    Logger.log('[ ] Doc: all «FIELD» tokens replaced (search for « in doc to confirm none remain)');
    Logger.log('[ ] Doc: pricing table present with 7 rows (header + 5 items + total)');
    Logger.log('[ ] Doc: grand total = $3956.36');
    Logger.log('[ ] Doc: Fullmind signature block shows "Marcus Webb" + title');
    Logger.log('[ ] PDF: opens correctly, matches doc content, 4 pages');
  }
  ```

- [ ] **Step 3: Run `runEndToEndTest`**

  Select `runEndToEndTest` from the function dropdown and click **Run**.

  Expected log summary:
  ```
  Created doc copy: https://docs.google.com/...
  Merge fields replaced.
  Pricing table inserted. Grand total: $3956.36
  Fullmind signature block filled.
  Document saved.
  PDF exported: https://drive.google.com/...
  === END-TO-END TEST COMPLETE ===
  Doc URL: https://docs.google.com/...
  PDF URL: https://drive.google.com/...
  ```

- [ ] **Step 4: Verify the PDF**

  Click the PDF URL. Open in Google Drive preview (or download). Confirm:
  - 4 pages render without errors
  - "Springfield Unified School District" appears in party info
  - Pricing table is visible on page 2 with correct totals
  - Fullmind rep name appears in the seller signature block

  **Phase 1 is complete at this point.** The PDF proves all three spec goals.

---

## Task 7: Phase 2 — Client e-Signature (Google Workspace eSign)

This task is manual — no script code required. It validates the signing step using the Google Workspace eSign feature already included in Fullmind's Business Plus plan.

- [ ] **Step 1: Open the generated Doc in Drive**

  From the `runEndToEndTest` log, click the Doc URL. The document should be open in Google Docs.

- [ ] **Step 2: Initiate the eSign request**

  In the Google Docs menu, go to **Tools → eSignature** (or click the eSignature button in the right sidebar if visible).

  > If you don't see this option, confirm eSign is enabled for your Workspace org: go to `admin.google.com → Apps → Google Workspace → Drive and Docs → eSignature` and toggle it on.

- [ ] **Step 3: Add signature fields**

  In the eSignature panel:
  - Click **Add signer** → enter the client's email address (use your own email for the POC test)
  - Drag a **Signature** field onto the client signature line at the bottom of the document
  - Drag a **Date** field next to the client date blank

  Click **Send**.

- [ ] **Step 4: Sign as the client (POC test)**

  Open your email (the address you used as the "client"). You should receive a Google eSign request. Open it, click through, and sign.

- [ ] **Step 5: Confirm delivery**

  After signing, both you and the sending account receive the completed PDF via email and in Drive. Open the final PDF and verify:
  - Fullmind signature block: pre-filled with rep name and title
  - Client signature block: shows the e-signature and date
  - Document is locked (no further edits)

  **Phase 2 is complete. All three spec success criteria are met.**

---

## Success Criteria Reference

| Criterion | Task that proves it |
|---|---|
| Template copy created in Drive | Task 6, Step 3 |
| All 12 `«FIELD»` tokens replaced | Task 3, Task 6 |
| `[ DYNAMIC TABLE INSERTION ZONE ]` replaced with 7-row table | Task 4, Task 6 |
| Extended totals and grand total correct ($3,956.36) | Task 4, Task 6 |
| Fullmind signature block pre-filled | Task 5, Task 6 |
| PDF exported without layout errors | Task 6, Step 4 |
| Client receives signing request | Task 7, Step 3 |
| Signed document returned as final PDF | Task 7, Step 5 |
