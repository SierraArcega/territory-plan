// src/features/document-generation/lib/payload-types.ts
import type { FiscalYearSelection } from "./fiscal-year";

export type DocType = "contract" | "boces_quote";
export type PaymentType = "A" | "B" | "C"; // A=Standard, B=Customized, C=BOCES Standardized
export type SowType = "live_streaming" | "instructional_services";

export type AdjustmentType = "discount" | "fee" | "tax";
export type AdjustmentMode = "percent" | "amount";
export interface OrderAdjustment {
  id: string;
  label: string;
  type: AdjustmentType;
  mode: AdjustmentMode;
  value: number;
}

/** A contact resolved into a document role (from the contacts table or inline-created). */
export interface ContactRef {
  contactId: number | null; // null only transiently before persistence
  salutation: string | null;
  firstName: string;
  lastName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
}

export interface LineItemRow {
  id: string; // client-side row id (stable key)
  count?: number; // number of units (e.g. teachers); defaults to 1
  sku: string | null; // null for custom rows
  service: string; // contract: service name; boces: product name
  description: string;
  qty: number;
  unit: string | null;
  listRate: number; // contract list_rate; boces hourly rate
  discountPct: number; // contract only; always 0 for boces
}

export interface SectionToggles {
  staffing: boolean;
  ek12: boolean;
  hourly: boolean;
  liveStaff: boolean;
  boces: boolean;
  agreement: boolean; // boces only
  sowType: SowType | null; // contract only
}

export interface DocFormState {
  docType: DocType;
  districtLeaId: string;
  companyName: string;
  clientContact: ContactRef | null;
  signerSameAsClient: boolean;
  signerContact: ContactRef | null;
  billingSameAsClient: boolean;
  billingContact: ContactRef | null;
  billingAddress: string;
  senderFirst: string;
  senderLast: string;
  senderTitle: string;
  senderEmail: string;
  schoolYear: string;
  startDate: string;
  endDate: string;
  lineItems: LineItemRow[];
  adjustments: OrderAdjustment[];
  fiscalYear: FiscalYearSelection; // "auto" derives the pricebook year from contract dates
  showPricing: boolean;
  feePct: number;
  quoteNumber: string;
  minAmt: number | null;
  maxAmt: number | null;
  paymentType: PaymentType;
  payTerms: string;
  invoiceDate: string;
  unusedFunds: string;
  poRequired: boolean;
  poNumber: string;
  payPrePost: string;
  bocesName: string;
  addTerms: string;
  impDetail: string;
  sections: SectionToggles;
}

export interface ComputedLine extends LineItemRow {
  netRate: number;
  total: number;
}

export interface QuoteTotals {
  lines: ComputedLine[];
  grossSubtotal: number;
  subtotal: number;
  fee: number;
  adjustments: Array<OrderAdjustment & { amount: number }>;
  savings: number;
  orderTotal: number;
  billableDays: number;
  billableHours: number;
}

export interface ContractPayload {
  doc_type: "contract";
  deal: Record<string, string>;
  quote: {
    include: boolean;
    show_pricing: boolean;
    line_items: Array<Record<string, string | number>>;
    min_amt: number | null;
    max_amt: number | null;
    order_total: number;
    billable_days: number;
    billable_hours: number;
    adjustments: Array<{ label: string; type: string; mode: string; value: number; amount: number }>;
    savings: number;
    gross_subtotal: number;
  };
  payment: Record<string, string | boolean>;
  sections: Record<string, boolean | string | null>;
}

export interface BocesQuotePayload {
  doc_type: "boces_quote";
  deal: Record<string, string>;
  quote: {
    fee_pct: number;
    line_items: Array<Record<string, string | number>>;
    billable_days: number;
    billable_hours: number;
    adjustments: Array<{ label: string; type: string; mode: string; value: number; amount: number }>;
    savings: number;
    gross_subtotal: number;
  };
  payment: Record<string, string | boolean>;
  sections: Record<string, boolean>;
}

export type DocPayload = ContractPayload | BocesQuotePayload;

export interface RenderResult {
  docUrl: string;
  agreementUrl?: string;
}
export interface RenderOptions {
  tags: boolean;
}
export type RenderClient = (
  payload: DocPayload,
  opts: RenderOptions,
) => Promise<RenderResult>;

/** BOCES fee percentage, fixed FY27–FY29 by the Erie 1/WNYRIC agreement. */
export const DEFAULT_BOCES_FEE_PCT = 10.6;

export function emptyFormState(docType: DocType, districtLeaId: string): DocFormState {
  return {
    docType,
    districtLeaId,
    companyName: "",
    clientContact: null,
    signerSameAsClient: true,
    signerContact: null,
    billingSameAsClient: true,
    billingContact: null,
    billingAddress: "",
    senderFirst: "",
    senderLast: "",
    senderTitle: "",
    senderEmail: "",
    schoolYear: "",
    startDate: "",
    endDate: "",
    lineItems: [],
    adjustments: [],
    fiscalYear: "auto",
    showPricing: true,
    feePct: DEFAULT_BOCES_FEE_PCT,
    quoteNumber: "",
    minAmt: null,
    maxAmt: null,
    paymentType: docType === "boces_quote" ? "C" : "A",
    payTerms: "",
    invoiceDate: "",
    unusedFunds: "",
    poRequired: false,
    poNumber: "",
    payPrePost: "",
    bocesName: "",
    addTerms: "",
    impDetail: "",
    sections: {
      staffing: false, ek12: false, hourly: false, liveStaff: false,
      boces: false, agreement: false, sowType: null,
    },
  };
}
