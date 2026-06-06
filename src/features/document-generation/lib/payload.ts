import type {
  DocFormState, ContactRef, ContractPayload, BocesQuotePayload, DocPayload,
} from "./payload-types";
import { computeTotals } from "./quote";

function resolveRole(state: DocFormState, role: "signer" | "billing"): ContactRef | null {
  if (role === "signer") return state.signerSameAsClient ? state.clientContact : state.signerContact;
  return state.billingSameAsClient ? state.clientContact : state.billingContact;
}

const fullName = (c: ContactRef | null) => (c ? `${c.firstName} ${c.lastName}`.trim() : "");

export function assemblePayload(state: DocFormState): DocPayload {
  const totals = computeTotals(state.docType, state.lineItems, state.feePct);
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
    invoice_date: state.invoiceDate,
  };

  if (state.docType === "boces_quote") {
    const out: BocesQuotePayload = {
      doc_type: "boces_quote",
      deal: {
        client_company: state.companyName || fullName(client),
        quote_number: state.quoteNumber,
        start_date: state.startDate,
        end_date: state.endDate,
        today: "",
      },
      quote: {
        fee_pct: state.feePct,
        line_items: totals.lines.map((l) => ({ sku: l.sku ?? "", product: l.service, rate: l.listRate, qty: l.qty })),
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
      sender_first: state.senderFirst,
      sender_last: state.senderLast,
      sender_title: state.senderTitle,
      sender_email: state.senderEmail,
      today: "",
    },
    quote: {
      include: state.lineItems.length > 0,
      show_pricing: state.showPricing,
      line_items: totals.lines.map((l) => ({
        sku: l.sku ?? "", service: l.service, description: l.description,
        qty: l.qty, unit: l.unit ?? "", list_rate: l.listRate,
        discount_pct: l.discountPct, net_rate: l.netRate, total: l.total,
      })),
      min_amt: state.minAmt,
      max_amt: state.maxAmt,
      order_total: totals.orderTotal,
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
