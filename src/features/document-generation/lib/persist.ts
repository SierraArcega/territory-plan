// Extracts the promoted report columns from a DocPayload for generated_documents.
// Shared by the send route (contracts) and the render route (BOCES quotes) so the
// two write paths can't drift.
import type { DocPayload } from "./payload-types";

export interface PromotedFields {
  orderTotal: number;
  paymentType: string;
  startDate: Date | null;
  endDate: Date | null;
  schoolYear: string | null;
  quoteNumber: string | null;
}

// Form dates are "YYYY-MM-DD"; store as UTC midnight so @db.Date keeps the day.
function toDate(s: string | undefined): Date | null {
  return s && s.trim() !== "" ? new Date(`${s}T00:00:00Z`) : null;
}

export function promotedFields(payload: DocPayload): PromotedFields {
  const deal = payload.deal;
  const quote = payload.quote as { order_total?: number } | undefined;
  const payment = payload.payment as { type?: string | boolean } | undefined;
  return {
    orderTotal: quote?.order_total ?? 0,
    paymentType: String(payment?.type ?? ""),
    startDate: toDate(deal.start_date),
    endDate: toDate(deal.end_date),
    schoolYear: deal.school_year?.trim() ? deal.school_year : null,
    quoteNumber: deal.quote_number?.trim() ? deal.quote_number : null,
  };
}
