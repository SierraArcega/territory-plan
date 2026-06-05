import type { DocFormState } from "./payload-types";

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
  if (state.lineItems.length === 0) missing.push("At least one line item");
  if (!state.startDate.trim()) missing.push("Start date");
  if (!state.endDate.trim()) missing.push("End date");
  if (state.docType === "boces_quote" && !state.quoteNumber.trim()) missing.push("Quote number");
  return { isComplete: missing.length === 0, missing };
}
