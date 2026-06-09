/**
 * Builds the quote-table footer rows: Subtotal → extra rows (e.g. BOCES Fee) →
 * order-level adjustments → TOTAL → savings callout. Pure (no DocumentApp), so
 * both table builders share it and it is unit-testable. Each returned row is an
 * array of `numCols` strings with the label in the second-to-last cell and the
 * value in the last cell (matches the existing TOTAL-row convention).
 *
 * @param {number} numCols  number of columns in the table
 * @param {{subtotal:number,
 *          adjustments:Array<{label:string,type:string,mode:string,value:number,amount:number}>,
 *          extraRows:Array<Array<string>>,
 *          orderTotal:number,
 *          savings:number}} opts
 *   extraRows: each is a [label, value] pair inserted between Subtotal and the
 *   adjustment rows (BOCES passes its Fee row here). adjustments: discounts show
 *   as −$X, fees/taxes as +$X.
 * @returns {Array<Array<string>>}
 */
function buildQuoteFooterRows(numCols, opts) {
  var rows = [];
  function row(label, value) {
    var r = [];
    for (var i = 0; i < numCols; i++) r.push('');
    r[numCols - 2] = label;
    r[numCols - 1] = value;
    return r;
  }

  rows.push(row('Subtotal:', formatCurrency(opts.subtotal)));

  (opts.extraRows || []).forEach(function(pair) {
    rows.push(row(pair[0], pair[1]));
  });

  (opts.adjustments || []).forEach(function(a) {
    var label = a.label + (a.mode === 'percent' ? ' (' + a.value + '%)' : '');
    var sign  = a.type === 'discount' ? '−' : '+'; // − for discounts, + for fees/taxes
    rows.push(row(label + ':', sign + formatCurrency(a.amount)));
  });

  rows.push(row('TOTAL:', formatCurrency(opts.orderTotal)));

  if (opts.savings && opts.savings > 0) {
    rows.push(row("You'll save:", formatCurrency(opts.savings)));
  }
  return rows;
}

/**
 * Formats the billable-units summary line, omitting any zero unit.
 * @param {number} days
 * @param {number} hours
 * @returns {string}  e.g. "Total billable: 940 days / 40 hours" (or '' when both 0)
 */
function formatBillableSummary(days, hours) {
  var parts = [];
  if (days  > 0) parts.push(days  + (days  === 1 ? ' day'  : ' days'));
  if (hours > 0) parts.push(hours + (hours === 1 ? ' hour' : ' hours'));
  return parts.length ? 'Total billable: ' + parts.join(' / ') : '';
}
