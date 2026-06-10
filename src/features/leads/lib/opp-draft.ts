// Opportunity draft for the Link-opportunity flow (OppFields in the handoff):
// create a fresh Stage 0 opp (name/product/amount/closeDate) or link an
// existing open opp. Suggestion defaults port suggestOpp() from leadsData.js.

import { addBizDays } from "./sla";
import { OPP_PRODUCTS } from "./status-config";
import type { Lead } from "./types";
import type { LinkOpportunityMutationInput } from "./queries";

export interface OppDraft {
  mode: "new" | "existing";
  existingId: string;
  name: string;
  product: string;
  amount: number;
  closeDate: string; // yyyy-mm-dd
}

/** Suggested opp name for a district + product pair. */
export function suggestOppName(districtName: string | undefined, product: string): string {
  return `${districtName ?? "New account"} — ${product}`;
}

/** Suggested defaults when linking a brand-new opp from a lead (suggestOpp port). */
export function suggestOppDraft(lead: Lead, now: Date = new Date()): OppDraft {
  const product = OPP_PRODUCTS[0];
  return {
    mode: "new",
    existingId: "",
    name: suggestOppName(lead.district?.name, product),
    product,
    amount: 75000,
    closeDate: addBizDays(now, 45).toISOString().slice(0, 10),
  };
}

/** Port of oppDraftValid(): existing → a pick; new → name + amount > 0 + close date. */
export function oppDraftValid(draft: OppDraft): boolean {
  if (draft.mode === "existing") return !!draft.existingId;
  return !!draft.name.trim() && Number(draft.amount) > 0 && !!draft.closeDate;
}

/** Mutation payload for POST /api/leads/[id]/opportunity. */
export function oppDraftPayload(
  leadId: string,
  draft: OppDraft,
): LinkOpportunityMutationInput {
  if (draft.mode === "existing") {
    return { leadId, opportunityId: draft.existingId };
  }
  return {
    leadId,
    name: draft.name.trim(),
    amount: Number(draft.amount),
    closeDate: draft.closeDate,
  };
}
