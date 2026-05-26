// ─────────────────────────────────────────────────────────────────────────────
// TABLE INSERTION
// Finds the [ DYNAMIC TABLE INSERTION ZONE ] placeholder paragraph and replaces
// it with a formatted pricing table built from lineItems.
//
// The lineItems array is intentionally passed as a parameter — in production
// this data will come from a Fullmind LMS Opportunity, making the row count
// variable. The insertion logic handles any number of rows.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Builds a pricing table from lineItems and inserts it at the placeholder zone.
 * Removes both placeholder paragraphs after insertion.
 *
 * Table columns: Description / Service | SKU | Unit Price | Qty | Extended Total
 * Last row: ORDER TOTAL spanning final column.
 *
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Array<{name: string, sku: string, unitPrice: number, qty: number}>} lineItems
 * @returns {number} grandTotal  — sum of all Extended Totals
 * @throws {Error} if placeholder paragraph is not found in the document
 */
function insertPricingTable(body, lineItems) {
  var grandTotal = 0;

  // Header row + one row per line item + total row
  var tableData = [
    ['Description / Service', 'SKU', 'Unit Price', 'Qty', 'Extended Total']
  ];

  lineItems.forEach(function(item) {
    var extended = item.unitPrice * item.qty;
    grandTotal  += extended;
    tableData.push([
      item.name,
      item.sku,
      '$' + item.unitPrice.toFixed(2),
      String(item.qty),
      '$' + extended.toFixed(2)
    ]);
  });

  tableData.push(['', '', '', 'ORDER TOTAL', '$' + grandTotal.toFixed(2)]);

  // Locate placeholder paragraphs
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
      'insertPricingTable: could not find "[ DYNAMIC TABLE INSERTION ZONE ]" in document. ' +
      'Verify the template was uploaded correctly and the placeholder text is intact.'
    );
  }

  // Insert table at the placeholder's child index, then remove placeholders.
  // References remain valid after insertion, so removeFromParent() works regardless of shift.
  var insertIndex = body.getChildIndex(zonePlaceholder);
  body.insertTable(insertIndex, tableData);
  zonePlaceholder.removeFromParent();
  if (descPlaceholder) {
    descPlaceholder.removeFromParent();
  }

  return grandTotal;
}

/**
 * Test: copies template, inserts table, logs grand total and doc URL.
 * Expected grand total: $3956.36
 * Open the doc and confirm: 7-row table where placeholder was, no placeholder text remains.
 * Delete the test copy from Drive when done.
 */
function testTableInsertion() {
  var data     = getSampleOrderData();
  var template = DriveApp.getFileById(TEMPLATE_ID);
  var testCopy = template.makeCopy('TEST — TableInsertion', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
  var doc      = DocumentApp.openById(testCopy.getId());
  var body     = doc.getBody();

  var total = insertPricingTable(body, data.lineItems);
  doc.saveAndClose();

  Logger.log('Grand total: $' + total.toFixed(2) + ' (expected: $3956.36)');
  Logger.log('Test doc: ' + testCopy.getUrl());
  Logger.log('Verify: table has 7 rows (header + 5 items + total), no placeholder text remains.');
  Logger.log('Delete this test copy from Drive when done.');
}
