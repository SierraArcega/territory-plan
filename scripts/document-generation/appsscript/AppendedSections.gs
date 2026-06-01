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

  // SOW
  if (sections.sow_type) {
    deleteMarkerParagraph(body, '{{SOW_SECTION_START}}');
    deleteMarkerParagraph(body, '{{SOW_SECTION_END}}');
    var sowId = sections.sow_type === 'live_streaming'
      ? props[PROP.SOW_LIVESTREAM_ID]
      : props[PROP.SOW_INSTRUCTION_ID];
    if (sowId) {
      appendDocContent(doc, sowId, '[SOW content will be appended here]');
    } else {
      Logger.log('Warning: SOW doc ID not set for type: ' + sections.sow_type);
    }
  } else {
    deleteBetweenMarkers(body, '{{SOW_SECTION_START}}', '{{SOW_SECTION_END}}');
  }

  // Staffing type descriptions
  if (sections.staffing_include) {
    deleteMarkerParagraph(body, '{{STAFFING_SECTION_START}}');
    deleteMarkerParagraph(body, '{{STAFFING_SECTION_END}}');
    if (props[PROP.STAFFING_ID]) {
      appendDocContent(doc, props[PROP.STAFFING_ID], '[Staffing descriptions will be appended here]');
    } else {
      Logger.log('Warning: STAFFING_ID not set');
    }
  } else {
    deleteBetweenMarkers(body, '{{STAFFING_SECTION_START}}', '{{STAFFING_SECTION_END}}');
  }

  // Pricing sheets — each independently toggled
  var pricingSheets = [
    { flag: 'pricing_ek12',      propKey: PROP.PRICING_EK12_ID,      marker: 'EK12',      placeholder: '[EK12 pricing sheet]'          },
    { flag: 'pricing_livestaff', propKey: PROP.PRICING_LIVESTAFF_ID, marker: 'LIVESTAFF', placeholder: '[Live Staffing pricing sheet]'  },
    { flag: 'pricing_hourly',    propKey: PROP.PRICING_HOURLY_ID,    marker: 'HOURLY',    placeholder: '[Hourly pricing sheet]'         },
    { flag: 'pricing_boces',     propKey: PROP.PRICING_BOCES_ID,     marker: 'BOCES',     placeholder: '[BOCES pricing sheet]'          },
  ];

  pricingSheets.forEach(function(sheet) {
    var startMarker = '{{PRICING_' + sheet.marker + '_START}}';
    var endMarker   = '{{PRICING_' + sheet.marker + '_END}}';
    if (sections[sheet.flag]) {
      deleteMarkerParagraph(body, startMarker);
      deleteMarkerParagraph(body, endMarker);
      if (props[sheet.propKey]) {
        appendDocContent(doc, props[sheet.propKey], sheet.placeholder);
      } else {
        Logger.log('Warning: ' + sheet.propKey + ' not set');
      }
    } else {
      deleteBetweenMarkers(body, startMarker, endMarker);
    }
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
