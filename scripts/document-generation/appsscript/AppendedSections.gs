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

  // Staffing type descriptions
  appendOptionalSection(doc, {
    include:     !!sections.staffing_include,
    sourceId:    props[PROP.STAFFING_ID],
    startMarker: '{{STAFFING_SECTION_START}}',
    endMarker:   '{{STAFFING_SECTION_END}}',
    placeholder: '[Staffing descriptions will be appended here]',
  });

  // Pricing sheets — each independently toggled
  var pricingSheets = [
    { flag: 'pricing_ek12',      propKey: PROP.PRICING_EK12_ID,      marker: 'EK12',      placeholder: '[EK12 pricing sheet]'          },
    { flag: 'pricing_livestaff', propKey: PROP.PRICING_LIVESTAFF_ID, marker: 'LIVESTAFF', placeholder: '[Live Staffing pricing sheet]'  },
    { flag: 'pricing_hourly',    propKey: PROP.PRICING_HOURLY_ID,    marker: 'HOURLY',    placeholder: '[Hourly pricing sheet]'         },
    { flag: 'pricing_boces',     propKey: PROP.PRICING_BOCES_ID,     marker: 'BOCES',     placeholder: '[BOCES pricing sheet]'          },
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
