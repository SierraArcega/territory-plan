/**
 * Formats a number as USD currency string. Returns '' for null/undefined.
 * Uses manual formatting instead of toLocaleString() — V8 Apps Script runtime
 * does not reliably respect locale parameters.
 * @param {number|null} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  if (amount == null) return '';
  var parts = Number(amount).toFixed(2).split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return '$' + parts.join('.');
}

/**
 * Escapes regex special characters so a string can be safely passed
 * to body.replaceText() as the search pattern.
 * @param {string} str
 * @returns {string}
 */
function escapeRegex(str) {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Returns the body child index of the first paragraph containing searchText.
 * Only searches direct body children — markers inside tables are not found
 * (intentional: all {{MARKERS}} must be standalone paragraphs, not in cells).
 * Returns -1 if not found.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} searchText
 * @returns {number}
 */
function findParagraphIndex(body, searchText) {
  var n = body.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = body.getChild(i);
    if (child.getType() === DocumentApp.ElementType.PARAGRAPH) {
      if (child.asText().getText().indexOf(searchText) !== -1) {
        return i;
      }
    }
  }
  return -1;
}

/**
 * Removes the paragraph containing markerText. Safe to call if not found.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} markerText
 */
function deleteMarkerParagraph(body, markerText) {
  var idx = findParagraphIndex(body, markerText);
  if (idx >= 0) {
    body.getChild(idx).removeFromParent();
  }
}

/**
 * Deletes all body children from startMarker paragraph through endMarker
 * paragraph (inclusive). Deletes from end backwards to preserve indices.
 * Logs a warning if either marker is not found.
 * @param {GoogleAppsScript.Document.Body} body
 * @param {string} startMarker
 * @param {string} endMarker
 */
function deleteBetweenMarkers(body, startMarker, endMarker) {
  var startIdx = findParagraphIndex(body, startMarker);
  var endIdx   = findParagraphIndex(body, endMarker);

  if (startIdx === -1 || endIdx === -1) {
    Logger.log('Warning: markers not found — start:' + startMarker + ' (' + startIdx + '), end:' + endMarker + ' (' + endIdx + ')');
    return;
  }
  if (startIdx > endIdx) {
    Logger.log('Warning: start marker (' + startIdx + ') appears after end marker (' + endIdx + ')');
    return;
  }
  for (var i = endIdx; i >= startIdx; i--) {
    body.getChild(i).removeFromParent();
  }
}

/**
 * Appends the full content of sourceDocId into targetDoc,
 * replacing the paragraph that contains placeholderText.
 * Adds a page break before the appended content.
 * Skips PageBreak elements from source — we insert our own.
 * @param {GoogleAppsScript.Document.Document} targetDoc
 * @param {string} sourceDocId
 * @param {string} placeholderText
 */
function appendDocContent(targetDoc, sourceDocId, placeholderText) {
  var targetBody = targetDoc.getBody();
  var sourceDoc  = DocumentApp.openById(sourceDocId);
  var sourceBody = sourceDoc.getBody();

  var placeholderIdx = findParagraphIndex(targetBody, placeholderText);
  if (placeholderIdx >= 0) {
    targetBody.getChild(placeholderIdx).removeFromParent();
  }

  targetBody.appendPageBreak();

  var n = sourceBody.getNumChildren();
  for (var i = 0; i < n; i++) {
    var child = sourceBody.getChild(i);
    var type  = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      var para    = child.asParagraph();
      var newPara = targetBody.appendParagraph(para.copy());
      newPara.setHeading(para.getHeading());
    } else if (type === DocumentApp.ElementType.TABLE) {
      targetBody.appendTable(child.asTable().copy());
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      var item    = child.asListItem();
      var newItem = targetBody.appendListItem(item.copy());
      newItem.setGlyphType(item.getGlyphType());
      newItem.setNestingLevel(item.getNestingLevel());
    }
    // PageBreak elements skipped — we insert our own page break before the block
  }
}
