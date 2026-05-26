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
 *
 * Handles two template structures automatically:
 *   A) Placeholder is a direct body child paragraph → inserts a new table at that position
 *   B) Placeholder is inside a table cell (e.g. the ACME template) → inserts rows into
 *      the existing table at the placeholder row's position, then removes the placeholder row
 *
 * The lineItems array is intentionally passed as a parameter — in production this data
 * will come from a Fullmind LMS Opportunity, making the row count variable.
 *
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Array<{name: string, sku: string, unitPrice: number, qty: number}>} lineItems
 * @returns {number} grandTotal  — sum of all Extended Totals
 * @throws {Error} if placeholder paragraph is not found in the document
 */
function insertPricingTable(body, lineItems) {
  var grandTotal = 0;

  // Build row data arrays (5 columns matching the ACME template structure)
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

  // Locate placeholder paragraphs (getParagraphs() traverses into table cells too)
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

  var parent = zonePlaceholder.getParent();

  if (parent.getType() === DocumentApp.ElementType.TABLE_CELL) {
    // ── Case B: placeholder is inside a table cell ───────────────────────────
    // Walk up: Paragraph → TableCell → TableRow → Table
    var tableRow = parent.getParent();
    var table    = tableRow.getParent();
    var rowIndex = table.getChildIndex(tableRow);

    // Insert new data rows immediately before the placeholder row
    newRowsData.forEach(function(rowData, i) {
      var newRow = table.insertTableRow(rowIndex + i);
      rowData.forEach(function(cellText) {
        newRow.appendTableCell(cellText);
      });
    });

    // Remove the placeholder row (now shifted down by newRowsData.length)
    table.removeRow(rowIndex + newRowsData.length);

    // Remove the "Variable number..." row if it exists in the same table
    for (var r = table.getNumRows() - 1; r >= 0; r--) {
      if (table.getRow(r).getText().indexOf('Variable number of line-item rows') !== -1) {
        table.removeRow(r);
        break;
      }
    }

  } else {
    // ── Case A: placeholder is a direct body child ───────────────────────────
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

/**
 * Test: copies template, inserts table, logs grand total and doc URL.
 * Expected grand total: $3956.36
 * Open the doc and confirm: 7-row table where placeholder was, no placeholder text remains.
 * Delete the test copy from Drive when done.
 */
function testTableInsertion() {
  assertConfigured();
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
