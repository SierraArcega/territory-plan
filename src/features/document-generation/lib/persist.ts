// Extracts the promoted report columns from a DocPayload for generated_documents.
// Shared by the send route (contracts) and the render route (BOCES quotes) so the
// two write paths can't drift.
import type { DocPayload } from "./payload-types";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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
  // quote/payment are required by the payload types but arrive from an untrusted
  // request body — treat as optional at runtime rather than throwing post-send.
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

export interface BocesRenderInput {
  payload: DocPayload; // doc_type "boces_quote"
  docUrl: string;
  docId: string;
  districtLeaId: string | null;
  ownerProfileId: string;
}

/** Records a successful BOCES-quote render. Render is the quote's terminal action
 *  (no eSign), so one row per (quote number, owner) — re-renders update in place.
 *  Blank quote number → no row (validation requires it, but never trust input). */
export async function upsertBocesRender(input: BocesRenderInput): Promise<void> {
  const promoted = promotedFields(input.payload);
  if (!promoted.quoteNumber) return;
  const existing = await prisma.generatedDocument.findFirst({
    where: { docType: "boces_quote", quoteNumber: promoted.quoteNumber, ownerProfileId: input.ownerProfileId },
    select: { id: true },
  });
  const fields = {
    docUrl: input.docUrl,
    docId: input.docId,
    payload: input.payload as unknown as Prisma.InputJsonValue,
    ...promoted,
    ...(input.districtLeaId ? { districtLeaId: input.districtLeaId } : {}),
  };
  if (existing) {
    await prisma.generatedDocument.update({ where: { id: existing.id }, data: fields });
  } else {
    await prisma.generatedDocument.create({
      data: {
        ...fields,
        docType: "boces_quote",
        status: "rendered",
        recipientEmail: "",
        companyName: String((input.payload.deal as Record<string, string>).client_company ?? ""),
        ownerProfileId: input.ownerProfileId,
      },
    });
  }
}
