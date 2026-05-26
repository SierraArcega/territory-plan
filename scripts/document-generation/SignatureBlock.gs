// ─────────────────────────────────────────────────────────────────────────────
// SIGNATURE BLOCK
// Pre-fills the Fullmind (seller) signature block so the document arrives at
// the client already showing the rep's name and title. The client is the only
// party who performs a live e-signature.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replaces "Authorized Representative, Seller" in the signature block with
 * the rep's name and title on two lines.
 *
 * Called after replaceAllMergeFields so all other tokens are already resolved.
 *
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} data  getSampleOrderData() shape — uses data.acctManagerName
 */
function fillFullmindSignatureBlock(body, data) {
  // "Authorized Representative, Seller" appears only once — in the signature block.
  // Replacing it with name + \n + title pre-fills the Fullmind side of the agreement.
  body.replaceText(
    'Authorized Representative, Seller',
    data.acctManagerName + '\nAccount Manager, Fullmind Learning'
  );
}

/**
 * Test: copies template, runs merge fields + signature block fill, logs doc URL.
 * Open and scroll to signatures. Verify seller block shows rep name and title.
 * Buyer block should be unchanged (empty date line).
 * Delete the test copy from Drive when done.
 */
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
  Logger.log('Verify: seller block shows "' + data.acctManagerName + '" + "Account Manager, Fullmind Learning".');
  Logger.log('Buyer block should still have the buyer name and an empty date line.');
  Logger.log('Delete this test copy from Drive when done.');
}
