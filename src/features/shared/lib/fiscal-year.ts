// Get default fiscal year based on current date
// If we're past June (month >= 6), we're in the next fiscal year
export function getDefaultFiscalYear(): number {
  const now = new Date();
  const month = now.getMonth();
  const year = now.getFullYear();
  return month >= 6 ? year + 1 : year;
}
