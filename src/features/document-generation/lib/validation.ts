import type { DocFormState } from "./payload-types";
import { computeTotals } from "./quote";

// Intentionally loose — requires local@domain.tld shape; rejects whitespace and bare domains.
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Split a freeform CC field on commas/semicolons into trimmed, case-insensitively deduped emails. */
export function parseCcEmails(raw: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const token of raw.split(/[,;]/)) {
    const email = token.trim();
    const key = email.toLowerCase();
    if (!email || seen.has(key)) continue;
    seen.add(key);
    out.push(email);
  }
  return out;
}

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
  if (state.docType === "contract") {
    for (const email of parseCcEmails(state.ccEmails)) {
      if (!EMAIL_RE.test(email)) missing.push(`Invalid CC email: ${email}`);
    }
  }
  return { isComplete: missing.length === 0, missing };
}
