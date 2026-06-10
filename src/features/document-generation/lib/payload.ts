import type {
  DocFormState, ContactRef, ContractPayload, BocesQuotePayload, DocPayload,
} from "./payload-types";
import { computeTotals } from "./quote";
import { parseCcEmails } from "./validation";

function resolveRole(state: DocFormState, role: "signer" | "billing"): ContactRef | null {
  if (role === "signer") return state.signerSameAsClient ? state.clientContact : state.signerContact;
  return state.billingSameAsClient ? state.clientContact : state.billingContact;
}

const fullName = (c: ContactRef | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : "");

export function formatToday(d: Date): string {
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${mm}/${dd}/${d.getFullYear()}`;
}

export function assemblePayload(state: DocFormState, today: string = formatToday(new Date())): DocPayload {
  const totals = computeTotals(state.docType, state.lineItems, state.feePct, state.adjustments ?? []);
  const activeAdjustments = totals.adjustments
    .filter((a) => a.label.trim() !== "" && a.value !== 0)
    .map((a) => ({ label: a.label, type: a.type, mode: a.mode, value: a.value, amount: a.amount }));
  const client = state.clientContact;
  const billing = resolveRole(state, "billing");

  const payment: Record<string, string | boolean> = {
    type: state.paymentType,
    pay_terms: state.payTerms,
    contract_end: state.endDate,
    unused_funds: state.unusedFunds,
    billing_name: fullName(billing),
    billing_add: state.billingAddress,
    billing_email: billing?.email ?? "",
    billing_phone: billing?.phone ?? "",
    po_yn: state.poRequired,
    add_terms: state.paymentType === "B" ? state.addTerms : "",
    imp_detail: state.paymentType === "B" ? state.impDetail : "",
    pay_prepost: state.paymentType === "C" ? state.payPrePost : "",
    boces_name: state.paymentType === "C" ? state.bocesName : "",
    po_number: state.paymentType === "C" ? state.poNumber : "",
    // Blank invoice date renders as "time of signing"; otherwise the chosen date.
    invoice_date: state.invoiceDate.trim() === "" ? "time of signing" : state.invoiceDate,
  };

  if (state.docType === "boces_quote") {
    const out: BocesQuotePayload = {
      doc_type: "boces_quote",
      deal: {
        client_company: state.companyName || fullName(client),
        quote_number: state.quoteNumber,
        start_date: state.startDate,
        end_date: state.endDate,
        today,
      },
      quote: {
        fee_pct: state.feePct,
        order_total: totals.orderTotal,
        line_items: totals.lines.map((l) => ({ sku: l.sku ?? "", product: l.service, rate: l.listRate, qty: l.qty, count: l.count ?? 1, unit: l.unit ?? "" })),
        billable_days: totals.billableDays,
        billable_hours: totals.billableHours,
        adjustments: activeAdjustments,
        savings: totals.savings,
        gross_subtotal: totals.grossSubtotal,
      },
      payment,
      sections: {
        staffing_include: state.sections.staffing,
        pricing_boces: state.sections.boces,
        boces_agreement: state.sections.agreement,
      },
    };
    return out;
  }

  const signer = resolveRole(state, "signer");
  const contract: ContractPayload = {
    doc_type: "contract",
    deal: {
      client_first: client?.firstName ?? "",
      client_last: client?.lastName ?? "",
      client_title: client?.title ?? "",
      client_company: state.companyName,
      client_email: client?.email ?? "",
      school_year: state.schoolYear,
      start_date: state.startDate,
      end_date: state.endDate,
      signer_salut: signer?.salutation ?? "",
      signer_first: signer?.firstName ?? "",
      signer_last: signer?.lastName ?? "",
      signer_title: signer?.title ?? "",
      signer_email: signer?.email ?? "",
      sender_first: state.senderFirst,
      sender_last: state.senderLast,
      sender_title: state.senderTitle,
      sender_email: state.senderEmail,
      cc_emails: parseCcEmails(state.ccEmails).join(","),
      today,
    },
    quote: {
      include: state.lineItems.length > 0,
      show_pricing: state.showPricing,
      line_items: totals.lines.map((l) => ({
        sku: l.sku ?? "", service: l.service, description: l.description,
        count: l.count ?? 1, qty: l.qty, unit: l.unit ?? "", list_rate: l.listRate,
        discount_pct: l.discountPct, net_rate: l.netRate, total: l.total,
      })),
      min_amt: state.minAmt,
      max_amt: state.maxAmt,
      order_total: totals.orderTotal,
      billable_days: totals.billableDays,
      billable_hours: totals.billableHours,
      adjustments: activeAdjustments,
      savings: totals.savings,
      gross_subtotal: totals.grossSubtotal,
    },
    payment,
    sections: {
      sow_type: state.sections.sowType,
      staffing_include: state.sections.staffing,
      pricing_ek12: state.sections.ek12,
      pricing_livestaff: state.sections.liveStaff,
      pricing_hourly: state.sections.hourly,
      pricing_boces: state.sections.boces,
    },
  };
  return contract;
}
