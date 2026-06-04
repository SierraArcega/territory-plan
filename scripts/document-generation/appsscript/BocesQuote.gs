/**
 * Computes the BOCES quote table totals from line items and a percentage fee.
 * Pure function — no Document dependency, unit-testable in the editor.
 * @param {Array<{product:string, rate:number, qty:number}>} lineItems
 * @param {number} [feePct=10.6]  Fee percentage applied to the line-item subtotal.
 * @returns {{rows:Array<{product:string,rate:number,qty:number,total:number}>,
 *           subtotal:number, feePct:number, fee:number, total:number}}
 */
function computeBocesQuoteTotals(lineItems, feePct) {
  var pct = (feePct == null) ? 10.6 : feePct;

  var rows = lineItems.map(function(item) {
    return {
      product: item.product,
      rate:    item.rate,
      qty:     item.qty,
      total:   round2(item.rate * item.qty),
    };
  });

  var subtotal = round2(rows.reduce(function(s, r) { return s + r.total; }, 0));
  var fee      = round2(subtotal * pct / 100);
  var total    = round2(subtotal + fee);

  return { rows: rows, subtotal: subtotal, feePct: pct, fee: fee, total: total };
}

/** Rounds a positive dollar amount to 2 decimal places, avoiding binary float
 *  drift. Assumes non-negative input (BOCES quotes have no negative line items);
 *  the +EPSILON nudge biases toward zero for negatives. */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

/**
 * Replaces the BOCES Quote's <<FIELD>> tokens. Intentionally a separate, smaller
 * map than the contract's replaceMergeFields — the BOCES payload has no
 * payment block and adds <<quote_number>>.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} payload  BOCES quote payload (deal only)
 */
function replaceBocesMergeFields(body, payload) {
  var d = payload.deal;
  var fields = {
    '<<quote_number>>':   d.quote_number,
    '<<Client_Company>>': d.client_company,
    '<<start_date>>':     d.start_date,
    '<<end_date>>':       d.end_date,
    '<<today>>':          d.today,
  };
  for (var field in fields) {
    body.replaceText(escapeRegex(field), fields[field] != null ? String(fields[field]) : '');
  }
}

/**
 * Builds the "Anticipated Educator Need" table at the [BOCES_QUOTE_TABLE_INSERT]
 * marker, then removes the marker. Columns: Product, Hourly Rate, Hours, Total.
 * No discount column. Fee row shows the percentage; Total row shows subtotal+fee.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote ({ fee_pct, line_items })
 */
function buildBocesQuoteTable(body, quote) {
  var t = computeBocesQuoteTotals(quote.line_items, quote.fee_pct);

  var markerIdx = findParagraphIndex(body, '[BOCES_QUOTE_TABLE_INSERT]');
  if (markerIdx === -1) {
    Logger.log('Warning: [BOCES_QUOTE_TABLE_INSERT] marker not found — skipping table build');
    return;
  }

  var headerRow = ['Product', 'Hourly Rate', 'Hours', 'Total'];
  var dataRows  = t.rows.map(function(r) {
    return [r.product, formatCurrency(r.rate), String(r.qty), formatCurrency(r.total)];
  });
  var feeRow   = ['', '', 'Fee', t.feePct + ' %'];
  var totalRow = ['', '', 'Total', formatCurrency(t.total)];

  var allRows = [headerRow].concat(dataRows).concat([feeRow, totalRow]);
  var newTable = body.insertTable(markerIdx + 1, allRows);

  // Proportional column widths scaled to the 540pt content area (8.5" − 0.5" margins).
  var naturalWidths = [220, 110, 90, 120];
  var rawTotal = naturalWidths.reduce(function(s, w) { return s + w; }, 0);
  naturalWidths.forEach(function(w, i) {
    newTable.setColumnWidth(i, Math.round(w / rawTotal * 540));
  });

  applyFullmindTableStyle(newTable);

  // Bold the Fee and Total rows.
  var n = newTable.getNumRows();
  [n - 2, n - 1].forEach(function(rowIdx) {
    var row = newTable.getRow(rowIdx);
    for (var c = 0; c < row.getNumCells(); c++) {
      row.getCell(c).editAsText().setBold(true);
    }
  });

  // Remove the marker paragraph now that the table sits after it.
  body.getChild(markerIdx).removeFromParent();
}
