/**
 * Rebuilds the Hourly and Live Staffing pricing docs from source CSV data.
 * Safe to re-run — clears and rebuilds each doc from scratch.
 * All formatting uses inline styles (not Named Styles) so appearance is preserved
 * when content is appended to the contract via appendDocContent().
 *
 * Run buildAllPricingDocs()        to rebuild both in one pass.
 * Run buildHourlyPricingDoc()      to rebuild Hourly / Instructional Services only.
 * Run buildLiveStaffingPricingDoc() to rebuild Live Staffing (Hybrid) only.
 */

var HOURLY_DOC_ID    = '1CXbUzPkrF8XpflxrcXjoUUTq8w9LePnhOZ2edtcciy4';
var LIVESTAFF_DOC_ID = '1E0MEsTqgPrtGMKv4VwKmGrFRwrUIcCncROR3wc5L6vI';

// Table colours — aligned with Fullmind brand neutrals
var TBL_HEADER_BG  = '#2C1A4A';  // deep plum
var TBL_ALT_ROW_BG = '#F7F5FA';  // light plum (design system token)
var TBL_FONT       = 'Plus Jakarta Sans'; // Google Docs font name for "Jakarta Sans Plus" — matches the template body font
var TBL_FONT_SIZE  = 10;

// Page body width ≈ 468pt (letter, 1" margins). Column widths sum to this.
// Each array maps to the table's columns left-to-right.
var COL = {
  HOURLY_PROGRAM:    [222, 82, 82, 82],   // Service | WC | SG | 1:1
  HOURLY_ADDON:      [222, 126, 120],      // Add-On | SKU | Fee
  STAFF_TIERS:       [150, 318],           // Tier | Description
  STAFF_PRICING:     [252, 72, 72, 72],    // Role | Per Diem | FY190 | FY180
  STAFF_FEES:        [222, 126, 120],      // Fee | SKU | Amount
};

// ─── Entry points ──────────────────────────────────────────────────────────────

function buildAllPricingDocs() {
  buildHourlyPricingDoc();
  buildLiveStaffingPricingDoc();
  Logger.log('✅ Both pricing docs rebuilt.');
}

// ─── Hourly / Instructional Services ──────────────────────────────────────────

function buildHourlyPricingDoc() {
  var doc  = DocumentApp.openById(HOURLY_DOC_ID);
  var body = doc.getBody();
  clearDocBody(body);

  styledH1(body, 'Hourly Direct Instruction Pricing');
  styledH2(body, 'July 1, 2026 – June 30, 2027');

  styledH2(body, 'Program Pricing (per session)');
  styledP(body, 'Prices are per session. Delivery model is selected at time of requisition. "—" = not available for that service.');

  styledTable(body, COL.HOURLY_PROGRAM,
    ['Service', 'Whole Class', 'Small Group', '1:1'],
    [
      ['Homework Help',                         '$225.10', '$140.69', '$73.16' ],
      ['State Test Prep',                       '$230.73', '$168.83', '$106.92'],
      ['Resource Room',                         '$225.10', '$140.69', '$73.16' ],
      ['Tutoring (Acceleration / Remediation)', '$225.10', '$140.69', '$73.16' ],
      ['Credit Recovery',                       '$281.38', '$157.57', '$73.16' ],
      ['Whole Class Instruction',               '$281.38', '$168.83', '—'      ],
      ['School Psychologist',                   '$342.67', '$207.94', '$100.79'],
      ['Virtual Medical Classroom',             '$281.38', '—',       '—'      ],
      ['Suspension Alternatives',               '$281.38', '—',       '—'      ],
      ['Virtual Substitute Room',               '$265.23', '—',       '—'      ],
      ['Homebound',                             '—',       '—',       '$73.16' ],
      ['Substitute Assignment',                 '$40.31',  '—',       '—'      ],
    ]
  );

  styledH2(body, 'Add-On Fees');
  styledP(body, 'Add-on fees are applied per session on top of the applicable program price.');

  styledTable(body, COL.HOURLY_ADDON,
    ['Add-On', 'SKU', 'Fee per Session'],
    [
      ['Students with Disabilities (SWD)',        'SWD-FY27',      '$22.29'],
      ['Multilingual Learners',                   'MULTI-FY27',    '$55.73'],
      ['Educator Prep Time',                      'EDPREP-FY27',   '$83.59'],
      ['Co-Teaching',                             'COT-FY27',      '$78.02'],
      ['Advanced Placement / College Level / IB', 'AP-CL-IB-FY27', '$22.29'],
      ['Assessments (Pre and Post Testing)',       'ASSESS-FY27',   '$44.58'],
      ['Content',                                 'CON-FY27',      '$11.15'],
    ]
  );

  Logger.log('✅ Hourly pricing doc rebuilt.');
}

// ─── Live Staffing (Hybrid Staffing) ──────────────────────────────────────────

function buildLiveStaffingPricingDoc() {
  var doc  = DocumentApp.openById(LIVESTAFF_DOC_ID);
  var body = doc.getBody();
  clearDocBody(body);

  styledH1(body, 'LIVE Staffing Price Sheet');
  styledH2(body, 'July 1, 2026 – June 30, 2027');

  styledH2(body, 'Educator Tiers');
  styledTable(body, COL.STAFF_TIERS,
    ['Tier', 'Description'],
    [
      ['Standard Educator',    'General education instructor for core subjects (math, science, social studies, ELA, elementary).'],
      ['Premium Educator',     'Dual certification required, Master\'s in subject area. Teaches subjects beyond the 4 core (specific sciences, electives, CTE, etc.).'],
      ['Specialized Educator', 'Educator for students with disabilities (SWD), multilingual learners (MLL/Bilingual), and Advanced Placement (AP).'],
    ]
  );

  styledH2(body, 'Educator Pricing');
  styledP(body, 'Full Year pricing is based on contracted school calendar. Part Time = fewer than 4 billable hours/day including prep; Full Time = 4 or more billable hours/day.');

  styledTable(body, COL.STAFF_PRICING,
    ['Role', 'Per Diem', 'Full Year (190 Days)', 'Full Year (180 Days)'],
    [
      ['Standard Educator – Standard Subject – Part Time',    '$300.14', '$57,025.77',  '$54,024.43' ],
      ['Standard Educator – Standard Subject – Full Time',    '$500.23', '$95,042.96',  '$90,040.70' ],
      ['Premium Educator – Standard Subject – Part Time',     '$309.14', '$58,736.55',  '$55,645.15' ],
      ['Premium Educator – Standard Subject – Full Time',     '$515.23', '$97,894.26',  '$92,741.92' ],
      ['Premium Educator – Premium Subject – Part Time',      '$300.14', '$57,025.77',  '$54,024.43' ],
      ['Premium Educator – Premium Subject – Full Time',      '$500.23', '$95,042.96',  '$90,040.70' ],
      ['Specialized Educator – Standard Subject – Part Time', '$327.82', '$62,285.44',  '$59,007.26' ],
      ['Specialized Educator – Standard Subject – Full Time', '$546.36', '$103,809.07', '$98,345.43' ],
      ['Specialized Educator – Premium Subject – Part Time',  '$336.56', '$63,946.39',  '$60,580.79' ],
      ['Specialized Educator – Premium Subject – Full Time',  '$560.93', '$106,577.30', '$100,967.97'],
      ['School Psychologist – Part Time',                     '$346.67', '$65,866.67',  '$62,400.00' ],
      ['School Psychologist – Full Time',                     '$577.78', '$109,777.78', '$104,000.00'],
    ]
  );

  styledH2(body, 'Program Fees');
  styledTable(body, COL.STAFF_FEES,
    ['Fee', 'SKU', 'Amount'],
    [
      ['Staffing Fee (one-time per placement)', 'HS-STAFFING-27', '$5,627.54'],
      ['Return Educator Fee',                   'HS-RETURN-27',   '$2,813.77'],
    ]
  );

  Logger.log('✅ Live Staffing pricing doc rebuilt.');
}

// ─── Styled helpers ────────────────────────────────────────────────────────────
// All use inline formatting so appearance is preserved when copied across docs.

function styledH1(body, text) {
  var p = body.appendParagraph(text);
  p.setSpacingBefore(0).setSpacingAfter(2);
  p.editAsText().setFontFamily(TBL_FONT).setFontSize(18).setBold(true).setForegroundColor('#1A1A1A');
  return p;
}

function styledH2(body, text) {
  var p = body.appendParagraph(text);
  p.setSpacingBefore(14).setSpacingAfter(4);
  p.editAsText().setFontFamily(TBL_FONT).setFontSize(12).setBold(true).setForegroundColor('#2C1A4A');
  return p;
}

function styledP(body, text) {
  var p = body.appendParagraph(text);
  p.setSpacingBefore(0).setSpacingAfter(6);
  p.editAsText().setFontFamily(TBL_FONT).setFontSize(10).setBold(false).setForegroundColor('#444444');
  return p;
}

/**
 * Appends a styled table with a dark plum header row, alternating light rows,
 * consistent font, padding, and explicit column widths.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {number[]} colWidths  Column widths in points (must sum to ~468 for letter page)
 * @param {string[]} headers
 * @param {string[][]} rows
 */
function styledTable(body, colWidths, headers, rows) {
  var tableData = [headers].concat(rows);
  var table = body.appendTable(tableData);

  // Set column widths
  for (var c = 0; c < colWidths.length; c++) {
    try { table.setColumnWidth(c, colWidths[c]); } catch (e) {}
  }

  // Style each cell
  var numRows = table.getNumRows();
  for (var r = 0; r < numRows; r++) {
    var row   = table.getRow(r);
    var isHdr = r === 0;
    var bg    = isHdr ? TBL_HEADER_BG : (r % 2 === 0 ? TBL_ALT_ROW_BG : '#FFFFFF');

    for (var c = 0; c < row.getNumCells(); c++) {
      var cell = row.getCell(c);
      cell.setBackgroundColor(bg);
      cell.setPaddingTop(7).setPaddingBottom(7).setPaddingLeft(14).setPaddingRight(14);
      cell.setVerticalAlignment(DocumentApp.VerticalAlignment.CENTER);

      var t = cell.editAsText();
      t.setFontFamily(TBL_FONT);
      t.setFontSize(TBL_FONT_SIZE);
      t.setBold(isHdr);
      t.setForegroundColor(isHdr ? '#FFFFFF' : '#1A1A1A');
    }
  }

  return table;
}

// ─── Utility ───────────────────────────────────────────────────────────────────

function clearDocBody(body) {
  var n = body.getNumChildren();
  for (var i = n - 1; i >= 0; i--) {
    var child = body.getChild(i);
    try {
      child.removeFromParent();
    } catch (e) {
      try {
        child.asParagraph().editAsText().setText('');
        child.asParagraph().setHeading(DocumentApp.ParagraphHeading.NORMAL);
      } catch (e2) {}
    }
  }
}
