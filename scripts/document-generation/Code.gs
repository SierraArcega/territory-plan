// ─────────────────────────────────────────────────────────────────────────────
// MAIN ORCHESTRATOR
// generateOrderDocument(data) is the single entry point for document generation.
// It coordinates all steps: template copy → merge fields → table → signature → PDF.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Generates a completed order document from a data object.
 *
 * When USE_GOOGLE_ESIGN = true (Config.gs):
 *   - Inserts [GSIGN_SIG] placeholder, saves the Doc, logs the docUrl.
 *   - No PDF is exported. Run esign-request.js to send for e-signature.
 *
 * When USE_GOOGLE_ESIGN = false:
 *   - Adds Dropbox Sign anchor tags, exports PDF, calls Dropbox Sign API.
 *
 * @param {Object} data  Shape: see getSampleOrderData() in SampleData.gs
 * @returns {{ docUrl: string, pdfUrl: string|null, signatureRequestId: string|null }}
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
  var grandTotal = insertPricingTable(body, data.lineItems);
  Logger.log('Pricing table inserted. Grand total: $' + grandTotal.toFixed(2));

  // 4. Pre-fill Fullmind signature block
  fillFullmindSignatureBlock(body, data);
  Logger.log('Fullmind signature block pre-filled.');

  // 4.5  Prepare for signing (path branches here)
  var pdfFile    = null;
  var eSignResult = null;

  if (USE_GOOGLE_ESIGN) {
    addGSignPlaceholders(body);
    Logger.log('GSign placeholder added.');
  } else {
    addESignAnchorTags(body);
    Logger.log('eSign anchor tags added (Dropbox Sign path).');
  }

  // 5. Save
  doc.saveAndClose();
  Logger.log('Document saved.');

  if (!USE_GOOGLE_ESIGN) {
    // 6. Export PDF (Dropbox Sign path only)
    var pdfBlob = DriveApp.getFileById(docCopy.getId()).getAs('application/pdf');
    pdfBlob.setName(docTitle + '.pdf');
    pdfFile = pdfFolder.createFile(pdfBlob);
    Logger.log('PDF exported: ' + pdfFile.getUrl());

    // 7. Send via Dropbox Sign API
    if (data.signerEmail && data.signerEmail !== 'test@example.com') {
      eSignResult = sendForDropboxSign(
        pdfFile.getId(), data.signerEmail, data.signerName, docTitle
      );
      Logger.log('Dropbox Sign request ID: ' + eSignResult.signatureRequestId);
    } else {
      Logger.log('⚠️  eSign SKIPPED — set a real signerEmail to trigger signing.');
    }
  }

  return {
    docUrl:             docCopy.getUrl(),
    pdfUrl:             pdfFile ? pdfFile.getUrl() : null,
    signatureRequestId: eSignResult ? eSignResult.signatureRequestId : null
  };
}

/**
 * End-to-end test runner. Select this function in the Apps Script editor
 * and click Run to execute the full pipeline against the sample data.
 * Check the Execution log for URLs and the verification checklist.
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
  if (result.pdfUrl) { Logger.log('PDF URL: ' + result.pdfUrl); }
  Logger.log('');
  Logger.log('Verification checklist:');
  Logger.log('[ ] All « » tokens replaced (Ctrl+F for « — none should remain)');
  Logger.log('[ ] Pricing table: 7 rows, grand total = $' + expectedTotal.toFixed(2));
  Logger.log('[ ] Fullmind sig block shows rep name + title');

  if (USE_GOOGLE_ESIGN) {
    Logger.log('[ ] Buyer cell ends with visible "[GSIGN_SIG]" on its own line');
    Logger.log('');
    Logger.log('Next step — run Playwright:');
    Logger.log('  node esign-request.js \\');
    Logger.log('    --docUrl="' + result.docUrl + '" \\');
    Logger.log('    --email="client@example.com" \\');
    Logger.log('    --title="' + data.buyerCompanyName + ' Order"');
  } else {
    Logger.log('[ ] PDF opens correctly, layout intact');
    Logger.log('[ ] Dropbox Sign: https://app.hellosign.com — check for request');
  }
}
