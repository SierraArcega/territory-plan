/**
 * Merged qty+unit cell for quote tables: "188 Days", "1 Hour", "One-time" (Flat).
 * Unit vocabulary: Hour | Day | Session | Year | Flat. Defensively handles ''/unknown.
 * @param {number} qty
 * @param {string} unit
 * @returns {string}
 */
function formatEachCell(qty, unit) {
  var u = String(unit || '').trim();
  if (u === 'Flat') return 'One-time';
  if (!u) return String(qty);
  return String(qty) + ' ' + (Number(qty) === 1 ? u : u + 's');
}

/**
 * Per-unit suffix for the Rate column: "/Day", "/Hr", "" for Flat/unknown.
 * @param {string} unit
 * @returns {string}
 */
function rateUnitSuffix(unit) {
  var map = { Day: '/Day', Hour: '/Hr', Session: '/Session', Year: '/Yr' };
  return map[String(unit || '').trim()] || '';
}

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
 * Toggles one optional appended section. When opts.include is true, removes the
 * section's start/end marker paragraphs and appends the source doc's content at
 * opts.placeholder; otherwise deletes everything between the two markers.
 * Both orchestrators (contract + BOCES quote) reuse this — marker names differ
 * per template, so they are passed in.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {{include:boolean, sourceId:(string|undefined), startMarker:string,
 *          endMarker:string, placeholder:string}} opts
 *   sourceId may be falsy (e.g. a section whose Drive ID was never configured);
 *   the include branch logs a warning and skips the append in that case.
 */
function appendOptionalSection(doc, opts) {
  var body = doc.getBody();
  if (opts.include) {
    deleteMarkerParagraph(body, opts.startMarker);
    deleteMarkerParagraph(body, opts.endMarker);
    if (opts.sourceId) {
      appendDocContent(doc, opts.sourceId, opts.placeholder);
    } else {
      Logger.log('Warning: source ID not set for section ' + opts.startMarker);
    }
  } else {
    deleteBetweenMarkers(body, opts.startMarker, opts.endMarker);
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
function appendDocContent(targetDoc, sourceDocId, placeholderText, skipWidthNorm) {
  var targetBody = targetDoc.getBody();
  var sourceDoc  = DocumentApp.openById(sourceDocId);
  var sourceBody = sourceDoc.getBody();

  if (placeholderText) {
    var placeholderIdx = findParagraphIndex(targetBody, placeholderText);
    if (placeholderIdx >= 0) {
      targetBody.getChild(placeholderIdx).removeFromParent();
    }
  }

  // Trim trailing empty paragraphs from target body before appending the section
  // page break. Apps Script protects "last paragraph of a section" — on failure,
  // skip it and keep iterating earlier.
  var bodyLast = targetBody.getNumChildren() - 1;
  while (bodyLast > 0) {
    var lc = targetBody.getChild(bodyLast);
    if (lc.getType() === DocumentApp.ElementType.PARAGRAPH &&
        lc.asParagraph().getNumChildren() === 0 &&
        lc.asParagraph().getText() === '') {
      try {
        lc.removeFromParent();
      } catch (sectionErr) {
        // Section-protected; can't remove. Keep going earlier.
      }
      bodyLast--;
    } else {
      break;
    }
  }

  // Inject the page break into the existing trailing empty paragraph if one
  // exists — appendTable() auto-leaves an empty paragraph after each table,
  // and that empty is often section-protected so our trim above can't remove
  // it. Stacking appendPageBreak() on top adds ~14pt that can cascade into a
  // blank page on tightly-filled previous pages. Reusing the empty avoids
  // adding the extra paragraph height.
  var injectIdx = targetBody.getNumChildren() - 1;
  var injected = false;
  if (injectIdx >= 0) {
    var lastEl = targetBody.getChild(injectIdx);
    if (lastEl.getType() === DocumentApp.ElementType.PARAGRAPH &&
        lastEl.asParagraph().getNumChildren() === 0) {
      lastEl.asParagraph().appendPageBreak();
      injected = true;
    }
  }
  if (!injected) {
    targetBody.appendPageBreak();
  }

  var n = sourceBody.getNumChildren();

  // Find last non-empty child to avoid appending trailing blank paragraphs
  // that cause spurious blank pages in the output doc.
  var lastIdx = n - 1;
  while (lastIdx > 0) {
    var last = sourceBody.getChild(lastIdx);
    if (last.getType() === DocumentApp.ElementType.PARAGRAPH &&
        last.asParagraph().getText().trim() === '') {
      lastIdx--;
    } else {
      break;
    }
  }

  for (var i = 0; i <= lastIdx; i++) {
    var child = sourceBody.getChild(i);
    var type  = child.getType();

    if (type === DocumentApp.ElementType.PARAGRAPH) {
      targetBody.appendParagraph(child.asParagraph().copy());
      // para.copy() already preserves heading level + all inline formatting.
      // Calling setHeading() after would re-apply the target doc's Named Styles,
      // overriding the source doc's visual appearance — so we don't call it.
    } else if (type === DocumentApp.ElementType.TABLE) {
      var srcTable = child.asTable();
      var numCols  = srcTable.getRow(0).getNumCells();
      // Read source column widths BEFORE copy — getColumnWidth() is unreliable
      // on a table after appendTable(), but reliable on the source table.
      var srcWidths = [], srcTotal = 0;
      for (var c = 0; c < numCols; c++) {
        var w   = srcTable.getColumnWidth(c);
        var use = (w > 0) ? w : 60;
        srcWidths.push(use);
        srcTotal += use;
      }
      var appended = targetBody.appendTable(srcTable.copy());
      if (!skipWidthNorm) {
        // Scale all column widths proportionally to fill page width.
        // 540pt = 8.5" page − 0.5" margins each side (base template setting).
        // Tables hold absolute point widths, so without this they sit at their
        // source-doc width regardless of the target doc's page size.
        for (var c = 0; c < numCols; c++) {
          appended.setColumnWidth(c, Math.round(srcWidths[c] / srcTotal * 540));
        }
      }
    } else if (type === DocumentApp.ElementType.LIST_ITEM) {
      var item    = child.asListItem();
      var newItem = targetBody.appendListItem(item.copy());
      newItem.setGlyphType(item.getGlyphType());
      newItem.setNestingLevel(item.getNestingLevel());
    }
    // PageBreak elements skipped — we insert our own page break before the block
  }
}

/**
 * Removes Dropbox Sign text-tag tokens from the document body, leaving the
 * surrounding signature lines intact. Used for the "manual / clean" render
 * (tags:false). Dropbox Sign text tags use bracket-pipe syntax (verified against
 * the live signature-page doc + Dropbox Sign docs), e.g. [sig|req|signer1] and
 * [date|req|signer1]. Match the known field-type prefixes so arbitrary bracketed
 * text in the body is never stripped by accident.
 * @param {GoogleAppsScript.Document.Body} body
 */
function stripSignatureTextTags(body) {
  body.replaceText('\\[(sig|signature|initials?|date|text(-merge)?|checkbox)\\|[^\\]]*\\]', '');
}

