// ─── End-to-end contract generation tests ─────────────────────────────────────
// Select one of these from the function dropdown and run.
// On success the log prints a Google Doc URL — open it to inspect the output.

function testContractFull() {
  var result = generateFullContract(PAYLOAD_FULL);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) Logger.log('✅ Open doc: ' + result.url);
}

function testContractNoQuote() {
  var result = generateFullContract(PAYLOAD_NO_QUOTE);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) Logger.log('✅ Open doc: ' + result.url);
}

function testContractBOCES() {
  var result = generateFullContract(PAYLOAD_BOCES_ONLY);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) Logger.log('✅ Open doc: ' + result.url);
}

function testBocesQuote() {
  var result = generateBocesQuote(PAYLOAD_BOCES_QUOTE);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) {
    Logger.log('✅ Open doc: ' + result.url);
    if (result.agreementUrl) Logger.log('📎 Agreement: ' + result.agreementUrl);
  }
}

function testDocTypeRouting() {
  var r = generateDocument(PAYLOAD_BOCES_QUOTE);            // doc_type: 'boces_quote'
  Logger.log('boces_quote → ' + (r.success ? 'OK ' + r.url : 'FAIL'));
}

/**
 * Exercises the full pipeline including the Dropbox Sign auto_send branch.
 * Clones PAYLOAD_FULL, flips auto_send to true, runs generateFullContract.
 * Same code path as doPost minus the JSON parse — validates eSign integration
 * without needing to authenticate against the web-app URL.
 * DROPBOX_SIGN_TEST_MODE='1' keeps the send sandboxed.
 * Overrides client_email to a @fullmindlearning.com address because Dropbox
 * Sign test mode only allows sends within the API key owner's domain.
 */
function testAutoSend() {
  var payload = JSON.parse(JSON.stringify(PAYLOAD_FULL));
  payload.auto_send = true;
  payload.deal.client_email = 'aston.arcega@fullmindlearning.com';
  var result = generateFullContract(payload);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) {
    Logger.log('✅ Open doc: ' + result.url);
    if (result.sent) {
      Logger.log('✅ Dropbox Sign accepted — signatureRequestId=' + result.signatureRequestId);
    } else {
      Logger.log('⚠️  Dropbox Sign send failed: ' + result.sendError);
    }
  }
}

// ─── Unit tests ────────────────────────────────────────────────────────────────

function runUtilTests() {
  testFormatCurrency();
  testEscapeRegex();
  Logger.log('✅ All util tests passed.');
}

function testFormatCurrency() {
  var cases = [
    { input: 1234.5,   expected: '$1,234.50'  },
    { input: 0,        expected: '$0.00'       },
    { input: 99999.99, expected: '$99,999.99'  },
    { input: null,     expected: ''            },
    { input: undefined, expected: ''           },
  ];
  cases.forEach(function(c) {
    var result = formatCurrency(c.input);
    if (result !== c.expected) {
      throw new Error('formatCurrency(' + c.input + '): expected "' + c.expected + '", got "' + result + '"');
    }
  });
  Logger.log('  ✅ testFormatCurrency passed');
}

function runBocesTests() {
  testComputeBocesQuoteTotals();
  Logger.log('✅ All BOCES unit tests passed.');
}

function testComputeBocesQuoteTotals() {
  // Numbers mirror the approved BOCES Quote screenshot:
  // Homebound 1:1 @ $53.06 × 250 = $13,265.00
  // Students with Disabilities @ $21.23 × 100 = $2,123.00
  // subtotal $15,388.00; fee 10.6% = $1,631.13; total $17,019.13
  var lineItems = [
    { product: 'Homebound 1:1', rate: 53.06, qty: 250 },
    { product: 'Students with Disabilities', rate: 21.23, qty: 100 },
  ];
  var r = computeBocesQuoteTotals(lineItems, 10.6);

  if (r.rows.length !== 2)         throw new Error('rows length: expected 2, got ' + r.rows.length);
  if (r.feePct !== 10.6)           throw new Error('feePct: expected 10.6, got ' + r.feePct);
  if (r.rows[0].total !== 13265)   throw new Error('row0 total: expected 13265, got ' + r.rows[0].total);
  if (r.rows[1].total !== 2123)    throw new Error('row1 total: expected 2123, got ' + r.rows[1].total);
  if (r.subtotal !== 15388)        throw new Error('subtotal: expected 15388, got ' + r.subtotal);
  if (r.fee !== 1631.13)           throw new Error('fee: expected 1631.13, got ' + r.fee);
  if (r.total !== 17019.13)        throw new Error('total: expected 17019.13, got ' + r.total);

  // Default fee_pct when omitted is 10.6
  var r2 = computeBocesQuoteTotals([{ product: 'X', rate: 100, qty: 1 }], undefined);
  if (r2.fee !== 10.6)             throw new Error('default fee: expected 10.6, got ' + r2.fee);

  // count multiplies the line total: 2 × 10 × 100 = 2000, fee 10% = 200, total 2200
  var c = computeBocesQuoteTotals([{ product: 'Tutoring', rate: 100, qty: 10, count: 2 }], 10);
  if (c.subtotal !== 2000) throw new Error('count subtotal: ' + c.subtotal);
  if (c.total    !== 2200) throw new Error('count total: ' + c.total);

  Logger.log('  ✅ testComputeBocesQuoteTotals passed');
}

// ─── Source doc structure debugging ───────────────────────────────────────────
// Run debugAllSources() to log the first N children of each appended source doc.
// Useful for diagnosing "extra blank page" issues — embedded PageBreak elements,
// stacked leading empty paragraphs, etc.

/**
 * Like debugLast() but anchored on the MSA opening text. Run after a test
 * to inspect what sits between the previous section's end and the MSA.
 */
function debugLastMsa() {
  var folderId = PropertiesService.getScriptProperties().getProperty(PROP.OUTPUT_FOLDER_ID);
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var newest = null, newestTime = 0;
  while (files.hasNext()) {
    var f = files.next();
    var t = f.getDateCreated().getTime();
    if (t > newestTime) { newestTime = t; newest = f; }
  }
  if (!newest) { Logger.log('No output files found'); return; }
  Logger.log('Inspecting newest output: ' + newest.getName() + ' (' + newest.getId() + ')');
  debugOutputAroundText(newest.getId(), 'Master Service Agreement');
}

/**
 * One-call diagnostic: finds the newest doc in the output folder and inspects
 * the area around the signature page anchor. Run this right after a test.
 */
function debugLast() {
  var folderId = PropertiesService.getScriptProperties().getProperty(PROP.OUTPUT_FOLDER_ID);
  var folder = DriveApp.getFolderById(folderId);
  var files = folder.getFiles();
  var newest = null, newestTime = 0;
  while (files.hasNext()) {
    var f = files.next();
    var t = f.getDateCreated().getTime();
    if (t > newestTime) { newestTime = t; newest = f; }
  }
  if (!newest) { Logger.log('No output files found'); return; }
  Logger.log('Inspecting newest output: ' + newest.getName() + ' (' + newest.getId() + ')');
  debugOutputAroundText(newest.getId(), 'The foregoing');
}

/**
 * Inspect a generated contract doc's body around a search anchor. Pass the
 * doc ID (from the testContract* result URL) plus a snippet of text near
 * the problem area. Logs the matched child plus the 5 before and 5 after.
 */
function debugOutputAroundText(docId, anchorText) {
  var body = DocumentApp.openById(docId).getBody();
  var n = body.getNumChildren();
  var anchorIdx = -1;
  for (var i = 0; i < n; i++) {
    var c = body.getChild(i);
    if (c.getType() === DocumentApp.ElementType.PARAGRAPH &&
        c.asParagraph().getText().indexOf(anchorText) !== -1) {
      anchorIdx = i;
      break;
    }
    if (c.getType() === DocumentApp.ElementType.TABLE &&
        c.asTable().getText().indexOf(anchorText) !== -1) {
      anchorIdx = i;
      break;
    }
  }
  if (anchorIdx === -1) {
    Logger.log('Anchor "' + anchorText + '" not found in ' + docId);
    return;
  }
  var from = Math.max(0, anchorIdx - 5);
  var to   = Math.min(n - 1, anchorIdx + 10);
  Logger.log('==== OUTPUT ' + docId.substring(0,12) + ' children [' + from + '..' + to + '] around "' + anchorText + '" (anchor at ' + anchorIdx + ') ====');
  for (var i = from; i <= to; i++) {
    Logger.log('  ' + (i === anchorIdx ? '> ' : '  ') + '[' + i + '] ' + describeChild(body.getChild(i)));
  }
}

/**
 * Logs the LAST N children of a doc — useful for seeing what came right
 * before an appended section landed.
 */
function debugOutputTail(docId, tailCount) {
  tailCount = tailCount || 20;
  var body = DocumentApp.openById(docId).getBody();
  var n = body.getNumChildren();
  var from = Math.max(0, n - tailCount);
  Logger.log('==== OUTPUT ' + docId.substring(0,12) + ' tail [' + from + '..' + (n - 1) + '] of ' + n + ' children ====');
  for (var i = from; i < n; i++) {
    Logger.log('  [' + i + '] ' + describeChild(body.getChild(i)));
  }
}

function describeChild(child) {
  var type = child.getType();
  if (type === DocumentApp.ElementType.PARAGRAPH) {
    var p = child.asParagraph();
    var text = p.getText();
    var nc = p.getNumChildren();
    var pbs = 0, types = {};
    for (var j = 0; j < nc; j++) {
      var ct = String(p.getChild(j).getType());
      types[ct] = (types[ct] || 0) + 1;
      if (p.getChild(j).getType() === DocumentApp.ElementType.PAGE_BREAK) pbs++;
    }
    return 'PARA len=' + text.length + ' pb=' + pbs + ' kids=' + JSON.stringify(types) + ' text="' + text.substring(0,80).replace(/\n/g, '\\n') + '"';
  }
  if (type === DocumentApp.ElementType.TABLE) {
    var t = child.asTable();
    return 'TABLE rows=' + t.getNumRows() + ' cols=' + t.getRow(0).getNumCells();
  }
  if (type === DocumentApp.ElementType.LIST_ITEM) {
    return 'LIST_ITEM text="' + child.asListItem().getText().substring(0,80) + '"';
  }
  return String(type);
}

function debugAllSources() {
  var p = PropertiesService.getScriptProperties().getProperties();
  debugSourceStructure(p[PROP.SIGNATURE_ID],       'SIGNATURE');
  debugSourceStructure(p[PROP.MSA_ID],             'MSA');
  debugSourceStructure(p[PROP.SOW_LIVESTREAM_ID],  'SOW_LIVESTREAM');
  debugSourceStructure(p[PROP.SOW_INSTRUCTION_ID], 'SOW_INSTRUCTION');
  debugSourceStructure(p[PROP.STAFFING_ID],        'STAFFING');
  debugSourceStructure(p[PROP.PRICING_EK12_ID],    'PRICING_EK12');
  debugSourceStructure(p[PROP.PRICING_LIVESTAFF_ID],'PRICING_LIVESTAFF');
  debugSourceStructure(p[PROP.PRICING_HOURLY_ID],  'PRICING_HOURLY');
  debugSourceStructure(p[PROP.PRICING_BOCES_ID],   'PRICING_BOCES');
}

function debugSourceStructure(docId, label) {
  if (!docId) {
    Logger.log('---- ' + label + ': (no ID set) ----');
    return;
  }
  var body = DocumentApp.openById(docId).getBody();
  var n = body.getNumChildren();
  Logger.log('---- ' + label + ' (' + docId.substring(0,12) + ') first 6 of ' + n + ' children ----');
  var limit = Math.min(n, 6);
  for (var i = 0; i < limit; i++) {
    var child = body.getChild(i);
    var type  = child.getType();
    var info  = String(type);

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var p = child.asParagraph();
      var text = p.getText();
      var preview = text.substring(0, 50).replace(/\n/g, '\\n');
      var nc = p.getNumChildren();
      var pbs = 0, types = {};
      for (var j = 0; j < nc; j++) {
        var ct = String(p.getChild(j).getType());
        types[ct] = (types[ct] || 0) + 1;
        if (p.getChild(j).getType() === DocumentApp.ElementType.PAGE_BREAK) pbs++;
      }
      info = 'PARA text="' + preview + '" len=' + text.length + ' pageBreaks=' + pbs + ' childTypes=' + JSON.stringify(types);
    } else if (type === DocumentApp.ElementType.TABLE) {
      var t = child.asTable();
      info = 'TABLE rows=' + t.getNumRows() + ' cols=' + t.getRow(0).getNumCells();
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      info = 'LIST_ITEM text="' + child.asListItem().getText().substring(0,40) + '"';
    }
    Logger.log('  [' + i + '] ' + info);
  }
}

function testEscapeRegex() {
  var cases = [
    // < > are not regex special chars — should pass through unchanged
    { input: '<<pay_terms>>',  expected: '<<pay_terms>>'       },
    // { } ARE special regex chars — should be escaped
    { input: '{{MARKER}}',     expected: '\\{\\{MARKER\\}\\}'  },
    { input: 'plain text',     expected: 'plain text'           },
    // $ and . are special regex chars — should be escaped
    { input: '$100.00',        expected: '\\$100\\.00'          },
  ];
  cases.forEach(function(c) {
    var result = escapeRegex(c.input);
    if (result !== c.expected) {
      throw new Error('escapeRegex("' + c.input + '"): expected "' + c.expected + '", got "' + result + '"');
    }
  });
  Logger.log('  ✅ testEscapeRegex passed');
}

function testBuildQuoteFooterRows() {
  var rows = buildQuoteFooterRows(6, {
    subtotal: 459845.94,
    adjustments: [
      { label: 'Early Signing Discount', type: 'discount', mode: 'percent', value: 10, amount: 45984.59 },
    ],
    extraRows: [],
    orderTotal: 413861.35,
    savings: 46430.39,
  });
  if (rows.length !== 4) throw new Error('expected 4 footer rows, got ' + rows.length);
  if (rows[0][4] !== 'Subtotal:')   throw new Error('row0 label: ' + rows[0][4]);
  if (rows[0][5] !== '$459,845.94') throw new Error('row0 value: ' + rows[0][5]);
  if (rows[1][4] !== 'Early Signing Discount (10%):') throw new Error('row1 label: ' + rows[1][4]);
  if (rows[1][5] !== '−$45,984.59') throw new Error('row1 value: ' + rows[1][5]);
  if (rows[2][4] !== 'TOTAL:')      throw new Error('row2 label: ' + rows[2][4]);
  if (rows[3][4] !== "You'll save:") throw new Error('row3 label: ' + rows[3][4]);

  var noSave = buildQuoteFooterRows(6, { subtotal: 100, adjustments: [], extraRows: [], orderTotal: 100, savings: 0 });
  if (noSave.length !== 2) throw new Error('expected 2 rows w/o savings, got ' + noSave.length);

  var withFee = buildQuoteFooterRows(5, { subtotal: 2000, adjustments: [], extraRows: [['Fee (10%):', '$200.00']], orderTotal: 2200, savings: 0 });
  if (withFee[1][3] !== 'Fee (10%):') throw new Error('fee row label: ' + withFee[1][3]);
  Logger.log('testBuildQuoteFooterRows ✓');
}

function testFormatBillableSummary() {
  if (formatBillableSummary(940, 40) !== 'Total billable: 940 days / 40 hours') throw new Error('both: ' + formatBillableSummary(940, 40));
  if (formatBillableSummary(0, 40)   !== 'Total billable: 40 hours') throw new Error('hours only: ' + formatBillableSummary(0, 40));
  if (formatBillableSummary(1, 0)    !== 'Total billable: 1 day') throw new Error('singular day: ' + formatBillableSummary(1, 0));
  if (formatBillableSummary(0, 0)    !== '') throw new Error('empty: "' + formatBillableSummary(0, 0) + '"');
  Logger.log('testFormatBillableSummary ✓');
}

function runFooterTests() {
  testBuildQuoteFooterRows();
  testFormatBillableSummary();
  Logger.log('✅ runFooterTests passed');
}
