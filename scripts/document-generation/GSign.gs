// ─────────────────────────────────────────────────────────────────────────────
// GSIGN
// Inserts a findable text placeholder in the buyer signature cell.
// Used by the Playwright esign-request.js script:
//   1. Playwright finds [GSIGN_SIG] via Cmd+H (Find & Replace → replace with empty)
//   2. Cursor lands at the deletion site
//   3. Playwright clicks Signature in the eSign panel → field placed at cursor
//
// Parallel to addESignAnchorTags() which serves the Dropbox Sign path.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Appends a [GSIGN_SIG] placeholder paragraph to the buyer signature cell.
 * The placeholder is visible black text — intentionally readable during
 * testing. Playwright removes it before the eSign request is sent.
 *
 * @param {GoogleAppsScript.Document.Body} body
 */
function addGSignPlaceholders(body) {
  var tables = body.getTables();
  var placed = false;

  for (var t = 0; t < tables.length && !placed; t++) {
    var table = tables[t];
    for (var r = 0; r < table.getNumRows() && !placed; r++) {
      var row = table.getRow(r);
      for (var c = 0; c < row.getNumCells() && !placed; c++) {
        var cell = row.getCell(c);
        if (cell.getText().indexOf('Authorized Representative, Buyer') !== -1) {
          cell.appendParagraph('[GSIGN_SIG]');
          placed = true;
          Logger.log('GSign: [GSIGN_SIG] inserted in buyer signature cell.');
        }
      }
    }
  }

  if (!placed) {
    Logger.log('GSign WARNING: buyer signature cell not found. ' +
               'Check that "Authorized Representative, Buyer" exists in the template.');
  }
}

/**
 * Standalone test: creates a copy of the template, runs merge fields +
 * signature block + GSign placeholder, and opens the result for inspection.
 * Run from the Apps Script editor. Delete the test copy from Drive when done.
 */
function testGSignPlaceholders() {
  assertConfigured();
  var data     = getSampleOrderData();
  var template = DriveApp.getFileById(TEMPLATE_ID);
  var testCopy = template.makeCopy(
    'TEST — GSignPlaceholders',
    DriveApp.getFolderById(OUTPUT_FOLDER_ID)
  );
  var doc  = DocumentApp.openById(testCopy.getId());
  var body = doc.getBody();

  replaceAllMergeFields(doc, data);
  fillFullmindSignatureBlock(body, data);
  addGSignPlaceholders(body);
  doc.saveAndClose();

  Logger.log('Test doc: ' + testCopy.getUrl());
  Logger.log('Open the doc and verify:');
  Logger.log('[ ] Last line of buyer signature cell shows "[GSIGN_SIG]"');
  Logger.log('[ ] Text is normal-sized and black (visible)');
  Logger.log('Delete this test copy from Drive when done.');
}
