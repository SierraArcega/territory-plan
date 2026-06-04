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
 * Builds the quote table from scratch at the position of the placeholder table
 * (identified by containing '[QUOTE_ROW_1_SERVICE]'), then removes the placeholder.
 * Gives full column control — no hidden columns needed.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {Object} quote  payload.quote
 */
function buildQuoteTableFromScratch(body, quote) {
  var items     = quote.line_items;
  var showPrice = quote.show_pricing;

  // Determine if all items share the same unit (pure deal type)
  var allUnits = items.map(function(i) { return i.unit; });
  var uniqueUnits = allUnits.filter(function(v, i, a) { return a.indexOf(v) === i; });
  var pureUnit = uniqueUnits.length === 1 ? uniqueUnits[0] : null;

  // Build active column list
  var cols = [
    { key: 'service',      label: 'Service',     include: true },
    { key: 'description',  label: 'Description', include: true },
    { key: 'qty',          label: pureUnit === 'days' ? 'Days' : pureUnit === 'hrs' ? 'Hours' : pureUnit === 'sessions' ? 'Sessions' : 'Qty', include: true },
    { key: 'unit',         label: 'Unit',        include: pureUnit === null },
    { key: 'list_rate',    label: pureUnit === 'days' ? 'List $/day' : pureUnit === 'hrs' ? 'List $/hr' : 'List Rate', include: showPrice },
    { key: 'discount_pct', label: 'Disc%',       include: showPrice },
    { key: 'net_rate',     label: pureUnit === 'days' ? 'Net $/day' : pureUnit === 'hrs' ? 'Net $/hr' : 'Net Rate',   include: true },
    { key: 'total',        label: 'Total',       include: true },
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

  // Build row data
  var headerRow = cols.map(function(c) { return c.label; });
  var dataRows  = items.map(function(item) {
    return cols.map(function(col) {
      if (col.key === 'list_rate')    return formatCurrency(item.list_rate);
      if (col.key === 'discount_pct') return item.discount_pct > 0 ? item.discount_pct + '%' : '—';
      if (col.key === 'net_rate')     return formatCurrency(item.net_rate);
      if (col.key === 'total')        return formatCurrency(item.total);
      if (col.key === 'qty')          return String(item.qty);
      return String(item[col.key] != null ? item[col.key] : '');
    });
  });

  var totalRow = cols.map(function() { return ''; });
  totalRow[cols.length - 2] = 'TOTAL:';
  totalRow[cols.length - 1] = formatCurrency(quote.order_total);

  // Insert table after placeholder, remove placeholder
  var newTable = body.insertTable(tableIdx + 1, [headerRow].concat(dataRows).concat([totalRow]));

  // Set proportional column widths scaled to page width (540pt = 8.5" - 0.5" margins)
  var naturalWidths = { service: 110, description: 100, qty: 40, unit: 40,
                        list_rate: 60, discount_pct: 38, net_rate: 60, total: 92 };
  var rawWidths  = cols.map(function(c) { return naturalWidths[c.key] || 60; });
  var rawTotal   = rawWidths.reduce(function(s, w) { return s + w; }, 0);
  rawWidths.forEach(function(w, i) {
    newTable.setColumnWidth(i, Math.round(w / rawTotal * 540));
  });

  // Apply standard Fullmind table style (plum header, alternating rows)
  applyFullmindTableStyle(newTable);

  // Quote tables are multi-column — reduce padding and font size so content fits
  var numRows = newTable.getNumRows();
  for (var r = 0; r < numRows; r++) {
    var row = newTable.getRow(r);
    for (var c = 0; c < row.getNumCells(); c++) {
      var cell = row.getCell(c);
      cell.setPaddingLeft(5).setPaddingRight(5);
      cell.editAsText().setFontSize(9);
    }
  }

  // Bold the total row (applyFullmindTableStyle doesn't bold data rows)
  var lastRow = newTable.getRow(newTable.getNumRows() - 1);
  for (var c = 0; c < lastRow.getNumCells(); c++) {
    lastRow.getCell(c).editAsText().setBold(true);
  }

  placeholderTable.removeFromParent();
}
