// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// generateOrderDocument(data) is the single entry point for document generation.
// It coordinates all steps: template copy → merge fields → table → signature → PDF.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a completed order document and PDF from a data object.
 *
 * Steps:
 *   1. Copy template into Generated Orders folder
 *   2. Replace all «FIELD» merge tokens
 *   3. Insert calculated pricing table at placeholder zone
 *   4. Pre-fill Fullmind signature block
 *   5. Save the Doc
 *   6. Export PDF to Generated PDFs folder
 *
 * @param {Object} data  Shape: see getSampleOrderData() in SampleData.gs
 *
 *   data.lineItems {Array<{name, sku, unitPrice, qty}>}
 *   ─────────────────────────────────────────────────────
 *   POC: populated from getSampleOrderData() (5 hardcoded SKUs).
 *   Production: replace with line items from the Fullmind LMS Opportunity.
 *   The insertPricingTable() function accepts any number of rows — no code
 *   changes needed when the data source switches.
 *
 * @returns {{ docUrl: string, pdfUrl: string }}
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

  // 2. Replace merge fields
  replaceAllMergeFields(body, data);
  Logger.log('Merge fields replaced.');

  // 3. Insert pricing table
  // ── FUTURE INJECTION POINT ──────────────────────────────────────────────────
  // In production, replace data.lineItems with the array of line items from
  // the Fullmind LMS Opportunity associated with this order. The function
  // signature and table structure remain identical — only the data source changes.
  // ────────────────────────────────────────────────────────────────────────────
  var grandTotal = insertPricingTable(body, data.lineItems);
  Logger.log('Pricing table inserted. Grand total: $' + grandTotal.toFixed(2));

  // 4. Pre-fill Fullmind signature block
  fillFullmindSignatureBlock(body, data);
  Logger.log('Fullmind signature block pre-filled.');

  // 5. Save
  doc.saveAndClose();
  Logger.log('Document saved.');

  // 6. Export PDF
  var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs('application/pdf');
  pdfBlob.setName(docTitle + '.pdf');
  var pdfFile = pdfFolder.createFile(pdfBlob);
  Logger.log('PDF exported: ' + pdfFile.getUrl());

  return {
    docUrl: docCopy.getUrl(),
    pdfUrl: pdfFile.getUrl()
  };
}

/**
 * End-to-end test runner. Select this function in the Apps Script editor and
 * click Run to execute the full pipeline against the sample data.
 *
 * Check the Execution log for URLs, then open both files to verify output.
 */
function runEndToEndTest() {
  var data          = getSampleOrderData();
  var expectedTotal = data.lineItems.reduce(function(sum, item) {
    return sum + (item.unitPrice * item.qty);
  }, 0);
  var result = generateOrderDocument(data);

  Logger.log('');
  Logger.log('=== END-TO-END TEST COMPLETE ===');
  Logger.log('Doc URL: ' + result.docUrl);
  Logger.log('PDF URL: ' + result.pdfUrl);
  Logger.log('');
  Logger.log('Verification checklist:');
  Logger.log('[ ] Doc: all « » tokens replaced (Ctrl+F for « to confirm none remain)');
  Logger.log('[ ] Doc: pricing table present with 7 rows (header + 5 items + total)');
  Logger.log('[ ] Doc: grand total = $' + expectedTotal.toFixed(2));
  Logger.log('[ ] Doc: Fullmind signature block shows "Marcus Webb" + title');
  Logger.log('[ ] PDF: opens correctly, matches doc content, layout intact');
}
