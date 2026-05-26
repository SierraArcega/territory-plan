// ─────────────────────────────────────────────────────────────────────────────
// MERGE FIELDS
// Replaces all 12 «FIELD» tokens in the document body with real values.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Replaces all «FIELD» tokens in the document body with values from data.
 * Computes ORDER_TOTAL from lineItems and substitutes it too.
 *
 * Token format: «FIELD_NAME» (Unicode guillemets U+00AB / U+00BB).
 * If copy-pasting causes garbled characters, retype the « » directly or
 * verify they match the characters in the uploaded Google Doc template exactly.
 *
 * Note on ORDER_TOTAL: uses 'USD ' prefix instead of '$' to avoid Java
 * replacement-string escaping edge cases. Change to '$' if preferred and test.
 *
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} data  getSampleOrderData() shape
 */
function replaceAllMergeFields(body, data) {
  var grandTotal = data.lineItems.reduce(function(sum, item) {
    return sum + (item.unitPrice * item.qty);
  }, 0);

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

/**
 * Test: copies template, runs replaceAllMergeFields, logs the doc URL.
 * Open the URL and search for «  to confirm no tokens remain.
 * Delete the test copy from Drive before re-running.
 */
function testMergeFields() {
  var data      = getSampleOrderData();
  var template  = DriveApp.getFileById(TEMPLATE_ID);
  var testCopy  = template.makeCopy('TEST — MergeFields', DriveApp.getFolderById(OUTPUT_FOLDER_ID));
  var doc       = DocumentApp.openById(testCopy.getId());
  var body      = doc.getBody();

  replaceAllMergeFields(body, data);
  doc.saveAndClose();

  Logger.log('Test doc: ' + testCopy.getUrl());
  Logger.log('Open and verify: all « » tokens replaced, ORDER_TOTAL shows correct value.');
  Logger.log('Delete this test copy from Drive when done.');
}
