// ─────────────────────────────────────────────────────────────────────────────
// CONFIG
// Fill in your Drive IDs after completing the Drive setup in Task 0.
// ─────────────────────────────────────────────────────────────────────────────

var TEMPLATE_ID      = 'YOUR_TEMPLATE_DOC_ID_HERE';     // [TEMPLATE] Purchase Order Agreement
var OUTPUT_FOLDER_ID = 'YOUR_GENERATED_ORDERS_FOLDER_ID_HERE'; // Generated Orders folder
var PDF_FOLDER_ID    = 'YOUR_GENERATED_PDFS_FOLDER_ID_HERE';   // Generated PDFs folder

/**
 * Sanity-check: confirms the three IDs resolve to real Drive items.
 * Run this first after filling in the IDs above.
 * Expected log:
 *   Template name: [TEMPLATE] Purchase Order Agreement
 *   Output folder: Generated Orders
 *   PDF folder:    Generated PDFs
 */
function testConfig() {
  var template  = DriveApp.getFileById(TEMPLATE_ID);
  var outFolder = DriveApp.getFolderById(OUTPUT_FOLDER_ID);
  var pdfFolder = DriveApp.getFolderById(PDF_FOLDER_ID);

  Logger.log('Template name: ' + template.getName());
  Logger.log('Output folder: ' + outFolder.getName());
  Logger.log('PDF folder:    ' + pdfFolder.getName());
}
