// ─── End-to-end contract generation tests ─────────────────────────────────────
// Select one of these from the function dropdown and run.
// On success the log prints a Google Doc URL — open it to inspect the output.

function testContractFull() {
  var result = generateContract(PAYLOAD_FULL);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) Logger.log('✅ Open doc: ' + result.url);
}

function testContractNoQuote() {
  var result = generateContract(PAYLOAD_NO_QUOTE);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) Logger.log('✅ Open doc: ' + result.url);
}

function testContractBOCES() {
  var result = generateContract(PAYLOAD_BOCES_ONLY);
  Logger.log('Result: ' + JSON.stringify(result));
  if (result.success) Logger.log('✅ Open doc: ' + result.url);
}

/**
 * Exercises the full pipeline including the Dropbox Sign auto_send branch.
 * Clones PAYLOAD_FULL, flips auto_send to true, runs generateContract.
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
  var result = generateContract(payload);
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
