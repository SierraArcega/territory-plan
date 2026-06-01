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
