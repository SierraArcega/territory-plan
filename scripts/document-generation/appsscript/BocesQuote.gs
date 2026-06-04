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

/** Rounds to 2 decimal places, avoiding binary float drift. */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}
