/**
 * Handles the quote section. If quote.include is false, deletes the entire
 * section block. Otherwise removes the markers and builds the table from scratch.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote
 */
function handleQuoteSection(body, quote) {
  if (!quote.include) {
    deleteBetweenMarkers(body, '{{QUOTE_SECTION_START}}', '{{QUOTE_SECTION_END}}');
    return;
  }
  deleteMarkerParagraph(body, '{{QUOTE_SECTION_START}}');
  deleteMarkerParagraph(body, '{{QUOTE_SECTION_END}}');
  deleteMarkerParagraph(body, '[QUOTE_TABLE_INSERT]');
  buildQuoteTableFromScratch(body, quote);
}

/**
 * Builds the quote table from scratch at the placeholder table (identified by
 * '[QUOTE_ROW_1_SERVICE]'), then removes the placeholder. Columns:
 * Service | Needed | Per | Unit | Rate | Total. Rate (net rate) is shown only
 * when show_pricing. Description is folded into the Service cell. The footer
 * (Subtotal → adjustments → TOTAL → savings) comes from the shared
 * buildQuoteFooterRows helper.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote
 */
function buildQuoteTableFromScratch(body, quote) {
  var items     = quote.line_items;
  var showPrice = quote.show_pricing;

  // Approved layout: Service | Needed | Per | Unit | Rate | Total.
  // Rate = net_rate (post per-line discount); shown only when pricing is shown.
  // Description is folded into the Service cell (second line) to save width.
  var cols = [
    { key: 'service',  label: 'Service', include: true },
    { key: 'count',    label: 'Needed',  include: true },
    { key: 'qty',      label: 'Per',     include: true },
    { key: 'unit',     label: 'Unit',    include: true },
    { key: 'net_rate', label: 'Rate',    include: showPrice },
    { key: 'total',    label: 'Total',   include: true },
  ].filter(function(c) { return c.include; });

  // Find placeholder table (contains '[QUOTE_ROW_1_SERVICE]')
  var placeholderTable = null;
  var tableIdx = -1;
  for (var i = 0; i < body.getNumChildren(); i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.TABLE &&
        child.asTable().getText().indexOf('[QUOTE_ROW_1_SERVICE]') !== -1) {
      placeholderTable = child.asTable();
      tableIdx = i;
      break;
    }
  }
  if (!placeholderTable) {
    Logger.log('Warning: quote placeholder table not found — skipping table build');
    return;
  }

  var headerRow = cols.map(function(c) { return c.label; });
  var dataRows  = items.map(function(item) {
    return cols.map(function(col) {
      if (col.key === 'service') {
        return item.description ? item.service + '\n' + item.description : item.service;
      }
      if (col.key === 'count')    return String(item.count != null ? item.count : 1);
      if (col.key === 'qty')      return String(item.qty);
      if (col.key === 'unit')     return String(item.unit != null ? item.unit : '');
      if (col.key === 'net_rate') return formatCurrency(item.net_rate);
      if (col.key === 'total')    return formatCurrency(item.total);
      return '';
    });
  });

  // Shared footer: Subtotal (= sum of line totals) → adjustments → TOTAL → savings.
  var subtotal = 0;
  items.forEach(function(it) { subtotal += Number(it.total) || 0; });
  subtotal = round2(subtotal);
  var footerRows = buildQuoteFooterRows(cols.length, {
    subtotal:    subtotal,
    adjustments: quote.adjustments || [],
    extraRows:   [],
    orderTotal:  quote.order_total,
    savings:     quote.savings || 0,
  });

  var newTable = body.insertTable(tableIdx + 1, [headerRow].concat(dataRows).concat(footerRows));

  // Proportional column widths scaled to 540pt (8.5" − 0.5" margins each side).
  var naturalWidths = { service: 200, count: 55, qty: 50, unit: 55, net_rate: 80, total: 100 };
  var rawWidths = cols.map(function(c) { return naturalWidths[c.key] || 60; });
  var rawTotal  = rawWidths.reduce(function(s, w) { return s + w; }, 0);
  rawWidths.forEach(function(w, i) {
    newTable.setColumnWidth(i, Math.round(w / rawTotal * 540));
  });

  applyFullmindTableStyle(newTable);

  // Multi-column: reduce padding + font so content fits.
  var numRows = newTable.getNumRows();
  for (var r = 0; r < numRows; r++) {
    var trow = newTable.getRow(r);
    for (var c = 0; c < trow.getNumCells(); c++) {
      var cell = trow.getCell(c);
      cell.setPaddingLeft(5).setPaddingRight(5);
      cell.editAsText().setFontSize(9);
    }
  }

  // Bold every footer row (subtotal/adjustments/total/savings).
  for (var fr = numRows - footerRows.length; fr < numRows; fr++) {
    var frow = newTable.getRow(fr);
    for (var fc = 0; fc < frow.getNumCells(); fc++) {
      frow.getCell(fc).editAsText().setBold(true);
    }
  }

  placeholderTable.removeFromParent();
}
