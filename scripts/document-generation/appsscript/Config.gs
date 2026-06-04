// ─── Script property keys ────────────────────────────────────────────────────
// All Drive file IDs live in PropertiesService, never hardcoded.
// Run initScriptProperties() once after creating Drive assets.
// ─────────────────────────────────────────────────────────────────────────────

var PROP = {
  TEMPLATE_BASE_ID:       'TEMPLATE_BASE_ID',
  SIGNATURE_ID:           'SIGNATURE_ID',
  SOW_LIVESTREAM_ID:      'SOW_LIVESTREAM_ID',
  SOW_INSTRUCTION_ID:     'SOW_INSTRUCTION_ID',
  STAFFING_ID:            'STAFFING_ID',
  PRICING_EK12_ID:        'PRICING_EK12_ID',
  PRICING_LIVESTAFF_ID:   'PRICING_LIVESTAFF_ID',
  PRICING_HOURLY_ID:      'PRICING_HOURLY_ID',
  PRICING_BOCES_ID:        'PRICING_BOCES_ID',
  TEMPLATE_BOCES_QUOTE_ID: 'TEMPLATE_BOCES_QUOTE_ID',
  BOCES_AGREEMENT_PDF_ID:  'BOCES_AGREEMENT_PDF_ID',
  MSA_ID:                    'MSA_ID',
  OUTPUT_FOLDER_ID:          'OUTPUT_FOLDER_ID',
  DROPBOX_SIGN_API_KEY:      'DROPBOX_SIGN_API_KEY',
  DROPBOX_SIGN_TEST_MODE:    'DROPBOX_SIGN_TEST_MODE',
};

/**
 * One-time setup: stores all Drive file IDs as script properties.
 * Run manually in the editor after uploading Drive assets.
 * Safe to re-run — overwrites existing values.
 */
function initScriptProperties() {
  PropertiesService.getScriptProperties().setProperties({
    [PROP.TEMPLATE_BASE_ID]:       '1fWtRoml___H8w9Ke0I5H_qS5MdkZQoe7pYEVkQi2zhQ',
    [PROP.SIGNATURE_ID]:           '1ZJXvBthwn3Ggc4FphDIi76mYksD_qQj3UHa0qHUipLQ',
    [PROP.SOW_LIVESTREAM_ID]:      '18s17wd_uCiYJvam5f7k2UlrSK6XV-gDP1jg5HCCMNPY',
    [PROP.SOW_INSTRUCTION_ID]:     '192C_lfEPP-BUv3xHj2yqFEUG5_sbTUR3Z6whQNpMHPM',
    [PROP.STAFFING_ID]:            '1zVxY1wiMBJn_m-hTFcybSWu5zRv_4jgVuRYkjuZKMLw',
    [PROP.PRICING_EK12_ID]:        '1giikhnhV5hHJ7Kueq8dFPtnjbAtCFVg4GX3if09Ko6E',
    [PROP.PRICING_LIVESTAFF_ID]:   '1E0MEsTqgPrtGMKv4VwKmGrFRwrUIcCncROR3wc5L6vI',
    [PROP.PRICING_HOURLY_ID]:      '1CXbUzPkrF8XpflxrcXjoUUTq8w9LePnhOZ2edtcciy4',
    [PROP.PRICING_BOCES_ID]:        '1puCVVI12bmwZO8uV3Rom6XU21Onn4fzfUwYChUBZfWY',
    [PROP.TEMPLATE_BOCES_QUOTE_ID]: '1vxe5fwoG2nbqTCNotnmxmUOPbwcykNfRTLFZ8nJQQMM',
    [PROP.BOCES_AGREEMENT_PDF_ID]:  '1oy3mRyBr44RiDbiQIMzQyvDOWsbQwDl7',
    [PROP.MSA_ID]:                 '1E-9q0ZvaHJIMxW-YDj4ZVU4tR0qNN5B_lM5zCNCKtqI',
    [PROP.OUTPUT_FOLDER_ID]:       '1mz-10pG_G2l0h-z8iv0jMwCsjwwsN4yd',
    [PROP.DROPBOX_SIGN_API_KEY]:   '',  // set via console: PropertiesService.getScriptProperties().setProperty('DROPBOX_SIGN_API_KEY', 'key')
    [PROP.DROPBOX_SIGN_TEST_MODE]: '1', // flip to '0' for production sends
  });
  Logger.log('Script properties initialised. Run logScriptProperties() to verify.');
}

/**
 * Sets ONLY the two BOCES Quote properties (template + agreement PDF) without
 * touching any other property. Use this instead of initScriptProperties() so
 * the manually-set DROPBOX_SIGN_API_KEY is preserved. The `false` 2nd arg to
 * setProperties means MERGE (do not delete existing keys).
 * Run once in the editor.
 */
function setBocesProps() {
  PropertiesService.getScriptProperties().setProperties({
    [PROP.TEMPLATE_BOCES_QUOTE_ID]: '1vxe5fwoG2nbqTCNotnmxmUOPbwcykNfRTLFZ8nJQQMM',
    [PROP.BOCES_AGREEMENT_PDF_ID]:  '1oy3mRyBr44RiDbiQIMzQyvDOWsbQwDl7',
  }, false);
  Logger.log('BOCES props set. Run logScriptProperties() to verify.');
}

/**
 * TEMPORARY — run once, then delete.
 * Fixes the API key stored under the wrong "undefined" key name.
 * Replace PASTE_KEY_HERE with your actual Dropbox Sign API key before running.
 */
function setApiKey() {
  PropertiesService.getScriptProperties().deleteProperty('undefined');
  PropertiesService.getScriptProperties().setProperty('DROPBOX_SIGN_API_KEY', 'PASTE_KEY_HERE');
  Logger.log('Done. Run logScriptProperties() to verify.');
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
