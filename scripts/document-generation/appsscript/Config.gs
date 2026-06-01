// ─── Script property keys ────────────────────────────────────────────────────
// All Drive file IDs live in PropertiesService, never hardcoded.
// Run initScriptProperties() once after creating Drive assets.
// ─────────────────────────────────────────────────────────────────────────────

var PROP = {
  TEMPLATE_BASE_ID:       'TEMPLATE_BASE_ID',
  SOW_LIVESTREAM_ID:      'SOW_LIVESTREAM_ID',
  SOW_INSTRUCTION_ID:     'SOW_INSTRUCTION_ID',
  STAFFING_ID:            'STAFFING_ID',
  PRICING_EK12_ID:        'PRICING_EK12_ID',
  PRICING_LIVESTAFF_ID:   'PRICING_LIVESTAFF_ID',
  PRICING_HOURLY_ID:      'PRICING_HOURLY_ID',
  PRICING_BOCES_ID:       'PRICING_BOCES_ID',
  MSA_ID:                 'MSA_ID',
  OUTPUT_FOLDER_ID:       'OUTPUT_FOLDER_ID',
  PLAYWRIGHT_TRIGGER_URL: 'PLAYWRIGHT_TRIGGER_URL',
};

/**
 * One-time setup: stores all Drive file IDs as script properties.
 * Run manually in the editor after uploading Drive assets.
 * Safe to re-run — overwrites existing values.
 */
function initScriptProperties() {
  PropertiesService.getScriptProperties().setProperties({
    [PROP.TEMPLATE_BASE_ID]:       '',  // base/Fullmind_Contract_Template_v1
    [PROP.SOW_LIVESTREAM_ID]:      '',  // sow/SOW_LiveStreaming
    [PROP.SOW_INSTRUCTION_ID]:     '',  // sow/SOW_InstructionalServices
    [PROP.STAFFING_ID]:            '',  // staffing/StaffingTypeDescriptions
    [PROP.PRICING_EK12_ID]:        '',  // pricing/PricingSheet_EK12
    [PROP.PRICING_LIVESTAFF_ID]:   '',  // pricing/PricingSheet_LiveStaffing
    [PROP.PRICING_HOURLY_ID]:      '',  // pricing/PricingSheet_Hourly
    [PROP.PRICING_BOCES_ID]:       '',  // pricing/PricingSheet_BOCES
    [PROP.MSA_ID]:                 '',  // msa/MasterServicesAgreement
    [PROP.OUTPUT_FOLDER_ID]:       '',  // _output/
    [PROP.PLAYWRIGHT_TRIGGER_URL]: '',  // leave blank until TP endpoint exists
  });
  Logger.log('Script properties initialised. Run logScriptProperties() to verify.');
}

/**
 * Logs all current script property keys and values.
 * Run in the editor to verify IDs are set correctly.
 */
function logScriptProperties() {
  var props = PropertiesService.getScriptProperties().getProperties();
  Object.keys(props).sort().forEach(function(key) {
    Logger.log(key + ': ' + (props[key] || '(empty)'));
  });
}
