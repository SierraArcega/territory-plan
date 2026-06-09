/**
 * Replaces all <<FIELD>> tokens in the document body with values from payload.
 * Uses escapeRegex() to handle special characters in field delimiters.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} payload  Full deal payload (deal + quote + payment)
 */
function replaceMergeFields(body, payload) {
  var d = payload.deal;
  var q = payload.quote;
  var p = payload.payment;

  var fields = {
    '<<Sender_First>>':   d.sender_first,
    '<<Sender_Last>>':    d.sender_last,
    '<<Sender_Title>>':   d.sender_title,
    '<<Sender_Email>>':   d.sender_email,
    '<<Client_First>>':   d.client_first,
    '<<Client_Last>>':    d.client_last,
    '<<Client_Title>>':   d.client_title,
    '<<Client_Company>>': d.client_company,
    '<<Client_Email>>':   d.client_email,
    '<<School_Year>>':    d.school_year,
    '<<start_date>>':     d.start_date,
    '<<end_date>>':       d.end_date,
    '<<Signer_First>>':   d.signer_first,
    '<<Signer_Last>>':    d.signer_last,
    '<<Signer_Salut>>':   d.signer_salut,
    '<<Signer_Title>>':   d.signer_title,
    '<<today>>':          d.today,
    '<<min_amt>>':        formatCurrency(q.min_amt),
    '<<max_amt>>':        formatCurrency(q.max_amt),
    '<<ORDER_TOTAL>>':    formatCurrency(q.order_total),
    '<<BILLABLE_SUMMARY>>': formatBillableSummary(q.billable_days || 0, q.billable_hours || 0),
    '<<pay_terms>>':      p.pay_terms,
    '<<invoice_date>>':   p.invoice_date,
    '<<contract_end>>':   p.contract_end,
    '<<unused_funds>>':   p.unused_funds,
    '<<billing_name>>':   p.billing_name,
    '<<billing_add>>':    p.billing_add,
    '<<billing_email>>':  p.billing_email,
    '<<billing_phone>>':  p.billing_phone,
    '<<po_yn>>':          p.po_yn ? '☑' : '☐',
    '<<add_terms>>':      p.add_terms   || '',
    '<<imp_detail>>':     p.imp_detail  || '',
    '<<pay_prepost>>':    p.pay_prepost || '',
    '<<boces_name>>':     p.boces_name  || '',
    '<<po_number>>':      p.po_number   || '',
  };

  for (var field in fields) {
    body.replaceText(escapeRegex(field), fields[field] != null ? String(fields[field]) : '');
  }
}

/**
 * Scans the document body for any remaining <<FIELD>> tokens and logs a warning.
 * Call after the final replaceMergeFields pass to catch missing payload values.
 * @param {GoogleAppsScript.Document.Body} body
 */
function validateMergeFields(body) {
  var text      = body.getText();
  var remaining = [];
  var re        = /<<[^>]+>>/g;
  var match;
  while ((match = re.exec(text)) !== null) {
    if (remaining.indexOf(match[0]) === -1) remaining.push(match[0]);
  }
  if (remaining.length > 0) {
    Logger.log('⚠️  Unresolved merge fields: ' + remaining.join(', '));
  } else {
    Logger.log('✅  All merge fields resolved');
  }
}
