/**
 * Formats a number as USD currency string. Returns '' for null/undefined.
 * @param {number|null} amount
 * @returns {string}
 */
function formatCurrency(amount) {
  if (amount == null) return '';
  return '$' + Number(amount).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
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
