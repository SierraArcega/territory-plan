// ─────────────────────────────────────────────────────────────────────────────
// ESIGN — DROPBOX SIGN INTEGRATION
//
// Adds invisible anchor text tags to the client signature cell so Dropbox Sign
// knows exactly where to place signature and date fields — no coordinates, no
// manual dragging.
//
// API key is stored as a Script Property (never in code):
//   Apps Script editor → Project Settings (⚙) → Script Properties
//   → Add property: DROPBOX_SIGN_API_KEY = <your key>
// ─────────────────────────────────────────────────────────────────────────────

var DROPBOX_SIGN_API_URL = 'https://api.hellosign.com/v3/signature_request/send';

/**
 * Appends invisible Dropbox Sign text anchor tags inside the buyer (client)
 * signature table cell. Tags are 1pt white text — invisible in the Google Doc
 * and hidden by Dropbox Sign's hide_text_tags option in the signing view.
 *
 * Tag format: [type|requirement|signer]
 *   [sig|req|signer1]  — signature field for signer 1 (the client)
 *   [date|req|signer1] — date field for signer 1 (the client)
 *
 * The function searches all table cells for the buyer signature cell
 * (identified by "Authorized Representative, Buyer") and appends tags there.
 * This makes placement content-relative, not coordinate-relative.
 *
 * @param {GoogleAppsScript.Document.Body} body
 */
function addESignAnchorTags(body) {
  var tables   = body.getTables();
  var tagAdded = false;

  for (var t = 0; t < tables.length && !tagAdded; t++) {
    var table = tables[t];
    for (var r = 0; r < table.getNumRows() && !tagAdded; r++) {
      var row = table.getRow(r);
      for (var c = 0; c < row.getNumCells() && !tagAdded; c++) {
        var cell = row.getCell(c);

        if (cell.getText().indexOf('Authorized Representative, Buyer') !== -1) {
          // Append signature tag (invisible — 1pt white)
          var sigPara = cell.appendParagraph('[sig|req|signer1]');
          sigPara.editAsText()
            .setFontSize(1)
            .setForegroundColor('#FFFFFF');

          // Append date tag (invisible — 1pt white)
          var datePara = cell.appendParagraph('[date|req|signer1]');
          datePara.editAsText()
            .setFontSize(1)
            .setForegroundColor('#FFFFFF');

          tagAdded = true;
          Logger.log('eSign anchor tags added to buyer signature cell.');
        }
      }
    }
  }

  if (!tagAdded) {
    Logger.log('Warning: Could not find buyer signature cell for eSign tags. ' +
               'Check that "Authorized Representative, Buyer" text exists in the template.');
  }
}

/**
 * Sends the generated PDF to Dropbox Sign for client e-signature.
 *
 * The PDF must already contain the [sig|req|signer1] and [date|req|signer1]
 * anchor tags (added by addESignAnchorTags before PDF export).
 *
 * Requires Script Property DROPBOX_SIGN_API_KEY to be set.
 * test_mode is enabled — remove for production sends.
 *
 * @param {string} pdfFileId   Drive file ID of the exported PDF
 * @param {string} signerEmail Client's email address
 * @param {string} signerName  Client's full name
 * @param {string} docTitle    Document title (used as email subject)
 * @returns {{ signatureRequestId: string }} Dropbox Sign response data
 * @throws {Error} if API key is missing or API returns an error
 */
function sendForDropboxSign(pdfFileId, signerEmail, signerName, docTitle) {
  var apiKey = PropertiesService.getScriptProperties().getProperty('DROPBOX_SIGN_API_KEY');
  if (!apiKey) {
    throw new Error(
      'DROPBOX_SIGN_API_KEY not set. ' +
      'Go to: Apps Script editor → Project Settings (⚙) → Script Properties → ' +
      'Add property DROPBOX_SIGN_API_KEY with your Dropbox Sign API key.'
    );
  }

  var pdfBlob = DriveApp.getFileById(pdfFileId).getAs('application/pdf');
  pdfBlob.setName(docTitle + '.pdf');

  var payload = {
    'title':                        docTitle,
    'subject':                      'Action Required: Please sign your Fullmind Service Agreement',
    'message':                      'Please review and sign the attached Fullmind Service Order Agreement.',
    'signers[0][email_address]':    signerEmail,
    'signers[0][name]':             signerName,
    'files[0]':                     pdfBlob,
    'use_text_tags':                '1',  // detect [sig|req|signer1] tags in the PDF
    'hide_text_tags':               '1',  // hide the tag text in the signing view
    'test_mode':                    '1'   // REMOVE for production — test mode does not send real emails
  };

  var options = {
    'method':           'post',
    'headers': {
      // Dropbox Sign uses HTTP Basic auth: API key as username, empty password
      'Authorization': 'Basic ' + Utilities.base64Encode(apiKey + ':')
    },
    'payload':          payload,
    'muteHttpExceptions': true
  };

  var response     = UrlFetchApp.fetch(DROPBOX_SIGN_API_URL, options);
  var responseCode = response.getResponseCode();
  var responseBody = response.getContentText();

  Logger.log('Dropbox Sign HTTP status: ' + responseCode);

  if (responseCode !== 200) {
    throw new Error('Dropbox Sign API error (' + responseCode + '): ' + responseBody);
  }

  var result = JSON.parse(responseBody);
  var requestId = result.signature_request.signature_request_id;

  Logger.log('Signature request created: ' + requestId);
  Logger.log('Signer: ' + signerEmail);
  Logger.log('Check your Dropbox Sign dashboard: https://app.hellosign.com');

  return { signatureRequestId: requestId };
}

/**
 * Standalone test: runs the full eSign flow against the most recently generated
 * PDF in the Generated PDFs folder (does not regenerate the document).
 *
 * Set TEST_SIGNER_EMAIL and TEST_SIGNER_NAME in Script Properties before running,
 * or edit the defaults below temporarily for a quick test.
 */
function testESign() {
  assertConfigured();

  // Override these with your own details for testing
  var signerEmail = PropertiesService.getScriptProperties().getProperty('TEST_SIGNER_EMAIL')
                    || 'your-email@example.com';
  var signerName  = PropertiesService.getScriptProperties().getProperty('TEST_SIGNER_NAME')
                    || 'Test Signer';

  if (!signerEmail || signerEmail.indexOf('your-email') !== -1 || signerEmail.indexOf('example.com') !== -1) {
    throw new Error(
      'testESign: signer email is still a placeholder. ' +
      'Set TEST_SIGNER_EMAIL in Script Properties (Project Settings ⚙ → Script Properties) ' +
      'to your own email address before running this test.'
    );
  }

  // Find the most recent PDF in the Generated PDFs folder
  var pdfFolder = DriveApp.getFolderById(PDF_FOLDER_ID);
  var files     = pdfFolder.getFilesByMimeType('application/pdf');
  var pdfFile   = null;

  while (files.hasNext()) {
    var f = files.next();
    if (!pdfFile || f.getDateCreated() > pdfFile.getDateCreated()) {
      pdfFile = f;
    }
  }

  if (!pdfFile) {
    throw new Error('No PDF found in Generated PDFs folder. Run runEndToEndTest first.');
  }

  Logger.log('Sending most recent PDF: ' + pdfFile.getName());
  var result = sendForDropboxSign(pdfFile.getId(), signerEmail, signerName, pdfFile.getName());
  Logger.log('testESign complete. Request ID: ' + result.signatureRequestId);
}
