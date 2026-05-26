# Document Generation — Context Handoff

**Date:** 2026-05-26  
**Project:** Fullmind territory-plan (`feat/document-generation-poc` branch)  
**Purpose:** Paste this entire file into a new context window to continue working on the document generation workflow.

---

## What Was Built and Validated

A Google Apps Script pipeline that replaces PandaDoc for client-facing order document generation. Validated end-to-end today.

**Three capabilities proven:**
1. PDF generation from a Google Doc template (Drive copy → DocumentApp → getAs PDF)
2. Calculated pricing table from external SKU data — variable number of rows, driven by input data
3. Dynamic field replacement and e-signature placement without fixed coordinates — anchor tags placed by content, not position

**Full pipeline (runs in ~5 seconds):**
1. Copy master template in Drive
2. Replace all `«TOKEN»` merge fields (body + header + footer)
3. Insert calculated pricing table at `[ DYNAMIC TABLE INSERTION ZONE ]` placeholder
4. Pre-fill Fullmind rep signature block
5. Embed invisible Dropbox Sign anchor tags in client signature cell
6. Export to PDF
7. Send PDF to Dropbox Sign API → client receives signing email with fields already placed

---

## Google Drive Configuration

| Item | Value |
|---|---|
| Template Doc ID | `1eyi6PmXOVXG0hUqzNIHozBfNPWUUYuZapNiK3WsIojM` |
| Template URL | https://docs.google.com/document/d/1eyi6PmXOVXG0hUqzNIHozBfNPWUUYuZapNiK3WsIojM/edit |
| Generated Orders folder | `19ozLBWn3zyX3ZSKRRHq9n0mnhjhkaBFN` |
| Generated PDFs folder | `1etHVzYQb_xKFu6igcYyXxoYUFG8lrE7z` |
| Template folder (source) | `1jtZ7VDFICW2OHHIB4RBbIJgdKeAsltXb` |

**Script Properties (set in Apps Script editor → ⚙ Project Settings → Script Properties):**

| Property | Notes |
|---|---|
| `DROPBOX_SIGN_API_KEY` | Set — API key stored securely, not in code |
| `TEST_SIGNER_EMAIL` | Set to `aston.arcega+test@fullmindlearning.com` |
| `TEST_SIGNER_NAME` | Set to `TAston-Marty Correa Arcega` |

**Test mode:** `'test_mode': '1'` is active in `ESign.gs` — no real emails sent, all requests visible in Dropbox Sign dashboard at https://app.hellosign.com. Remove this line for production.

---

## File Structure

All 7 files live in `scripts/document-generation/` in the repo AND are pasted into a standalone Google Apps Script project. They share one global namespace.

---

## Current File Contents (canonical — paste into Apps Script as-is)

### Config.gs

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// Fill in your Drive IDs after completing the Drive setup in Task 0.
// ─────────────────────────────────────────────────────────────────────────────

var TEMPLATE_ID      = '1eyi6PmXOVXG0hUqzNIHozBfNPWUUYuZapNiK3WsIojM'; // [TEMPLATE] Purchase Order Agreement (native Google Doc)
var OUTPUT_FOLDER_ID = '19ozLBWn3zyX3ZSKRRHq9n0mnhjhkaBFN';  // Generated Orders folder
var PDF_FOLDER_ID    = '1etHVzYQb_xKFu6igcYyXxoYUFG8lrE7z';  // Generated PDFs folder

function testConfig() {
  assertConfigured();
  var template  = DriveApp.getFileById(TEMPLATE_ID);
  var outFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var pdfFolder = DriveApp.getFolderById(PDF_FOLDER_ID);
  Logger.log('Template name: ' + template.getName());
  Logger.log('Output folder: ' + outFolder.getName());
  Logger.log('PDF folder:    ' + pdfFolder.getName());
}

function assertConfigured() {
  if (TEMPLATE_ID === 'YOUR_TEMPLATE_DOC_ID_HERE' ||
      OUTPUT_FOLDER_ID === 'YOUR_GENERATED_ORDERS_FOLDER_ID_HERE' ||
      PDF_FOLDER_ID === 'YOUR_GENERATED_PDFS_FOLDER_ID_HERE') {
    throw new Error(
      'Config not set up: fill in TEMPLATE_ID, OUTPUT_FOLDER_ID, and PDF_FOLDER_ID ' +
      'in Config.gs before running. See README — Task 3: Fill in Drive IDs.'
    );
  }
}
```

---

### SampleData.gs

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// SAMPLE DATA
// Hardcoded test input for the POC. In production, field values will come from
// a Fullmind plan/district record, and lineItems will come from a Fullmind
// LMS Opportunity.
// ─────────────────────────────────────────────────────────────────────────────

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
    orderNumber:       'PO-FM-2026-0042',
    signerEmail:       'test@example.com',   // replace with real email to trigger live send
    signerName:        'Dr. Jane Holloway',
    lineItems: [
      { name: 'Whole Class Instruction - SG',       sku: 'WCVI-SG-FY27',  unitPrice: 168.83, qty: 10 },
      { name: 'Educator Prep Time',                 sku: 'EDPREP-FY27',   unitPrice: 83.59,  qty: 5  },
      { name: 'Co Teaching',                        sku: 'COT-FY27',      unitPrice: 78.02,  qty: 8  },
      { name: 'Assessments (Pre and Post Testing)', sku: 'ASSESS-FY27',   unitPrice: 44.58,  qty: 20 },
      { name: 'Students with Disabilities',         sku: 'SWD-FY27',      unitPrice: 22.29,  qty: 15 }
    ]
  };
}

function testSampleData() {
  var data = getSampleOrderData();
  Logger.log('Buyer: '       + data.buyerCompanyName);
  Logger.log('Line items: '  + data.lineItems.length);
  Logger.log('First SKU: '   + data.lineItems[0].sku);
  Logger.log('First price: ' + data.lineItems[0].unitPrice);
}
```

---

### MergeFields.gs

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// MERGE FIELDS
// Replaces all 13 «FIELD» tokens in the document body, header, and footer.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes $ and \ in replacement strings for Apps Script replaceText().
 * replaceText follows Java Matcher.replaceAll conventions — without escaping,
 * values containing $ or \ produce wrong output.
 */
function escapeReplacement(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\$/g, '\\$');
}

/**
 * Replaces all «TOKEN» merge fields in body, header, and footer.
 * ORDER_TOTAL is computed from lineItems.
 *
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {Object} data  getSampleOrderData() shape
 */
function replaceAllMergeFields(doc, data) {
  var body = doc.getBody();
  var grandTotal = data.lineItems.reduce(function(sum, item) {
    return sum + (item.unitPrice * item.qty);
  }, 0);

  var fields = {
    '«BUYER_COMPANY_NAME»': escapeReplacement(data.buyerCompanyName),
    '«BUYER_CONTACT_NAME»': escapeReplacement(data.buyerContactName),
    '«ACCT_MANAGER_NAME»':  escapeReplacement(data.acctManagerName),
    '«ORDER_DATE»':         escapeReplacement(data.orderDate),
    '«DELIVERY_DATE»':      escapeReplacement(data.deliveryDate),
    '«CONTRACT_REF»':       escapeReplacement(data.contractRef),
    '«PAYMENT_TERMS»':      escapeReplacement(data.paymentTerms),
    '«SHIP_TO_LOCATION»':   escapeReplacement(data.shipToLocation),
    '«FREIGHT_TERMS»':      escapeReplacement(data.freightTerms),
    '«ORDER_TOTAL»':        'USD ' + grandTotal.toFixed(2),  // no $ to avoid escaping edge case
    '«DOCUMENT_REF_ID»':    escapeReplacement(data.documentRefId),
    '«EFFECTIVE_DATE»':     escapeReplacement(data.effectiveDate),
    '«ORDER_NUMBER»':       escapeReplacement(data.orderNumber)
  };

  Object.keys(fields).forEach(function(token) {
    body.replaceText(token, fields[token]);
  });

  // body.replaceText() does NOT reach headers/footers — replace separately
  try {
    var header = doc.getHeader();
    if (header) {
      Object.keys(fields).forEach(function(token) { header.replaceText(token, fields[token]); });
    }
  } catch (e) { Logger.log('Header replacement skipped: ' + e.message); }

  try {
    var footer = doc.getFooter();
    if (footer) {
      Object.keys(fields).forEach(function(token) { footer.replaceText(token, fields[token]); });
    }
  } catch (e) { Logger.log('Footer replacement skipped: ' + e.message); }
}

function testMergeFields() {
  assertConfigured();
  var data     = getSampleOrderData();
  var template = DriveApp.getFileById(TEMPLATE_ID);
  var testCopy = template.makeCopy('TEST — MergeFields', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
  var doc      = DocumentApp.openById(testCopy.getId());
  replaceAllMergeFields(doc, data);
  doc.saveAndClose();
  Logger.log('Test doc: ' + testCopy.getUrl());
  Logger.log('Open and verify: all « » tokens replaced. Delete copy when done.');
}
```

---

### TableInsertion.gs

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// TABLE INSERTION
// Finds the [ DYNAMIC TABLE INSERTION ZONE ] placeholder and replaces it with
// a formatted pricing table built from lineItems.
//
// Handles two template structures:
//   A) Placeholder is a direct body child → inserts a new table at that position
//   B) Placeholder is inside a table cell (ACME template) → inserts rows into
//      the existing table at the placeholder row's position
// ─────────────────────────────────────────────────────────────────────────────

/**
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Array<{name, sku, unitPrice, qty}>} lineItems
 * @returns {number} grandTotal
 */
function insertPricingTable(body, lineItems) {
  var grandTotal = 0;

  var newRowsData = [];
  lineItems.forEach(function(item) {
    var extended = item.unitPrice * item.qty;
    grandTotal  += extended;
    newRowsData.push([
      item.name + ' [' + item.sku + ']',
      String(item.qty),
      'Session',
      '$' + item.unitPrice.toFixed(2),
      '$' + extended.toFixed(2)
    ]);
  });
  newRowsData.push(['', '', '', 'SUBTOTAL', '$' + grandTotal.toFixed(2)]);

  var paragraphs      = body.getParagraphs();
  var zonePlaceholder = null;
  var descPlaceholder = null;

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
    throw new Error(
      'insertPricingTable: could not find "[ DYNAMIC TABLE INSERTION ZONE ]" in document.'
    );
  }

  var parent = zonePlaceholder.getParent();

  if (parent.getType() === DocumentApp.ElementType.TABLE_CELL) {
    // Case B: placeholder is inside a table cell (ACME template structure)
    var tableRow = parent.getParent();
    var table    = tableRow.getParent();
    var rowIndex = table.getChildIndex(tableRow);

    newRowsData.forEach(function(rowData, i) {
      var newRow = table.insertTableRow(rowIndex + i);
      rowData.forEach(function(cellText) {
        newRow.appendTableCell(cellText);
      });
    });

    table.removeRow(rowIndex + newRowsData.length);

    for (var r = table.getNumRows() - 1; r >= 0; r--) {
      if (table.getRow(r).getText().indexOf('Variable number of line-item rows') !== -1) {
        table.removeRow(r);
        break;
      }
    }
  } else {
    // Case A: placeholder is a direct body child
    var headerRow   = ['Description / Part No.', 'Qty', 'Unit', 'Unit Price', 'Extended Total'];
    var insertIndex = body.getChildIndex(zonePlaceholder);
    body.insertTable(insertIndex, [headerRow].concat(newRowsData));
    zonePlaceholder.removeFromParent();
    if (descPlaceholder && descPlaceholder !== zonePlaceholder) {
      descPlaceholder.removeFromParent();
    }
  }

  return grandTotal;
}

function testTableInsertion() {
  assertConfigured();
  var data     = getSampleOrderData();
  var template = DriveApp.getFileById(TEMPLATE_ID);
  var testCopy = template.makeCopy('TEST — TableInsertion', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
  var doc      = DocumentApp.openById(testCopy.getId());
  var body     = doc.getBody();
  var total    = insertPricingTable(body, data.lineItems);
  doc.saveAndClose();
  Logger.log('Grand total: $' + total.toFixed(2) + ' (expected: $3956.36)');
  Logger.log('Test doc: ' + testCopy.getUrl());
  Logger.log('Verify: table has 7 rows (header + 5 items + total), no placeholder text remains.');
  Logger.log('Delete this test copy from Drive when done.');
}
```

---

### SignatureBlock.gs

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE BLOCK
// Pre-fills the Fullmind (seller) signature block. The client is the only
// party who performs a live e-signature.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replaces "Authorized Representative, Seller" with rep name + title.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} data  uses data.acctManagerName
 */
function fillFullmindSignatureBlock(body, data) {
  body.replaceText(
    'Authorized Representative, Seller',
    data.acctManagerName + '\nAccount Manager, Fullmind Learning'
  );
}

function testSignatureBlock() {
  assertConfigured();
  var data     = getSampleOrderData();
  var template = DriveApp.getFileById(TEMPLATE_ID);
  var testCopy = template.makeCopy('TEST — SignatureBlock', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
  var doc      = DocumentApp.openById(testCopy.getId());
  var body     = doc.getBody();
  replaceAllMergeFields(doc, data);
  fillFullmindSignatureBlock(body, data);
  doc.saveAndClose();
  Logger.log('Test doc: ' + testCopy.getUrl());
  Logger.log('Verify: seller block shows "' + data.acctManagerName + '" + title. Delete copy when done.');
}
```

---

### ESign.gs

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// ESIGN — DROPBOX SIGN INTEGRATION
//
// API key stored in Script Properties (never in code):
//   Apps Script editor → ⚙ Project Settings → Script Properties
//   → DROPBOX_SIGN_API_KEY = <key>
// ─────────────────────────────────────────────────────────────────────────────

var DROPBOX_SIGN_API_URL = 'https://api.hellosign.com/v3/signature_request/send';

/**
 * Appends invisible Dropbox Sign text anchor tags inside the buyer signature cell.
 * Tags are 1pt white text — invisible in the Doc and hidden in the signing view.
 *
 *   [sig|req|signer1]   — signature field for the client
 *   [date|req|signer1]  — date field for the client
 *
 * Placement is content-relative (finds "Authorized Representative, Buyer"),
 * not coordinate-relative — works regardless of page layout.
 *
 * @param {GoogleAppsScript.Document.Body} body
 */
function addESignAnchorTags(body) {
  var tables   = body.getTables();
  var tagAdded = false;

  for (var t = 0; t < tables.length && !tagAdded; t++) {
    var table = tables[t];
    for (var r = 0; r < table.getNumRows() && !tagAdded; r++) {
      var row = table.getRow(r);
      for (var c = 0; c < row.getNumCells() && !tagAdded; c++) {
        var cell = row.getCell(c);
        if (cell.getText().indexOf('Authorized Representative, Buyer') !== -1) {
          var sigPara = cell.appendParagraph('[sig|req|signer1]');
          sigPara.editAsText().setFontSize(1).setForegroundColor('#FFFFFF');
          var datePara = cell.appendParagraph('[date|req|signer1]');
          datePara.editAsText().setFontSize(1).setForegroundColor('#FFFFFF');
          tagAdded = true;
          Logger.log('eSign anchor tags added to buyer signature cell.');
        }
      }
    }
  }

  if (!tagAdded) {
    Logger.log('Warning: Could not find buyer signature cell. ' +
               'Check "Authorized Representative, Buyer" exists in template.');
  }
}

/**
 * Sends the generated PDF to Dropbox Sign for client e-signature.
 * PDF must already contain the anchor tags (added by addESignAnchorTags before export).
 *
 * @param {string} pdfFileId   Drive file ID of the exported PDF
 * @param {string} signerEmail Client's email address
 * @param {string} signerName  Client's full name
 * @param {string} docTitle    Document title
 * @returns {{ signatureRequestId: string }}
 */
function sendForDropboxSign(pdfFileId, signerEmail, signerName, docTitle) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('DROPBOX_SIGN_API_KEY');
  if (!apiKey) {
    throw new Error('DROPBOX_SIGN_API_KEY not set in Script Properties.');
  }

  var pdfBlob = DriveApp.getFileById(pdfFileId).getAs('application/pdf');
  pdfBlob.setName(docTitle + '.pdf');

  var payload = {
    'title':                     docTitle,
    'subject':                   'Action Required: Please sign your Fullmind Service Agreement',
    'message':                   'Please review and sign the attached Fullmind Service Order Agreement.',
    'signers[0][email_address]': signerEmail,
    'signers[0][name]':          signerName,
    'files[0]':                  pdfBlob,
    'use_text_tags':             '1',
    'hide_text_tags':            '1',
    'test_mode':                 '1'   // ← REMOVE FOR PRODUCTION
  };

  var options = {
    'method':             'post',
    'headers': { 'Authorization': 'Basic ' + Utilities.base64Encode(apiKey + ':') },
    'payload':            payload,
    'muteHttpExceptions': true
  };

  var response     = UrlFetchApp.fetch(DROPBOX_SIGN_API_URL, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();

  Logger.log('Dropbox Sign HTTP status: ' + responseCode);

  if (responseCode !== 200) {
    throw new Error('Dropbox Sign API error (' + responseCode + '): ' + responseBody);
  }

  var result    = JSON.parse(responseBody);
  var requestId = result.signature_request.signature_request_id;
  Logger.log('Signature request created: ' + requestId);
  return { signatureRequestId: requestId };
}

function testESign() {
  assertConfigured();
  var signerEmail = PropertiesService.getScriptProperties().getProperty('TEST_SIGNER_EMAIL') || '';
  var signerName  = PropertiesService.getScriptProperties().getProperty('TEST_SIGNER_NAME')  || '';
  if (!signerEmail || signerEmail.indexOf('example.com') !== -1) {
    throw new Error('Set TEST_SIGNER_EMAIL in Script Properties before running testESign.');
  }
  var pdfFolder = DriveApp.getFolderById(PDF_FOLDER_ID);
  var files     = pdfFolder.getFilesByMimeType('application/pdf');
  var pdfFile   = null;
  while (files.hasNext()) {
    var f = files.next();
    if (!pdfFile || f.getDateCreated() > pdfFile.getDateCreated()) { pdfFile = f; }
  }
  if (!pdfFile) { throw new Error('No PDF found. Run runEndToEndTest first.'); }
  Logger.log('Sending: ' + pdfFile.getName());
  var result = sendForDropboxSign(pdfFile.getId(), signerEmail, signerName, pdfFile.getName());
  Logger.log('Request ID: ' + result.signatureRequestId);
}
```

---

### Code.gs

```javascript
// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// generateOrderDocument(data) is the single entry point.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a completed order document and PDF from a data object.
 *
 * Production injection point: replace getSampleOrderData() with data from
 * the Fullmind LMS Opportunity. This function's signature does not change.
 *
 * @param {Object} data  See getSampleOrderData() for shape
 * @returns {{ docUrl, pdfUrl, signatureRequestId }}
 */
function generateOrderDocument(data) {
  assertConfigured();
  var outputFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var pdfFolder    = DriveApp.getFolderById(PDF_FOLDER_ID);
  var template     = DriveApp.getFileById(TEMPLATE_ID);

  // 1. Copy template
  var docTitle = 'Order — ' + data.buyerCompanyName + ' — ' + data.contractRef;
  var docCopy  = template.makeCopy(docTitle, outputFolder);
  var doc      = DocumentApp.openById(docCopy.getId());
  var body     = doc.getBody();
  Logger.log('Created doc copy: ' + docCopy.getUrl());

  // 2. Replace merge fields (body + header + footer)
  replaceAllMergeFields(doc, data);
  Logger.log('Merge fields replaced.');

  // 3. Insert pricing table
  // FUTURE: replace data.lineItems with Fullmind LMS Opportunity line items.
  // insertPricingTable() accepts any number of rows — no code changes needed.
  var grandTotal = insertPricingTable(body, data.lineItems);
  Logger.log('Pricing table inserted. Grand total: $' + grandTotal.toFixed(2));

  // 4. Pre-fill Fullmind signature block
  fillFullmindSignatureBlock(body, data);
  Logger.log('Fullmind signature block pre-filled.');

  // 4.5 Add invisible eSign anchor tags before PDF export
  addESignAnchorTags(body);
  Logger.log('eSign anchor tags added.');

  // 5. Save
  doc.saveAndClose();
  Logger.log('Document saved.');

  // 6. Export PDF
  var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs('application/pdf');
  pdfBlob.setName(docTitle + '.pdf');
  var pdfFile = pdfFolder.createFile(pdfBlob);
  Logger.log('PDF exported: ' + pdfFile.getUrl());

  // 7. Send for e-signature
  var eSignResult = null;
  if (data.signerEmail && data.signerEmail !== 'test@example.com') {
    eSignResult = sendForDropboxSign(pdfFile.getId(), data.signerEmail, data.signerName, docTitle);
    Logger.log('Dropbox Sign request ID: ' + eSignResult.signatureRequestId);
  } else {
    Logger.log('⚠️  eSign SKIPPED — set a real signerEmail to trigger signing.');
  }

  return {
    docUrl:             docCopy.getUrl(),
    pdfUrl:             pdfFile.getUrl(),
    signatureRequestId: eSignResult ? eSignResult.signatureRequestId : null
  };
}

function runEndToEndTest() {
  var data          = getSampleOrderData();
  var expectedTotal = data.lineItems.reduce(function(sum, i) { return sum + (i.unitPrice * i.qty); }, 0);
  var result        = generateOrderDocument(data);

  Logger.log('');
  Logger.log('=== END-TO-END TEST COMPLETE ===');
  Logger.log('Doc URL: ' + result.docUrl);
  Logger.log('PDF URL: ' + result.pdfUrl);
  Logger.log('');
  Logger.log('Checklist:');
  Logger.log('[ ] All « » tokens replaced');
  Logger.log('[ ] Pricing table: 7 rows, grand total = $' + expectedTotal.toFixed(2));
  Logger.log('[ ] Fullmind sig block: "Marcus Webb" + title');
  Logger.log('[ ] PDF layout intact');
  Logger.log('[ ] Dropbox Sign: https://app.hellosign.com (test_mode=1 — no real email sent)');
}
```

---

## Known Issues / Things to Explore

### 1. Table styling (not yet addressed)
The pricing table inserted by `TableInsertion.gs` (Case B — existing table rows) inherits whatever style the placeholder row had. The inserted rows may not have the correct borders, column widths, font, or alignment to match the rest of the ACME template. This was not tested visually. Challenge: can `TableRow` and `TableCell` style APIs in Apps Script match the existing table formatting?

### 2. Anchor tag font size (low priority)
`addESignAnchorTags()` uses 1pt white text. This worked in the POC — the tags survived PDF export and were detected by Dropbox Sign. If this breaks on a different template or Google Doc format, increase to 8pt white. Not currently a problem.

### 3. ORDER_TOTAL uses "USD" prefix instead of "$"
`«ORDER_TOTAL»` is replaced with `USD 3956.36` rather than `$3,956.36`. The reason: `$` in Apps Script `replaceText()` replacement strings follows Java Matcher.replaceAll conventions, where `$n` refers to capture groups. Escaping was attempted but `USD` prefix was used as a safe fallback. Challenge: make this render as `$3,956.36` in the final document.

### 4. "Acme Industrial Supply Co." still in seller header
`fillFullmindSignatureBlock()` replaced "Authorized Representative, Seller" but not the company name line above it ("Acme Industrial Supply Co."). Left intentionally for the POC since the production template will be completely different. If needed: add `body.replaceText('Acme Industrial Supply Co\\.', 'Fullmind Learning');` to `SignatureBlock.gs`.

### 5. No table of contents / no multi-document support
Out of scope for this POC. The production spec will cover batch generation.

---

## Production Readiness Checklist

To go from POC to production, only these things change:

| Change | Where | Notes |
|---|---|---|
| Swap data source | `Code.gs` step 3 comment | `lineItems` from LMS Opportunity instead of `getSampleOrderData()` |
| Swap template ID | `Config.gs` | Point to the real Fullmind order template |
| Remove test mode | `ESign.gs` line 105 | Delete `'test_mode': '1'` |
| Move to Next.js API route | New file | Optional — Apps Script can run standalone indefinitely |

The `generateOrderDocument(data)` function signature is stable — it won't change regardless of how the data source changes.

---

## Suggested Next Challenges

1. **Style the inserted table rows** — make the dynamically inserted pricing rows match the template's existing table formatting (borders, font size, column widths)
2. **`$` formatting for ORDER_TOTAL** — fix the currency display without breaking replaceText
3. **Add a second signer** — the Dropbox Sign payload currently has one signer (`signers[0]`). What does the payload look like for two signers (Fullmind rep + client)?
4. **Webhook on signing complete** — Dropbox Sign can POST to a callback URL when the document is signed. What would that callback look like wired to a Next.js route that updates a Plan record in the database?
5. **Move to Next.js API route** — replace the Apps Script orchestrator with a `POST /api/documents/generate-order` route using the Google Docs REST API and service account auth
