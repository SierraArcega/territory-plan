/**
 * Keeps the payment term block matching payment.type (A, B, or C).
 * Deletes the other two blocks entirely (markers + content).
 * Removes marker paragraphs from the kept block.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} payment  payload.payment
 */
function handlePaymentTerms(body, payment) {
  deleteMarkerParagraph(body, '[PAY_TERM_TABLE_INSERT]');
  var type = payment.type;

  var blocks = {
    A: { start: '{{PAY_A_START}}', end: '{{PAY_A_END}}' },
    B: { start: '{{PAY_B_START}}', end: '{{PAY_B_END}}' },
    C: { start: '{{PAY_C_START}}', end: '{{PAY_C_END}}' },
  };

  for (var key in blocks) {
    var markers = blocks[key];
    if (key === type) {
      deleteMarkerParagraph(body, markers.start);
      deleteMarkerParagraph(body, markers.end);
    } else {
      deleteBetweenMarkers(body, markers.start, markers.end);
    }
  }
}
