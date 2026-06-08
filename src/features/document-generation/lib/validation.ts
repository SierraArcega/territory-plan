import type { DocFormState } from "./payload-types";
import { computeTotals } from "./quote";

export interface Completeness {
  isComplete: boolean;
  missing: string[];
}

export function getCompleteness(state: DocFormState): Completeness {
  const missing: string[] = [];
  if (!state.clientContact) missing.push("Client contact");
  if (!state.signerSameAsClient && !state.signerContact) missing.push("Signer contact");
  if (!state.billingSameAsClient && !state.billingContact) missing.push("Billing contact");
  if (!state.billingAddress.trim()) missing.push("Billing address");
  if (state.lineItems.length === 0) {
    missing.push("At least one line item");
  } else {
    // Guard against a $0 quote from zero qty/rate lines (a discount that nets
    // to $0 is intentional and allowed — only the line subtotal must be > 0).
    const { subtotal } = computeTotals(state.docType, state.lineItems, state.feePct, state.adjustments);
    if (subtotal <= 0) missing.push("Line items must total more than $0");
  }
  if (!state.startDate.trim()) missing.push("Start date");
  if (!state.endDate.trim()) missing.push("End date");
  if (state.docType === "boces_quote" && !state.quoteNumber.trim()) missing.push("Quote number");
  return { isComplete: missing.length === 0, missing };
}
