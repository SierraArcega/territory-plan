/**
 * Handles all appended sections: SOW, staffing, pricing sheets, MSA.
 * Each section is independently controlled by the sections flags in payload.
 * MSA is always appended last regardless of other flags.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {Object} sections  payload.sections
 * @param {Object} props     All script properties from PropertiesService
 */
function handleAppendedSections(doc, sections, props) {
  var body = doc.getBody();

  // Signature page — always appended immediately after payment terms
  if (props[PROP.SIGNATURE_ID]) {
    appendDocContent(doc, props[PROP.SIGNATURE_ID], null, true);
  } else {
    Logger.log('Warning: SIGNATURE_ID not set — signature page skipped');
  }

  // SOW
  appendOptionalSection(doc, {
    include:     !!sections.sow_type,
    sourceId:    sections.sow_type === 'live_streaming'
                   ? props[PROP.SOW_LIVESTREAM_ID]
                   : props[PROP.SOW_INSTRUCTION_ID],
    startMarker: '{{SOW_SECTION_START}}',
    endMarker:   '{{SOW_SECTION_END}}',
    placeholder: '[SOW content will be appended here]',
  });

  // Staffing type descriptions (shared with the BOCES quote)
  appendStaffingSection(doc, sections.staffing_include, props);

  // Pricing sheets — each independently toggled. BOCES is handled separately
  // below via the shared appendBocesPricingSection helper so the BOCES quote can
  // reuse it; the remaining sheets stay in this data-driven loop.
  var pricingSheets = [
    { flag: 'pricing_ek12',      propKey: PROP.PRICING_EK12_ID,      marker: 'EK12',      placeholder: '[EK12 pricing sheet]'          },
    { flag: 'pricing_livestaff', propKey: PROP.PRICING_LIVESTAFF_ID, marker: 'LIVESTAFF', placeholder: '[Live Staffing pricing sheet]'  },
    { flag: 'pricing_hourly',    propKey: PROP.PRICING_HOURLY_ID,    marker: 'HOURLY',    placeholder: '[Hourly pricing sheet]'         },
  ];

  pricingSheets.forEach(function(sheet) {
    appendOptionalSection(doc, {
      include:     !!sections[sheet.flag],
      sourceId:    props[sheet.propKey],
      startMarker: '{{PRICING_' + sheet.marker + '_START}}',
      endMarker:   '{{PRICING_' + sheet.marker + '_END}}',
      placeholder: sheet.placeholder,
    });
  });

  // BOCES pricing sheet — appended last among the pricing sheets (unchanged
  // order), via the shared helper.
  appendBocesPricingSection(doc, sections.pricing_boces, props);

  // Remove outer pricing section wrapper markers
  deleteMarkerParagraph(body, '{{PRICING_SECTION_START}}');
  deleteMarkerParagraph(body, '{{PRICING_SECTION_END}}');

  // MSA — always last
  deleteMarkerParagraph(body, '{{MSA_START}}');
  deleteMarkerParagraph(body, '{{MSA_END}}');
  if (props[PROP.MSA_ID]) {
    appendDocContent(doc, props[PROP.MSA_ID], '[Master Services Agreement]');
  } else {
    Logger.log('Warning: MSA_ID not set — MSA section skipped');
  }
}

/**
 * Appends the Staffing Type Descriptions section. Shared by the full contract
 * and the BOCES quote — both reference the same Drive doc and markers, so the
 * source ID, markers, and placeholder live in one place here.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {boolean} include  whether to append (else the section is deleted)
 * @param {Object} props     All script properties from PropertiesService
 */
function appendStaffingSection(doc, include, props) {
  appendOptionalSection(doc, {
    include:     !!include,
    sourceId:    props[PROP.STAFFING_ID],
    startMarker: '{{STAFFING_SECTION_START}}',
    endMarker:   '{{STAFFING_SECTION_END}}',
    placeholder: '[Staffing descriptions will be appended here]',
  });
}

/**
 * Appends the BOCES pricing sheet section. Shared by the full contract and the
 * BOCES quote.
 * @param {GoogleAppsScript.Document.Document} doc
 * @param {boolean} include  whether to append (else the section is deleted)
 * @param {Object} props     All script properties from PropertiesService
 */
function appendBocesPricingSection(doc, include, props) {
  appendOptionalSection(doc, {
    include:     !!include,
    sourceId:    props[PROP.PRICING_BOCES_ID],
    startMarker: '{{PRICING_BOCES_START}}',
    endMarker:   '{{PRICING_BOCES_END}}',
    placeholder: '[BOCES pricing sheet]',
  });
}
