/**
 * Web app entry point. Receives JSON payload from Territory Planner.
 * @param {GoogleAppsScript.Events.DoPost} e
 */
function doPost(e) {
  try {
    var payload = JSON.parse(e.postData.contents);
    var result  = generateContract(payload);
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
 * Main contract generation orchestrator.
 * Call directly from the editor: generateContract(PAYLOAD_FULL)
 * @param {Object} payload
 * @returns {{ success: boolean, url: string, docId: string }}
 */
function generateContract(payload) {
  var props  = PropertiesService.getScriptProperties().getProperties();
  var folder = DriveApp.getFolderById(props[PROP.OUTPUT_FOLDER_ID]);

  var docName = payload.deal.client_company + ' — Contract ' + payload.deal.today;
  var copy    = DriveApp.getFileById(props[PROP.TEMPLATE_BASE_ID]).makeCopy(docName, folder);
  var doc     = DocumentApp.openById(copy.getId());
  var body    = doc.getBody();

  try {
    replaceMergeFields(body, payload);
    handleQuoteSection(body, payload.quote);
    handlePaymentTerms(body, payload.payment);
    handleAppendedSections(doc, payload.sections, props);

    doc.saveAndClose();

    return {
      success: true,
      url:     'https://docs.google.com/document/d/' + copy.getId() + '/edit',
      docId:   copy.getId(),
    };
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
