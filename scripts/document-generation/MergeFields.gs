// ─────────────────────────────────────────────────────────────────────────────
// MERGE FIELDS
// Replaces all 12 «FIELD» tokens in the document body with real values.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Escapes special regex replacement characters in a string so it can be safely
 * passed as the second argument to Body.replaceText().
 * In Apps Script's replaceText, the replacement string follows Java's
 * Matcher.replaceAll conventions: $n refers to capture groups, \\ is a literal
 * backslash. Without escaping, values containing $ or \ will produce wrong output.
 * @param {string} s
 * @returns {string}
 */
function escapeReplacement(s) {
  return String(s).replace(/\\/g, '\\\\').replace(/\$/g, '\\$');
}

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
    '«BUYER_COMPANY_NAME»': escapeReplacement(data.buyerCompanyName),
    '«BUYER_CONTACT_NAME»': escapeReplacement(data.buyerContactName),
    '«ACCT_MANAGER_NAME»':  escapeReplacement(data.acctManagerName),
    '«ORDER_DATE»':         escapeReplacement(data.orderDate),
    '«DELIVERY_DATE»':      escapeReplacement(data.deliveryDate),
    '«CONTRACT_REF»':       escapeReplacement(data.contractRef),
    '«PAYMENT_TERMS»':      escapeReplacement(data.paymentTerms),
    '«SHIP_TO_LOCATION»':   escapeReplacement(data.shipToLocation),
    '«FREIGHT_TERMS»':      escapeReplacement(data.freightTerms),
    '«ORDER_TOTAL»':        'USD ' + grandTotal.toFixed(2),   // already safe — no $ in value
    '«DOCUMENT_REF_ID»':    escapeReplacement(data.documentRefId),
    '«EFFECTIVE_DATE»':     escapeReplacement(data.effectiveDate)
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
  assertConfigured();
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
