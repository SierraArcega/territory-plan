/**
 * Web app entry point. Receives JSON payload from Territory Planner.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result  = generateDocument(payload);
    return ContentService
      .createTextOutput(JSON.stringify(result))
      .setMimeType(ContentService.MimeType.JSON);
  } catch (err) {
    return ContentService
      .createTextOutput(JSON.stringify({ success: false, error: err.message }))
      .setMimeType(ContentService.MimeType.JSON);
  }
}

/**
 * Routes a payload to the correct document orchestrator by doc_type.
 * Defaults to 'contract' when doc_type is absent (back-compat).
 * @param {Object} payload
 * @returns {Object} orchestrator result
 */
function generateDocument(payload) {
  var docType = payload.doc_type || 'contract';
  if (docType === 'boces_quote') {
    return generateBocesQuote(payload);
  }
  // Unknown doc_type falls through to the full contract — intentional back-compat.
  // When adding a third document type, add its branch above.
  return generateFullContract(payload);
}

/**
 * Main contract generation orchestrator.
 * Call directly from the editor: generateFullContract(PAYLOAD_FULL)
 * @param {Object} payload
 * @returns {{ success: boolean, url: string, docId: string, sent?: boolean, sendError?: string }}
 */
function generateFullContract(payload) {
  var props  = PropertiesService.getScriptProperties().getProperties();
  var folder = DriveApp.getFolderById(props[PROP.OUTPUT_FOLDER_ID]);

  var sy = shortSchoolYear(payload.deal.school_year);
  var docName = (sy ? sy + ' — ' : '') + payload.deal.client_company + ' — Contract — ' + isoToday();
  var copy    = DriveApp.getFileById(props[PROP.TEMPLATE_BASE_ID]).makeCopy(docName, folder);
  var doc     = DocumentApp.openById(copy.getId());
  var body    = doc.getBody();

  try {
    replaceMergeFields(body, payload);
    handleQuoteSection(body, payload.quote);
    handlePaymentTerms(body, payload.payment);
    handleAppendedSections(doc, payload.sections, props);

    // tags defaults to true (eSign-ready). tags:false strips the signature-page
    // text tags for a clean, printable manual copy.
    if (payload.tags === false) {
      stripSignatureTextTags(body);
    }

    // Second pass: catch any <<FIELD>> tokens in appended content (signature page, MSA, etc.)
    replaceMergeFields(body, payload);
    validateMergeFields(body);

    doc.saveAndClose();

    var docUrl = 'https://docs.google.com/document/d/' + copy.getId() + '/edit';
    var result = { success: true, url: docUrl, docId: copy.getId() };

    // Optional: send via Dropbox Sign immediately after generation
    if (payload.auto_send && props[PROP.DROPBOX_SIGN_API_KEY]) {
      try {
        var pdfBlob    = DriveApp.getFileById(copy.getId())
                           .getAs('application/pdf')
                           .setName(docName + '.pdf');
        var signerName = payload.deal.signer_salut + ' ' + payload.deal.signer_first + ' ' + payload.deal.signer_last;
        var dsPayload = {
          // Server-injected by the app's send route (SP7 Admin toggle). Strict
          // string match; anything else falls back to the script property so
          // editor-run tests stay sandboxed.
          'test_mode':                 (payload.test_mode === '0' || payload.test_mode === '1')
                                         ? payload.test_mode
                                         : (props[PROP.DROPBOX_SIGN_TEST_MODE] || '1'),
          'title':                     docName,
          'subject':                   'Please sign your Fullmind contract',
          'message':                   'Please review and sign your Fullmind agreement for the ' + payload.deal.school_year + ' school year.',
          'signers[0][email_address]': payload.deal.signer_email || payload.deal.client_email,
          'signers[0][name]':          signerName,
          'use_text_tags':             '1',
          'hide_text_tags':            '1',
          'files[0]':                  pdfBlob,
        };
        // CC the sender + any rep-entered emails so they receive the executed copy.
        // Dropbox Sign rejects a CC that duplicates a signer, so the signer is
        // excluded; duplicate CC addresses are collapsed case-insensitively.
        var signerEmail = String(payload.deal.signer_email || payload.deal.client_email || '').trim().toLowerCase();
        var ccCandidates = [String(payload.deal.sender_email || '')]
          .concat(String(payload.deal.cc_emails || '').split(','));
        var ccSeen = {};
        var ccIndex = 0;
        for (var ci = 0; ci < ccCandidates.length; ci++) {
          var cc = ccCandidates[ci].trim();
          var ccKey = cc.toLowerCase();
          if (!cc || ccSeen[ccKey] || ccKey === signerEmail) continue;
          ccSeen[ccKey] = true;
          dsPayload['cc_email_addresses[' + ccIndex + ']'] = cc;
          ccIndex++;
        }
        var dsResponse = UrlFetchApp.fetch('https://api.hellosign.com/v3/signature_request/send', {
          method:  'post',
          headers: { 'Authorization': 'Basic ' + Utilities.base64Encode(props[PROP.DROPBOX_SIGN_API_KEY] + ':') },
          payload: dsPayload,
          muteHttpExceptions: true,
        });
        var dsResult = JSON.parse(dsResponse.getContentText());
        if (dsResponse.getResponseCode() === 200) {
          result.sent               = true;
          result.signatureRequestId = dsResult.signature_request.signature_request_id;
        } else {
          result.sent      = false;
          result.sendError = dsResult.error ? dsResult.error.error_msg : dsResponse.getContentText();
          Logger.log('Dropbox Sign error: ' + dsResponse.getContentText());
        }
      } catch (sendErr) {
        Logger.log('auto_send trigger failed: ' + sendErr.message);
        result.sent      = false;
        result.sendError = sendErr.message;
      }
    }

    return result;

  } catch (err) {
    try { copy.setTrashed(true); } catch (e2) {}
    try {
      GmailApp.sendEmail(
        payload.deal.sender_email,
        '⚠️ Contract generation FAILED — ' + payload.deal.client_company,
        [
          'Contract generation failed for: ' + payload.deal.client_company,
          'Error: ' + err.message,
          '',
          'Stack trace:',
          err.stack || '(no stack available)',
        ].join('\n')
      );
    } catch (emailErr) {
      Logger.log('Could not send failure email: ' + emailErr.message);
    }
    throw err;
  }
}
