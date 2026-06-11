/**
 * Computes the BOCES quote table totals from line items and a percentage fee.
 * Pure function — no Document dependency, unit-testable in the editor.
 * @param {Array<{product:string, rate:number, qty:number, count?:number, unit?:string}>} lineItems
 * @param {number} [feePct=10.6]  Fee percentage applied to the line-item subtotal.
 * @returns {{rows:Array<{product:string,rate:number,qty:number,count:number,unit:string,total:number}>,
 *           subtotal:number, feePct:number, fee:number, total:number}}
 */
function computeBocesQuoteTotals(lineItems, feePct) {
  var pct = (feePct == null) ? 10.6 : feePct;

  var rows = lineItems.map(function(item) {
    var count = (item.count == null) ? 1 : item.count;
    return {
      product: item.product,
      rate:    item.rate,
      qty:     item.qty,
      count:   count,
      unit:    item.unit != null ? item.unit : '',
      total:   round2(count * item.qty * item.rate),
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
 * Replaces the BOCES Quote's <<FIELD>> tokens. Separate from the contract's
 * replaceMergeFields — adds <<quote_number>> and omits contract-only fields.
 * Fills the deal fields plus the BOCES payment-terms block (the single fixed
 * BOCES terms, populated per deal). payload.payment is optional; missing values
 * resolve to '' so the doc never ships literal <<tokens>>.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} payload  BOCES quote payload (deal + optional payment)
 */
function replaceBocesMergeFields(body, payload) {
  var d = payload.deal;
  var p = payload.payment || {};
  var fields = {
    '<<quote_number>>':   d.quote_number,
    '<<Client_Company>>': d.client_company,
    '<<start_date>>':     d.start_date,
    '<<end_date>>':       d.end_date,
    '<<today>>':          d.today,
    '<<BILLABLE_SUMMARY>>': formatBillableSummary(
      (payload.quote && payload.quote.billable_days)  || 0,
      (payload.quote && payload.quote.billable_hours) || 0),
    // BOCES payment-terms block (baked-in terms, filled per deal). Field
    // semantics mirror the contract's replaceMergeFields.
    '<<pay_terms>>':      p.pay_terms,
    '<<contract_end>>':   p.contract_end,
    '<<unused_funds>>':   p.unused_funds,
    '<<billing_name>>':   p.billing_name,
    '<<billing_add>>':    p.billing_add,
    '<<billing_email>>':  p.billing_email,
    '<<billing_phone>>':  p.billing_phone,
    '<<po_yn>>':          p.po_yn ? '☑' : '☐',
    '<<pay_prepost>>':    p.pay_prepost || '',
    '<<boces_name>>':     p.boces_name  || '',
    '<<po_number>>':      p.po_number   || '',
  };
  for (var field in fields) {
    body.replaceText(escapeRegex(field), fields[field] != null ? String(fields[field]) : '');
  }
}

/**
 * Builds the "Anticipated Educator Need" table at the [BOCES_QUOTE_TABLE_INSERT]
 * marker, then removes the marker. Columns: Product | Needed (count) | Per (qty) |
 * Unit | Rate | Total. Footer (Subtotal → Fee → order-level adjustments → TOTAL
 * → savings) comes from the shared buildQuoteFooterRows helper; TOTAL uses the
 * forwarded quote.order_total so order-level adjustments are reflected.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote ({ fee_pct, order_total, line_items, adjustments, savings })
 */
function buildBocesQuoteTable(body, quote) {
  var t = computeBocesQuoteTotals(quote.line_items, quote.fee_pct);

  var markerIdx = findParagraphIndex(body, '[BOCES_QUOTE_TABLE_INSERT]');
  if (markerIdx === -1) {
    Logger.log('Warning: [BOCES_QUOTE_TABLE_INSERT] marker not found — skipping table build');
    return;
  }

  // Columns mirror the contract table: Product | Needed | Each | Rate | Total.
  // Each merges qty+unit; Rate carries a per-unit suffix (e.g. "/Day", "/Hr").
  var headerRow = ['Product', 'Needed', 'Each', 'Rate', 'Total'];
  var dataRows  = t.rows.map(function(r) {
    return [r.product, String(r.count), formatEachCell(r.qty, r.unit), formatCurrency(r.rate) + rateUnitSuffix(r.unit), formatCurrency(r.total)];
  });

  // Footer: Subtotal → Fee (extraRow) → adjustments → TOTAL (forwarded order_total) → savings.
  var footerRows = buildQuoteFooterRows(headerRow.length, {
    subtotal:    t.subtotal,
    adjustments: quote.adjustments || [],
    extraRows:   [['Fee (' + round2(t.feePct) + '%):', formatCurrency(t.fee)]],
    orderTotal:  (quote.order_total != null) ? quote.order_total : t.total,
    savings:     quote.savings || 0,
  });

  var allRows = [headerRow].concat(dataRows).concat(footerRows);
  var newTable = body.insertTable(markerIdx + 1, allRows);

  var naturalWidths = [207, 62, 78, 105, 88]; // Jakarta Sans runs wide: Needed >=62, Rate >=105 ($4,000.00/Day)
  var rawTotal = naturalWidths.reduce(function(s, w) { return s + w; }, 0);
  naturalWidths.forEach(function(w, i) {
    newTable.setColumnWidth(i, Math.round(w / rawTotal * 540));
  });

  applyFullmindTableStyle(newTable);

  // Five columns at 540pt: the default 14pt side padding wraps the bold "Needed"
  // header — tighten this table to 8pt (precedent: the contract quote table
  // overrides to 5pt for the same reason).
  for (var pr = 0; pr < newTable.getNumRows(); pr++) {
    var prow = newTable.getRow(pr);
    for (var pc = 0; pc < prow.getNumCells(); pc++) {
      prow.getCell(pc).setPaddingLeft(8).setPaddingRight(8);
    }
  }

  // Bold every footer row.
  var n = newTable.getNumRows();
  for (var fr = n - footerRows.length; fr < n; fr++) {
    var frow = newTable.getRow(fr);
    for (var fc = 0; fc < frow.getNumCells(); fc++) {
      frow.getCell(fc).editAsText().setBold(true);
    }
  }

  body.getChild(markerIdx).removeFromParent();
}

/**
 * BOCES Quote orchestrator. Quote-only — no signature page, no Dropbox Sign.
 * Call directly from the editor: generateBocesQuote(PAYLOAD_BOCES_QUOTE)
 * @param {Object} payload
 * @returns {{ success:boolean, url:string, docId:string, agreementUrl?:string }}
 */
function generateBocesQuote(payload) {
  var props  = PropertiesService.getScriptProperties().getProperties();
  var folder = DriveApp.getFolderById(props[PROP.OUTPUT_FOLDER_ID]);

  var qn = String(payload.deal.quote_number || '').trim();
  var docName = payload.deal.client_company + ' — BOCES Quote' + (qn ? ' ' + qn : '') + ' — ' + isoToday();
  var copy    = DriveApp.getFileById(props[PROP.TEMPLATE_BOCES_QUOTE_ID]).makeCopy(docName, folder);
  var doc     = DocumentApp.openById(copy.getId());
  var body    = doc.getBody();

  try {
    replaceBocesMergeFields(body, payload);
    buildBocesQuoteTable(body, payload.quote);

    var sections = payload.sections || {};

    // Optional inserts — same shared helpers the full contract uses, so the
    // section markers and source-doc wiring live in exactly one place
    // (appendStaffingSection / appendBocesPricingSection in AppendedSections.gs).
    appendStaffingSection(doc, sections.staffing_include, props);
    appendBocesPricingSection(doc, sections.pricing_boces, props);

    validateMergeFields(body);
    doc.saveAndClose();

    var docUrl = 'https://docs.google.com/document/d/' + copy.getId() + '/edit';
    var result = { success: true, url: docUrl, docId: copy.getId() };

    // Optional: reference the standing BOCES Master License & Service Agreement PDF.
    // Delivered as a separate attachment URL — physical merge is deferred.
    if (sections.boces_agreement) {
      if (props[PROP.BOCES_AGREEMENT_PDF_ID]) {
        result.agreementUrl = 'https://drive.google.com/file/d/' + props[PROP.BOCES_AGREEMENT_PDF_ID] + '/view';
      } else {
        Logger.log('Warning: BOCES_AGREEMENT_PDF_ID not set — agreementUrl omitted');
      }
    }

    return result;

  } catch (err) {
    // No GmailApp failure notification here (unlike generateFullContract): the
    // BOCES quote is currently editor/manual-invoked and quote-only. doPost
    // serializes the rethrown error to the caller. Revisit adding an alert when
    // the Territory Planner integration drives this automatically.
    try { copy.setTrashed(true); } catch (e2) {}
    Logger.log('BOCES quote generation failed: ' + err.message + '\n' + (err.stack || ''));
    throw err;
  }
}
