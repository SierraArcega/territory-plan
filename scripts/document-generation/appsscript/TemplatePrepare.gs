/**
 * Applies the standard Fullmind table style (deep plum header, alternating rows,
 * consistent font + padding) to every table in every template doc.
 * Safe to re-run — overwrites cell formatting, leaves content untouched.
 * Constants (TBL_HEADER_BG, TBL_ALT_ROW_BG, TBL_FONT, TBL_FONT_SIZE) come from
 * PricingDocBuilder.gs which shares global scope in the same Apps Script project.
 */
function styleAllTemplateDocs() {
  var props = PropertiesService.getScriptProperties().getProperties();
  var docs = [
    // Base template intentionally excluded: cover page ("Created by/Prepared for") table
    // and signature table must not receive plum data-table styling.
    // Quote + payment tables are built/styled programmatically at generation time.
    { label: 'SOW — Live Streaming',    id: props[PROP.SOW_LIVESTREAM_ID]    },
    { label: 'SOW — Instr. Services',   id: props[PROP.SOW_INSTRUCTION_ID]   },
    { label: 'Staffing Descriptions',   id: props[PROP.STAFFING_ID]          },
    { label: 'Pricing — EK12',          id: props[PROP.PRICING_EK12_ID]      },
    { label: 'Pricing — Hourly',        id: props[PROP.PRICING_HOURLY_ID]    },
    { label: 'Pricing — Live Staffing', id: props[PROP.PRICING_LIVESTAFF_ID] },
    { label: 'Pricing — BOCES',         id: props[PROP.PRICING_BOCES_ID]     },
    { label: 'MSA',                     id: props[PROP.MSA_ID]               },
  ];

  var total = 0;
  docs.forEach(function(entry) {
    if (!entry.id) {
      Logger.log('  SKIP (no ID): ' + entry.label);
      return;
    }
    try {
      var count = styleTablesInDoc(entry.id);
      Logger.log('  ✅ ' + entry.label + ': ' + count + ' table(s) styled');
      total += count;
    } catch (e) {
      Logger.log('  ❌ ' + entry.label + ': ' + e.message);
    }
  });

  Logger.log('Done — ' + total + ' table(s) styled across all template docs.');
}

/**
 * Opens a doc by ID, walks all top-level body tables, and applies the
 * standard Fullmind table style to each. Returns the number of tables styled.
 */
function styleTablesInDoc(docId) {
  var body  = DocumentApp.openById(docId).getBody();
  var n     = body.getNumChildren();
  var count = 0;
  for (var i = 0; i < n; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.TABLE) {
      applyFullmindTableStyle(child.asTable());
      count++;
    }
  }
  return count;
}

/**
 * Applies Fullmind table styling to a single Table element.
 * Row 0 = deep plum header (white bold text).
 * Subsequent rows alternate white / light plum.
 * Does NOT force-override bold on data rows — preserves existing emphasis.
 */
function applyFullmindTableStyle(table) {
  var numRows = table.getNumRows();
  for (var r = 0; r < numRows; r++) {
    var row   = table.getRow(r);
    var isHdr = r === 0;
    var bg    = isHdr ? TBL_HEADER_BG : (r % 2 === 0 ? TBL_ALT_ROW_BG : '#FFFFFF');
    for (var c = 0; c < row.getNumCells(); c++) {
      var cell = row.getCell(c);
      cell.setBackgroundColor(bg);
      cell.setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(14).setPaddingRight(14);
      var t = cell.editAsText();
      t.setFontFamily(TBL_FONT);
      t.setFontSize(TBL_FONT_SIZE);
      t.setForegroundColor(isHdr ? '#FFFFFF' : '#1A1A1A');
      if (isHdr) t.setBold(true);
      // Data rows: don't override bold — source docs may have intentional emphasis
    }
  }
}

// ─────────────────────────────────────────────────────────────────────────────

/**
 * Lists all files in a Drive folder with their IDs and MIME types.
 * Use to confirm file IDs before wiring up initScriptProperties().
 */
function listFolderContents() {
  var FOLDER_ID = '1usLdDefD50gyiuiONvhynbO8CuFf2pGc';
  var folder = DriveApp.getFolderById(FOLDER_ID);
  var files  = folder.getFiles();
  Logger.log('Files in "' + folder.getName() + '":');
  while (files.hasNext()) {
    var f = files.next();
    var isDoc = f.getMimeType() === 'application/vnd.google-apps.document' ? '(Google Doc ✅)' : '(⚠️  NOT a Google Doc — needs conversion)';
    Logger.log(f.getName() + '\n  ID:   ' + f.getId() + '\n  Type: ' + f.getMimeType() + '  ' + isDoc);
  }
  Logger.log('');
  Logger.log('Subfolders:');
  var subs = folder.getFolders();
  while (subs.hasNext()) {
    var s = subs.next();
    Logger.log(s.getName() + '\n  ID:   ' + s.getId());
  }
}

var TEMPLATE_PREP_DOC_ID = '1fWtRoml___H8w9Ke0I5H_qS5MdkZQoe7pYEVkQi2zhQ';

/**
 * Verify all 24 {{MARKER}} paragraphs are present in the base template.
 * Run from the editor any time you want to confirm template integrity.
 */
function verifyTemplateMarkers() {
  var doc  = DocumentApp.openById(TEMPLATE_PREP_DOC_ID);
  var body = doc.getBody();

  var expected = [
    '{{QUOTE_SECTION_START}}',   '{{QUOTE_SECTION_END}}',
    '{{PAY_A_START}}',           '{{PAY_A_END}}',
    '{{PAY_B_START}}',           '{{PAY_B_END}}',
    '{{PAY_C_START}}',           '{{PAY_C_END}}',
    '{{SOW_SECTION_START}}',     '{{SOW_SECTION_END}}',
    '{{STAFFING_SECTION_START}}','{{STAFFING_SECTION_END}}',
    '{{PRICING_SECTION_START}}', '{{PRICING_SECTION_END}}',
    '{{PRICING_EK12_START}}',    '{{PRICING_EK12_END}}',
    '{{PRICING_LIVESTAFF_START}}','{{PRICING_LIVESTAFF_END}}',
    '{{PRICING_HOURLY_START}}',  '{{PRICING_HOURLY_END}}',
    '{{PRICING_BOCES_START}}',   '{{PRICING_BOCES_END}}',
    '{{MSA_START}}',             '{{MSA_END}}',
  ];

  var found = 0;
  expected.forEach(function(marker) {
    var idx = findParagraphIndex(body, marker);
    if (idx >= 0) {
      Logger.log('✅  ' + marker + '  (body child ' + idx + ')');
      found++;
    } else {
      Logger.log('❌  MISSING: ' + marker);
    }
  });

  Logger.log('');
  Logger.log('Result: ' + found + ' / ' + expected.length + ' markers found');
  if (found === expected.length) {
    Logger.log('✅ All markers present — template is ready.');
  } else {
    Logger.log('❌ Fix the missing markers above, then re-run verifyTemplateMarkers().');
  }
}

