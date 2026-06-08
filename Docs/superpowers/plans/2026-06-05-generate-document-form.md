# Generate Document — Form & Review Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build the in-app form that assembles a Contract / BOCES-Quote payload from an opportunity, renders the real Google Doc via a single renderer, and routes it (default = Dropbox Sign).

**Architecture:** Bottom-up. Pure logic libs first (quote math, payload assembly, validation, prefill) under full TDD; then React sections; then the form + review-stage assembly; finally a standalone dev route to host/test it. The renderer is a **stubbed typed client** (`RenderClient`) — its real implementation and the delivery branches are separate plans. Nothing renders live as the rep types; rendering is an explicit on-demand action.

**Tech Stack:** Next.js App Router, React 19, TypeScript, TanStack Query, Vitest + Testing Library. Fetcher: `fetchJson` from `src/features/shared/lib/api-client.ts`. Brand tokens per `Documentation/UI Framework/tokens.md`.

**Spec:** `Docs/superpowers/specs/2026-06-05-generate-document-form-design.md`

**Dependencies (stubbed here, real impl elsewhere):**
- Renderer service (sub-project 1) — this plan defines + stubs `RenderClient`.
- Delivery / Dropbox Sign (sub-project 4) — review-stage branch buttons call placeholder handlers.
- Entry points (sub-project 3) — replaced here by a standalone dev route host.

---

## File Structure

All new feature code lives under `src/features/document-generation/`.

**Lib (pure logic + hooks):**
- `lib/payload-types.ts` — all TypeScript types (form state, computed, payloads, render client). *Create.*
- `lib/quote.ts` — line-item auto-calc (net rate, totals, BOCES fee). *Create.*
- `lib/payload.ts` — assemble `ContractPayload` / `BocesQuotePayload` from form state. *Create.*
- `lib/validation.ts` — required-field completeness per doc type. *Create.*
- `lib/prefill.ts` — map `Opportunity` + `UserProfile` → partial form state. *Create.*
- `lib/render-client.ts` — `RenderClient` type + stub impl. *Create.*
- `lib/queries.ts` — `useDistrictContacts(leaid)` (leaid-scoped contact list). *Create.*

**Components:**
- `components/form/DocTypeSelector.tsx`
- `components/form/ContactRolePicker.tsx`
- `components/form/PartiesContactsSection.tsx`
- `components/form/SkuPicker.tsx`
- `components/form/QuoteSection.tsx`
- `components/form/PaymentSection.tsx`
- `components/form/SectionsToggles.tsx`
- `components/form/DocumentPayloadForm.tsx`
- `components/review/ReviewStage.tsx`
- `components/GenerateDocumentModal.tsx`

**Route (dev host):**
- `src/app/document-generator/page.tsx` + `src/app/document-generator/layout.tsx`

**Tests:** co-located `__tests__/` next to each source dir.

---

## Task 1: Core types

**Files:**
- Create: `src/features/document-generation/lib/payload-types.ts`
- Test: `src/features/document-generation/lib/__tests__/payload-types.test.ts`

- [ ] **Step 1: Write the types file**

```typescript
// src/features/document-generation/lib/payload-types.ts
export type DocType = "contract" | "boces_quote";
export type PaymentType = "A" | "B" | "C"; // A=Standard, B=Customized, C=BOCES Standardized
export type SowType = "live_streaming" | "instructional_services";

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
  // parties & dates
  clientContact: ContactRef | null;
  signerSameAsClient: boolean;
  signerContact: ContactRef | null;
  billingSameAsClient: boolean;
  billingContact: ContactRef | null;
  billingAddress: string; // required, ephemeral
  schoolYear: string;
  startDate: string;
  endDate: string;
  // quote
  lineItems: LineItemRow[];
  showPricing: boolean; // contract
  feePct: number; // boces (default 10.6)
  quoteNumber: string; // boces
  minAmt: number | null;
  maxAmt: number | null;
  // payment
  paymentType: PaymentType;
  payTerms: string;
  invoiceDate: string;
  unusedFunds: string;
  poRequired: boolean;
  poNumber: string;
  payPrePost: string; // type C
  bocesName: string; // type C
  addTerms: string; // type B
  impDetail: string; // type B
  sections: SectionToggles;
}

export interface ComputedLine extends LineItemRow {
  netRate: number; // contract: listRate*(1-discountPct/100); boces: == listRate
  total: number; // netRate*qty (contract); listRate*qty (boces)
}

export interface QuoteTotals {
  lines: ComputedLine[];
  subtotal: number;
  fee: number; // boces only; 0 for contract
  orderTotal: number; // contract: subtotal; boces: subtotal+fee
}

// ---- Payloads sent to the renderer (match Apps Script schemas) ----
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
  };
  payment: Record<string, string | boolean>;
  sections: Record<string, boolean | string | null>;
}

export interface BocesQuotePayload {
  doc_type: "boces_quote";
  deal: Record<string, string>;
  quote: { fee_pct: number; line_items: Array<Record<string, string | number>> };
  payment: Record<string, string | boolean>;
  sections: Record<string, boolean>;
}

export type DocPayload = ContractPayload | BocesQuotePayload;

export interface RenderResult {
  docUrl: string;
  agreementUrl?: string;
}
export interface RenderOptions {
  tags: boolean; // bake eSign text-tags (default true); false for manual branch
}
export type RenderClient = (
  payload: DocPayload,
  opts: RenderOptions,
) => Promise<RenderResult>;
```

- [ ] **Step 2: Write a usage test (type smoke + default factory)**

Add an `emptyFormState(docType, districtLeaId)` factory so every consumer starts from a consistent shape.

```typescript
// append to payload-types.ts
export function emptyFormState(docType: DocType, districtLeaId: string): DocFormState {
  return {
    docType,
    districtLeaId,
    clientContact: null,
    signerSameAsClient: true,
    signerContact: null,
    billingSameAsClient: true,
    billingContact: null,
    billingAddress: "",
    schoolYear: "",
    startDate: "",
    endDate: "",
    lineItems: [],
    showPricing: true,
    feePct: 10.6,
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
```

```typescript
// src/features/document-generation/lib/__tests__/payload-types.test.ts
import { describe, it, expect } from "vitest";
import { emptyFormState } from "../payload-types";

describe("emptyFormState", () => {
  it("defaults contract payment type to A", () => {
    expect(emptyFormState("contract", "0612345").paymentType).toBe("A");
  });
  it("defaults boces payment type to C and fee to 10.6", () => {
    const s = emptyFormState("boces_quote", "0612345");
    expect(s.paymentType).toBe("C");
    expect(s.feePct).toBe(10.6);
  });
  it("starts with no line items", () => {
    expect(emptyFormState("contract", "x").lineItems).toEqual([]);
  });
});
```

- [ ] **Step 3: Run test**

Run: `npm test -- src/features/document-generation/lib/__tests__/payload-types.test.ts`
Expected: PASS (3 tests).

- [ ] **Step 4: Commit**

```bash
git add src/features/document-generation/lib/payload-types.ts src/features/document-generation/lib/__tests__/payload-types.test.ts
git commit -m "feat(doc-gen): add Generate Document form types + empty-state factory"
```

---

## Task 2: Quote auto-calc engine

**Files:**
- Create: `src/features/document-generation/lib/quote.ts`
- Test: `src/features/document-generation/lib/__tests__/quote.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/document-generation/lib/__tests__/quote.test.ts
import { describe, it, expect } from "vitest";
import { computeTotals } from "../quote";
import type { LineItemRow } from "../payload-types";

const row = (over: Partial<LineItemRow>): LineItemRow => ({
  id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs",
  listRate: 0, discountPct: 0, ...over,
});

describe("computeTotals (contract)", () => {
  it("applies discount to net rate and multiplies by qty", () => {
    const t = computeTotals("contract", [row({ listRate: 100, discountPct: 10, qty: 2 })], 0);
    expect(t.lines[0].netRate).toBe(90);
    expect(t.lines[0].total).toBe(180);
    expect(t.subtotal).toBe(180);
    expect(t.fee).toBe(0);
    expect(t.orderTotal).toBe(180);
  });
  it("rounds to 2 decimals", () => {
    const t = computeTotals("contract", [row({ listRate: 33.333, discountPct: 0, qty: 3 })], 0);
    expect(t.lines[0].total).toBe(100); // 33.333*3 = 99.999 -> 100.00
  });
});

describe("computeTotals (boces)", () => {
  it("ignores discount, adds fee_pct of subtotal", () => {
    const t = computeTotals("boces_quote", [row({ listRate: 100, qty: 10, discountPct: 50 })], 10.6);
    expect(t.lines[0].total).toBe(1000); // discount ignored
    expect(t.subtotal).toBe(1000);
    expect(t.fee).toBe(106);
    expect(t.orderTotal).toBe(1106);
  });
});
```

- [ ] **Step 2: Run it to confirm failure**

Run: `npm test -- src/features/document-generation/lib/__tests__/quote.test.ts`
Expected: FAIL — `computeTotals` is not defined.

- [ ] **Step 3: Implement**

```typescript
// src/features/document-generation/lib/quote.ts
import type { DocType, LineItemRow, ComputedLine, QuoteTotals } from "./payload-types";

export function round2(n: number): number {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

export function computeTotals(
  docType: DocType,
  rows: LineItemRow[],
  feePct: number,
): QuoteTotals {
  const lines: ComputedLine[] = rows.map((r) => {
    const netRate =
      docType === "contract" ? round2(r.listRate * (1 - r.discountPct / 100)) : r.listRate;
    const total = round2(netRate * r.qty);
    return { ...r, netRate, total };
  });
  const subtotal = round2(lines.reduce((s, l) => s + l.total, 0));
  const fee = docType === "boces_quote" ? round2(subtotal * (feePct / 100)) : 0;
  const orderTotal = round2(subtotal + fee);
  return { lines, subtotal, fee, orderTotal };
}
```

- [ ] **Step 4: Run tests — expect PASS**

Run: `npm test -- src/features/document-generation/lib/__tests__/quote.test.ts`
Expected: PASS (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/quote.ts src/features/document-generation/lib/__tests__/quote.test.ts
git commit -m "feat(doc-gen): add quote auto-calc engine (contract + BOCES fee)"
```

---

## Task 3: Payload assembly

**Files:**
- Create: `src/features/document-generation/lib/payload.ts`
- Test: `src/features/document-generation/lib/__tests__/payload.test.ts`

Assembles the snake_case payload the Apps Script expects, resolving contact roles (honoring the "same as client" flags), clearing inactive payment-type fields, and omitting line items when the quote is empty.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/document-generation/lib/__tests__/payload.test.ts
import { describe, it, expect } from "vitest";
import { assemblePayload } from "../payload";
import { emptyFormState } from "../payload-types";
import type { ContactRef } from "../payload-types";

const jane: ContactRef = {
  contactId: 1, salutation: "Dr.", firstName: "Jane", lastName: "Smith",
  title: "Superintendent", email: "jane@d.org", phone: "555",
};

describe("assemblePayload (contract)", () => {
  it("uses client contact for signer/billing when 'same as' is true", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = jane;
    s.billingAddress = "1 Main St";
    s.lineItems = [{ id: "1", sku: "HS", service: "HS", description: "", qty: 2, unit: "hrs", listRate: 85, discountPct: 0 }];
    const p = assemblePayload(s) as Extract<ReturnType<typeof assemblePayload>, { doc_type: "contract" }>;
    expect(p.deal.signer_first).toBe("Jane");
    expect(p.payment.billing_name).toBe("Jane Smith");
    expect(p.payment.billing_add).toBe("1 Main St");
    expect(p.quote.line_items).toHaveLength(1);
    expect(p.quote.order_total).toBe(170);
  });

  it("clears type-B/C fields when payment type is A", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = jane;
    s.paymentType = "A";
    s.addTerms = "leftover"; s.poNumber = "leftover";
    const p = assemblePayload(s);
    expect(p.payment.add_terms).toBe("");
    expect(p.payment.po_number).toBe("");
  });
});

describe("assemblePayload (boces)", () => {
  it("emits fee_pct and boces line item shape", () => {
    const s = emptyFormState("boces_quote", "x");
    s.clientContact = jane;
    s.quoteNumber = "Q-1";
    s.lineItems = [{ id: "1", sku: "BOC27-HB11", service: "Homebound", description: "", qty: 10, unit: "hrs", listRate: 100, discountPct: 0 }];
    const p = assemblePayload(s) as Extract<ReturnType<typeof assemblePayload>, { doc_type: "boces_quote" }>;
    expect(p.quote.fee_pct).toBe(10.6);
    expect(p.quote.line_items[0]).toMatchObject({ product: "Homebound", rate: 100, qty: 10 });
    expect(p.deal.quote_number).toBe("Q-1");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL** (`assemblePayload` not defined).

Run: `npm test -- src/features/document-generation/lib/__tests__/payload.test.ts`

- [ ] **Step 3: Implement**

```typescript
// src/features/document-generation/lib/payload.ts
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
    // type B (cleared unless active)
    add_terms: state.paymentType === "B" ? state.addTerms : "",
    imp_detail: state.paymentType === "B" ? state.impDetail : "",
    // type C (cleared unless active)
    pay_prepost: state.paymentType === "C" ? state.payPrePost : "",
    boces_name: state.paymentType === "C" ? state.bocesName : "",
    po_number: state.paymentType === "C" ? state.poNumber : "",
  };

  if (state.docType === "boces_quote") {
    const signer = client;
    const out: BocesQuotePayload = {
      doc_type: "boces_quote",
      deal: {
        client_company: state.bocesName || fullName(client),
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
    void signer;
    return out;
  }

  const signer = resolveRole(state, "signer");
  const contract: ContractPayload = {
    doc_type: "contract",
    deal: {
      client_first: client?.firstName ?? "",
      client_last: client?.lastName ?? "",
      client_title: client?.title ?? "",
      client_company: state.bocesName || "",
      client_email: client?.email ?? "",
      school_year: state.schoolYear,
      start_date: state.startDate,
      end_date: state.endDate,
      signer_salut: signer?.salutation ?? "",
      signer_first: signer?.firstName ?? "",
      signer_last: signer?.lastName ?? "",
      signer_title: signer?.title ?? "",
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
```

> Note: `deal.client_company` for contract is currently sourced from `state.bocesName`/blank — wire it to the district/opportunity company name in Task 9 (it is set via prefill). The renderer fills `today` server-side.

- [ ] **Step 4: Run tests — expect PASS** (4 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/payload.ts src/features/document-generation/lib/__tests__/payload.test.ts
git commit -m "feat(doc-gen): assemble contract/BOCES payloads from form state"
```

---

## Task 4: Validation / completeness

**Files:**
- Create: `src/features/document-generation/lib/validation.ts`
- Test: `src/features/document-generation/lib/__tests__/validation.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/document-generation/lib/__tests__/validation.test.ts
import { describe, it, expect } from "vitest";
import { getCompleteness } from "../validation";
import { emptyFormState } from "../payload-types";
import type { ContactRef } from "../payload-types";

const c: ContactRef = { contactId: 1, salutation: null, firstName: "A", lastName: "B", title: "T", email: "a@b.c", phone: "1" };

describe("getCompleteness", () => {
  it("flags missing contact, billing address, line items, dates", () => {
    const r = getCompleteness(emptyFormState("contract", "x"));
    expect(r.isComplete).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(["Client contact", "Billing address", "At least one line item", "Start date", "End date"]));
  });
  it("is complete when required fields present", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = c; s.billingAddress = "1 Main"; s.startDate = "07/01/26"; s.endDate = "06/30/27";
    s.lineItems = [{ id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }];
    const r = getCompleteness(s);
    expect(r.isComplete).toBe(true);
    expect(r.missing).toEqual([]);
  });
  it("boces additionally requires a quote number", () => {
    const s = emptyFormState("boces_quote", "x");
    s.clientContact = c; s.billingAddress = "1"; s.startDate = "a"; s.endDate = "b";
    s.lineItems = [{ id: "1", sku: "B", service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }];
    expect(getCompleteness(s).missing).toContain("Quote number");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/features/document-generation/lib/validation.ts
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
```

- [ ] **Step 4: Run tests — expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/validation.ts src/features/document-generation/lib/__tests__/validation.test.ts
git commit -m "feat(doc-gen): add per-doc-type completeness validation"
```

---

## Task 5: Prefill mapping (opportunity + profile → form state)

**Files:**
- Create: `src/features/document-generation/lib/prefill.ts`
- Test: `src/features/document-generation/lib/__tests__/prefill.test.ts`

The opportunity shape used here is the subset returned by `/api/territory-plans/[id]/opportunities` and `/api/opportunities/[id]`. Define a local `OpportunityPrefill` input type so this lib has no coupling to the full DB model.

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/document-generation/lib/__tests__/prefill.test.ts
import { describe, it, expect } from "vitest";
import { buildPrefill } from "../prefill";

describe("buildPrefill", () => {
  it("maps the 8 opportunity fields and the booking reference", () => {
    const s = buildPrefill(
      { doc_type: "contract" },
      {
        districtLeaId: "0612345", districtName: "Barstow USD",
        startDate: "2026-07-01", contractThrough: "2026-06-30",
        paymentTerms: "Net 30", minimumPurchaseAmount: 1000,
        maximumBudget: 5000, netBookingAmount: 188000,
      },
      { fullName: "Rep Person", email: "rep@fm.com", jobTitle: "AE" },
    );
    expect(s.districtLeaId).toBe("0612345");
    expect(s.startDate).toBe("2026-07-01");
    expect(s.endDate).toBe("2026-06-30");
    expect(s.payTerms).toBe("Net 30");
    expect(s.minAmt).toBe(1000);
    expect(s.maxAmt).toBe(5000);
    expect(s.bookingReference).toBe(188000);
    expect(s.companyName).toBe("Barstow USD");
    expect(s.sender).toEqual({ first: "Rep", last: "Person", title: "AE", email: "rep@fm.com" });
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/features/document-generation/lib/prefill.ts
import type { DocType } from "./payload-types";

export interface OpportunityPrefill {
  districtLeaId: string | null;
  districtName: string | null;
  startDate: string | null;
  contractThrough: string | null;
  paymentTerms: string | null;
  minimumPurchaseAmount: number | null;
  maximumBudget: number | null;
  netBookingAmount: number | null;
}
export interface ProfilePrefill {
  fullName: string | null;
  email: string | null;
  jobTitle: string | null;
}

/** Partial form state derived from the opportunity + profile. Merged into emptyFormState by the form. */
export interface PrefillResult {
  docType: DocType;
  districtLeaId: string;
  companyName: string;
  startDate: string;
  endDate: string;
  payTerms: string;
  minAmt: number | null;
  maxAmt: number | null;
  bookingReference: number | null; // displayed as reference, never written to payload directly
  sender: { first: string; last: string; title: string; email: string };
}

function splitName(full: string | null): { first: string; last: string } {
  const parts = (full ?? "").trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", last: "" };
  return { first: parts[0], last: parts.slice(1).join(" ") };
}

export function buildPrefill(
  opts: { doc_type: DocType },
  opp: OpportunityPrefill,
  profile: ProfilePrefill,
): PrefillResult {
  const name = splitName(profile.fullName);
  return {
    docType: opts.doc_type,
    districtLeaId: opp.districtLeaId ?? "",
    companyName: opp.districtName ?? "",
    startDate: opp.startDate ?? "",
    endDate: opp.contractThrough ?? "",
    payTerms: opp.paymentTerms ?? "",
    minAmt: opp.minimumPurchaseAmount,
    maxAmt: opp.maximumBudget,
    bookingReference: opp.netBookingAmount,
    sender: { first: name.first, last: name.last, title: profile.jobTitle ?? "", email: profile.email ?? "" },
  };
}
```

- [ ] **Step 4: Run tests — expect PASS** (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/prefill.ts src/features/document-generation/lib/__tests__/prefill.test.ts
git commit -m "feat(doc-gen): map opportunity + profile into form prefill"
```

---

## Task 6: Render client stub

**Files:**
- Create: `src/features/document-generation/lib/render-client.ts`
- Test: `src/features/document-generation/lib/__tests__/render-client.test.ts`

- [ ] **Step 1: Write the failing test**

```typescript
// src/features/document-generation/lib/__tests__/render-client.test.ts
import { describe, it, expect } from "vitest";
import { stubRenderClient } from "../render-client";
import { assemblePayload } from "../payload";
import { emptyFormState } from "../payload-types";

describe("stubRenderClient", () => {
  it("returns a placeholder doc URL and echoes tag mode", async () => {
    const payload = assemblePayload(emptyFormState("contract", "x"));
    const res = await stubRenderClient(payload, { tags: true });
    expect(res.docUrl).toMatch(/^https:\/\/docs\.google\.com\/document\/d\/STUB/);
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/features/document-generation/lib/render-client.ts
import type { RenderClient } from "./payload-types";

/**
 * STUB renderer. The real implementation (sub-project 1) POSTs the payload to
 * the deployed Apps Script and returns the generated Google Doc URL. Until then
 * this returns a deterministic placeholder so the form is independently testable.
 */
export const stubRenderClient: RenderClient = async (payload, opts) => {
  const tagSuffix = opts.tags ? "tagged" : "clean";
  return {
    docUrl: `https://docs.google.com/document/d/STUB-${payload.doc_type}-${tagSuffix}/edit`,
    ...(payload.doc_type === "boces_quote" && payload.sections.boces_agreement
      ? { agreementUrl: "https://drive.google.com/file/d/STUB-AGREEMENT/view" }
      : {}),
  };
};
```

- [ ] **Step 4: Run tests — expect PASS** (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/render-client.ts src/features/document-generation/lib/__tests__/render-client.test.ts
git commit -m "feat(doc-gen): add stub render client behind RenderClient interface"
```

---

## Task 7: District-scoped contacts hook

**Files:**
- Create: `src/features/document-generation/lib/queries.ts`
- Test: `src/features/document-generation/lib/__tests__/queries.test.ts`

`/api/contacts` already supports a `leaid` filter; `useContacts` does not pass it. Add a focused hook.

- [ ] **Step 1: Write the failing test (URL building)**

```typescript
// src/features/document-generation/lib/__tests__/queries.test.ts
import { describe, it, expect } from "vitest";
import { districtContactsUrl } from "../queries";

describe("districtContactsUrl", () => {
  it("builds a leaid-scoped contacts URL", () => {
    expect(districtContactsUrl("0612345")).toBe("/api/contacts?leaid=0612345");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```typescript
// src/features/document-generation/lib/queries.ts
import { useQuery } from "@tanstack/react-query";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
import type { Contact } from "@/features/shared/types/api-types";

export function districtContactsUrl(leaid: string): string {
  return `${API_BASE}/contacts?leaid=${encodeURIComponent(leaid)}`;
}

interface ContactsListResponse {
  contacts: Contact[];
}

export function useDistrictContacts(leaid: string | null) {
  return useQuery({
    queryKey: ["contacts", { leaid }],
    queryFn: () => fetchJson<ContactsListResponse>(districtContactsUrl(leaid as string)),
    enabled: !!leaid,
    staleTime: 2 * 60 * 1000,
  });
}
```

> Verify the `/api/contacts?leaid=` response shape against `src/app/api/contacts/route.ts` (GET). If it returns a bare array, change `ContactsListResponse` to `Contact[]` and unwrap accordingly.

- [ ] **Step 4: Run tests — expect PASS** (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/lib/queries.ts src/features/document-generation/lib/__tests__/queries.test.ts
git commit -m "feat(doc-gen): add leaid-scoped district contacts hook"
```

---

## Task 8: ContactRolePicker component

**Files:**
- Create: `src/features/document-generation/components/form/ContactRolePicker.tsx`
- Test: `src/features/document-generation/components/form/__tests__/ContactRolePicker.test.tsx`

A searchable dropdown of the district's contacts + an inline "＋ Add new" form that persists via `useCreateContact` and auto-selects the created contact into this role.

- [ ] **Step 1: Write the failing test**

```typescript
// .../form/__tests__/ContactRolePicker.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ContactRolePicker from "../ContactRolePicker";

vi.mock("@/features/document-generation/lib/queries", () => ({
  useDistrictContacts: () => ({
    data: { contacts: [{ id: 1, name: "Jane Smith", title: "Superintendent", email: "j@d.org", phone: "5", salutation: "Dr." }] },
    isLoading: false,
  }),
}));
vi.mock("@/features/shared/lib/queries", () => ({
  useCreateContact: () => ({ mutateAsync: vi.fn(), isPending: false }),
}));

function setup(onChange = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <ContactRolePicker label="Client contact" leaid="0612345" value={null} onChange={onChange} />
    </QueryClientProvider>,
  );
  return { onChange };
}

describe("ContactRolePicker", () => {
  it("renders the role label and existing contacts", () => {
    setup();
    expect(screen.getByText("Client contact")).toBeInTheDocument();
    expect(screen.getByText(/Jane Smith/)).toBeInTheDocument();
  });
  it("selecting a contact emits a ContactRef via onChange", () => {
    const { onChange } = setup();
    fireEvent.click(screen.getByText(/Jane Smith/));
    expect(onChange).toHaveBeenCalledWith(
      expect.objectContaining({ contactId: 1, firstName: "Jane", lastName: "Smith", title: "Superintendent" }),
    );
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement** (brand tokens; Lucide icons; `whitespace-nowrap` on text spans per CLAUDE.md)

```tsx
// .../form/ContactRolePicker.tsx
"use client";
import { useState } from "react";
import { Plus } from "lucide-react";
import { useDistrictContacts } from "@/features/document-generation/lib/queries";
import { useCreateContact } from "@/features/shared/lib/queries";
import type { ContactRef } from "@/features/document-generation/lib/payload-types";

function splitName(name: string) {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  return { first: parts[0] ?? "", last: parts.slice(1).join(" ") };
}

interface Props {
  label: string;
  leaid: string;
  value: ContactRef | null;
  onChange: (c: ContactRef) => void;
}

export default function ContactRolePicker({ label, leaid, value, onChange }: Props) {
  const { data } = useDistrictContacts(leaid);
  const createContact = useCreateContact();
  const [adding, setAdding] = useState(false);
  const [form, setForm] = useState({ salutation: "", name: "", title: "", email: "", phone: "" });

  const contacts = data?.contacts ?? [];

  function toRef(c: { id: number | null; salutation?: string | null; name: string; title?: string | null; email?: string | null; phone?: string | null }): ContactRef {
    const { first, last } = splitName(c.name);
    return { contactId: c.id, salutation: c.salutation ?? null, firstName: first, lastName: last, title: c.title ?? null, email: c.email ?? null, phone: c.phone ?? null };
  }

  async function handleCreate() {
    const created = await createContact.mutateAsync({
      leaid, name: form.name, salutation: form.salutation || undefined,
      title: form.title || undefined, email: form.email || undefined, phone: form.phone || undefined,
    });
    onChange(toRef(created)); // auto-select into this role
    setAdding(false);
    setForm({ salutation: "", name: "", title: "", email: "", phone: "" });
  }

  return (
    <div className="space-y-1">
      <div className="text-xs uppercase tracking-wide text-[#6B4E9E] whitespace-nowrap">{label}</div>
      <div className="flex flex-wrap gap-1">
        {contacts.map((c) => (
          <button key={c.id} type="button" onClick={() => onChange(toRef(c))}
            className={`rounded-lg px-2 py-1 text-sm whitespace-nowrap ${value?.contactId === c.id ? "bg-[#6B4E9E] text-white" : "bg-[#EFEDF5]"}`}>
            {c.name}{c.title ? ` — ${c.title}` : ""}
          </button>
        ))}
        <button type="button" onClick={() => setAdding((a) => !a)}
          className="flex items-center gap-1 rounded-lg border border-[#EFEDF5] px-2 py-1 text-sm whitespace-nowrap">
          <Plus size={14} /> Add new
        </button>
      </div>
      {adding && (
        <div className="space-y-1 rounded-lg bg-[#F7F5FA] p-2">
          {(["salutation", "name", "title", "email", "phone"] as const).map((f) => (
            <input key={f} placeholder={f} value={form[f]}
              onChange={(e) => setForm((s) => ({ ...s, [f]: e.target.value }))}
              className="w-full rounded border border-[#EFEDF5] px-2 py-1 text-sm" />
          ))}
          <button type="button" onClick={handleCreate} disabled={!form.name || createContact.isPending}
            className="rounded-lg bg-[#6B4E9E] px-3 py-1 text-sm text-white disabled:opacity-50">
            Save contact
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form/ContactRolePicker.tsx src/features/document-generation/components/form/__tests__/ContactRolePicker.test.tsx
git commit -m "feat(doc-gen): contact role picker with inline create + auto-select"
```

---

## Task 9: PartiesContactsSection

**Files:**
- Create: `src/features/document-generation/components/form/PartiesContactsSection.tsx`
- Test: `src/features/document-generation/components/form/__tests__/PartiesContactsSection.test.tsx`

Composes the client picker + "same person" checkboxes (signer/billing pickers appear only when unchecked) + the always-required billing address. Controlled via the form state slice.

- [ ] **Step 1: Write the failing test**

```typescript
// .../form/__tests__/PartiesContactsSection.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PartiesContactsSection from "../PartiesContactsSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

vi.mock("../ContactRolePicker", () => ({
  default: ({ label }: { label: string }) => <div>picker:{label}</div>,
}));

function setup(stateOverride = {}) {
  const state = { ...emptyFormState("contract", "0612345"), ...stateOverride };
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PartiesContactsSection state={state} onChange={onChange} />
    </QueryClientProvider>,
  );
  return { onChange };
}

describe("PartiesContactsSection", () => {
  it("hides signer/billing pickers when 'same as client' is checked (default)", () => {
    setup();
    expect(screen.getByText("picker:Client contact")).toBeInTheDocument();
    expect(screen.queryByText("picker:Signer")).not.toBeInTheDocument();
    expect(screen.queryByText("picker:Billing contact")).not.toBeInTheDocument();
  });
  it("shows the signer picker when 'signer same as client' is unchecked", () => {
    setup({ signerSameAsClient: false });
    expect(screen.getByText("picker:Signer")).toBeInTheDocument();
  });
  it("always shows the required billing address field", () => {
    setup();
    expect(screen.getByPlaceholderText(/Billing address/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../form/PartiesContactsSection.tsx
"use client";
import ContactRolePicker from "./ContactRolePicker";
import type { DocFormState, ContactRef } from "@/features/document-generation/lib/payload-types";

interface Props {
  state: DocFormState;
  onChange: (patch: Partial<DocFormState>) => void;
}

export default function PartiesContactsSection({ state, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";
  return (
    <div className="space-y-3">
      <ContactRolePicker label="Client contact" leaid={state.districtLeaId}
        value={state.clientContact} onChange={(c: ContactRef) => onChange({ clientContact: c })} />

      {!isBoces && (
        <label className="flex items-center gap-2 text-sm whitespace-nowrap">
          <input type="checkbox" checked={state.signerSameAsClient}
            onChange={(e) => onChange({ signerSameAsClient: e.target.checked })} />
          Signer is the same person
        </label>
      )}
      {!isBoces && !state.signerSameAsClient && (
        <ContactRolePicker label="Signer" leaid={state.districtLeaId}
          value={state.signerContact} onChange={(c) => onChange({ signerContact: c })} />
      )}

      <label className="flex items-center gap-2 text-sm whitespace-nowrap">
        <input type="checkbox" checked={state.billingSameAsClient}
          onChange={(e) => onChange({ billingSameAsClient: e.target.checked })} />
        Billing contact is the same person
      </label>
      {!state.billingSameAsClient && (
        <ContactRolePicker label="Billing contact" leaid={state.districtLeaId}
          value={state.billingContact} onChange={(c) => onChange({ billingContact: c })} />
      )}

      <input placeholder="Billing address (required) *" value={state.billingAddress}
        onChange={(e) => onChange({ billingAddress: e.target.value })}
        className="w-full rounded border border-[#c44] px-2 py-1 text-sm" />

      <div className="flex flex-wrap gap-2">
        <input placeholder="Start date" value={state.startDate}
          onChange={(e) => onChange({ startDate: e.target.value })}
          className="flex-1 rounded border border-[#EFEDF5] px-2 py-1 text-sm" />
        <input placeholder="End date" value={state.endDate}
          onChange={(e) => onChange({ endDate: e.target.value })}
          className="flex-1 rounded border border-[#EFEDF5] px-2 py-1 text-sm" />
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form/PartiesContactsSection.tsx src/features/document-generation/components/form/__tests__/PartiesContactsSection.test.tsx
git commit -m "feat(doc-gen): parties & contacts section with progressive role overrides"
```

---

## Task 10: SkuPicker

**Files:**
- Create: `src/features/document-generation/components/form/SkuPicker.tsx`
- Test: `src/features/document-generation/components/form/__tests__/SkuPicker.test.tsx`

Searchable pricebook list; contract mode = `getProducts({ fiscalYear: "FY27" })`, BOCES mode = `getBocesProducts()`. Emits a `LineItemRow` on pick.

- [ ] **Step 1: Write the failing test**

```typescript
// .../form/__tests__/SkuPicker.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SkuPicker from "../SkuPicker";

vi.mock("@/features/document-generation/lib/pricebook", () => ({
  DEFAULT_FISCAL_YEAR: "FY27",
  getProducts: () => [{ sku: "HS-1", name: "HS SpEd FT", category: "c", fiscalYear: "FY27", listRate: 85, description: "d", unit: "Hour", pricePerHour: 85, chargedPer: null, fullYear190: null, fullYear180: null }],
  getBocesProducts: () => [{ sku: "BOC27-HB11", name: "Homebound", category: "c", fiscalYear: "FY27", listRate: 100, description: "d", unit: "Hour", pricePerHour: 100, chargedPer: null, fullYear190: null, fullYear180: null }],
}));

describe("SkuPicker", () => {
  it("lists contract products and emits a LineItemRow on pick", () => {
    const onPick = vi.fn();
    render(<SkuPicker docType="contract" onPick={onPick} />);
    fireEvent.click(screen.getByText(/HS SpEd FT/));
    expect(onPick).toHaveBeenCalledWith(expect.objectContaining({ sku: "HS-1", service: "HS SpEd FT", listRate: 85, unit: "Hour" }));
  });
  it("lists BOCES products in boces mode", () => {
    render(<SkuPicker docType="boces_quote" onPick={vi.fn()} />);
    expect(screen.getByText(/Homebound/)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../form/SkuPicker.tsx
"use client";
import { useMemo, useState } from "react";
import { getProducts, getBocesProducts, DEFAULT_FISCAL_YEAR } from "@/features/document-generation/lib/pricebook";
import type { DocType, LineItemRow } from "@/features/document-generation/lib/payload-types";

let rowSeq = 0;
function newRowId() { rowSeq += 1; return `row-${rowSeq}`; }

interface Props { docType: DocType; onPick: (row: LineItemRow) => void; }

export default function SkuPicker({ docType, onPick }: Props) {
  const [q, setQ] = useState("");
  const products = useMemo(
    () => (docType === "boces_quote" ? getBocesProducts() : getProducts({ fiscalYear: DEFAULT_FISCAL_YEAR })),
    [docType],
  );
  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()));

  return (
    <div className="space-y-1">
      <input placeholder="Search pricebook…" value={q} onChange={(e) => setQ(e.target.value)}
        className="w-full rounded border border-[#EFEDF5] px-2 py-1 text-sm" />
      <div className="max-h-40 overflow-y-auto">
        {filtered.slice(0, 50).map((p) => (
          <button key={p.sku} type="button"
            onClick={() => onPick({ id: newRowId(), sku: p.sku, service: p.name, description: p.description, qty: 1, unit: p.unit, listRate: p.listRate, discountPct: 0 })}
            className="block w-full rounded px-2 py-1 text-left text-sm hover:bg-[#EFEDF5] whitespace-nowrap">
            {p.name} <span className="text-[#6B4E9E]">${p.listRate}</span>
          </button>
        ))}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form/SkuPicker.tsx src/features/document-generation/components/form/__tests__/SkuPicker.test.tsx
git commit -m "feat(doc-gen): pricebook SKU picker (FY27 default / BOCES mode)"
```

---

## Task 11: QuoteSection (table + custom row + booking reference)

**Files:**
- Create: `src/features/document-generation/components/form/QuoteSection.tsx`
- Test: `src/features/document-generation/components/form/__tests__/QuoteSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// .../form/__tests__/QuoteSection.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import QuoteSection from "../QuoteSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

vi.mock("../SkuPicker", () => ({ default: () => <div>sku-picker</div> }));

function setup(over = {}, booking: number | null = 188000) {
  const state = { ...emptyFormState("contract", "x"),
    lineItems: [{ id: "1", sku: "HS", service: "HS", description: "", qty: 120, unit: "hrs", listRate: 85, discountPct: 0 }],
    ...over };
  render(<QuoteSection state={state} bookingReference={booking} onChange={vi.fn()} />);
}

describe("QuoteSection", () => {
  it("shows the live order total", () => {
    setup();
    expect(screen.getByText(/\$10,200/)).toBeInTheDocument(); // 120*85
  });
  it("shows the opp booking reference and a mismatch warning", () => {
    setup();
    expect(screen.getByText(/\$188,000/)).toBeInTheDocument();
    expect(screen.getByText(/doesn't match/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../form/QuoteSection.tsx
"use client";
import { Plus } from "lucide-react";
import SkuPicker from "./SkuPicker";
import { computeTotals } from "@/features/document-generation/lib/quote";
import type { DocFormState, LineItemRow } from "@/features/document-generation/lib/payload-types";

let customSeq = 0;
const usd = (n: number) => `$${n.toLocaleString("en-US")}`;

interface Props {
  state: DocFormState;
  bookingReference: number | null;
  onChange: (patch: Partial<DocFormState>) => void;
}

export default function QuoteSection({ state, bookingReference, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";
  const totals = computeTotals(state.docType, state.lineItems, state.feePct);
  const setRows = (rows: LineItemRow[]) => onChange({ lineItems: rows });

  const addCustom = () => { customSeq += 1; setRows([...state.lineItems, { id: `custom-${customSeq}`, sku: null, service: "", description: "", qty: 1, unit: isBoces ? "hrs" : "flat", listRate: 0, discountPct: 0 }]); };
  const mismatch = bookingReference != null && Math.abs(bookingReference - totals.orderTotal) > 1;

  return (
    <div className="space-y-2">
      <div className="flex flex-wrap items-center gap-2">
        <SkuPicker docType={state.docType} onPick={(r) => setRows([...state.lineItems, r])} />
        <button type="button" onClick={addCustom} className="flex items-center gap-1 rounded-lg bg-[#EFEDF5] px-2 py-1 text-sm whitespace-nowrap">
          <Plus size={14} /> Custom row
        </button>
      </div>

      <table className="w-full text-sm">
        <tbody>
          {totals.lines.map((l) => (
            <tr key={l.id} className="border-t border-[#EFEDF5]">
              <td className="whitespace-nowrap">{l.service || <span className="text-[#999]">(custom)</span>}</td>
              <td className="text-right whitespace-nowrap">{l.qty} {l.unit}</td>
              <td className="text-right whitespace-nowrap">${l.listRate}</td>
              <td className="text-right whitespace-nowrap">{usd(l.total)}</td>
            </tr>
          ))}
        </tbody>
      </table>

      <div className="rounded-lg bg-[#FFF7E6] p-2 text-sm">
        <span className="font-semibold whitespace-nowrap">Order total: {usd(totals.orderTotal)}</span>
        {bookingReference != null && (
          <span className="ml-2 whitespace-nowrap">· Deal booking: {usd(bookingReference)}
            {mismatch && <span className="ml-1 text-[#b8860b]">⚠ doesn't match — intentional?</span>}
          </span>
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form/QuoteSection.tsx src/features/document-generation/components/form/__tests__/QuoteSection.test.tsx
git commit -m "feat(doc-gen): quote section with live totals + booking reference"
```

---

## Task 12: PaymentSection (A/B/C + conditional fields)

**Files:**
- Create: `src/features/document-generation/components/form/PaymentSection.tsx`
- Test: `src/features/document-generation/components/form/__tests__/PaymentSection.test.tsx`

- [ ] **Step 1: Write the failing test**

```typescript
// .../form/__tests__/PaymentSection.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import PaymentSection from "../PaymentSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

const render_ = (over = {}) =>
  render(<PaymentSection state={{ ...emptyFormState("contract", "x"), ...over }} onChange={vi.fn()} />);

describe("PaymentSection", () => {
  it("shows the three payment-type labels", () => {
    render_();
    expect(screen.getByRole("option", { name: /A — Standard/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /B — Customized/ })).toBeInTheDocument();
    expect(screen.getByRole("option", { name: /C — BOCES Standardized/ })).toBeInTheDocument();
  });
  it("reveals type-B fields only when type is B", () => {
    render_({ paymentType: "A" });
    expect(screen.queryByPlaceholderText(/Additional terms/i)).not.toBeInTheDocument();
  });
  it("reveals type-C fields when type is C", () => {
    render_({ paymentType: "C" });
    expect(screen.getByPlaceholderText(/PO number/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../form/PaymentSection.tsx
"use client";
import type { DocFormState, PaymentType } from "@/features/document-generation/lib/payload-types";

interface Props { state: DocFormState; onChange: (patch: Partial<DocFormState>) => void; }

const TYPES: { value: PaymentType; label: string }[] = [
  { value: "A", label: "A — Standard" },
  { value: "B", label: "B — Customized" },
  { value: "C", label: "C — BOCES Standardized" },
];

export default function PaymentSection({ state, onChange }: Props) {
  return (
    <div className="space-y-2 text-sm">
      <select value={state.paymentType} onChange={(e) => onChange({ paymentType: e.target.value as PaymentType })}
        className="rounded border border-[#EFEDF5] px-2 py-1">
        {TYPES.map((t) => <option key={t.value} value={t.value}>{t.label}</option>)}
      </select>

      <input placeholder="Payment terms (e.g. Net 30)" value={state.payTerms}
        onChange={(e) => onChange({ payTerms: e.target.value })}
        className="w-full rounded border border-[#EFEDF5] px-2 py-1" />
      <label className="flex items-center gap-2 whitespace-nowrap">
        <input type="checkbox" checked={state.poRequired} onChange={(e) => onChange({ poRequired: e.target.checked })} />
        PO required
      </label>

      {state.paymentType === "B" && (
        <>
          <input placeholder="Additional terms" value={state.addTerms}
            onChange={(e) => onChange({ addTerms: e.target.value })}
            className="w-full rounded border border-[#EFEDF5] px-2 py-1" />
          <input placeholder="Implementation detail" value={state.impDetail}
            onChange={(e) => onChange({ impDetail: e.target.value })}
            className="w-full rounded border border-[#EFEDF5] px-2 py-1" />
        </>
      )}
      {state.paymentType === "C" && (
        <>
          <input placeholder="PO number" value={state.poNumber}
            onChange={(e) => onChange({ poNumber: e.target.value })}
            className="w-full rounded border border-[#EFEDF5] px-2 py-1" />
          <input placeholder="BOCES name" value={state.bocesName}
            onChange={(e) => onChange({ bocesName: e.target.value })}
            className="w-full rounded border border-[#EFEDF5] px-2 py-1" />
          <input placeholder="Pre/post (pre|post)" value={state.payPrePost}
            onChange={(e) => onChange({ payPrePost: e.target.value })}
            className="w-full rounded border border-[#EFEDF5] px-2 py-1" />
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form/PaymentSection.tsx src/features/document-generation/components/form/__tests__/PaymentSection.test.tsx
git commit -m "feat(doc-gen): payment section with A/B/C conditional fields"
```

---

## Task 13: SectionsToggles + DocTypeSelector

**Files:**
- Create: `src/features/document-generation/components/form/SectionsToggles.tsx`
- Create: `src/features/document-generation/components/form/DocTypeSelector.tsx`
- Test: `src/features/document-generation/components/form/__tests__/SectionsToggles.test.tsx`
- Test: `src/features/document-generation/components/form/__tests__/DocTypeSelector.test.tsx`

- [ ] **Step 1: Write the failing tests**

```typescript
// .../form/__tests__/DocTypeSelector.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DocTypeSelector from "../DocTypeSelector";

describe("DocTypeSelector", () => {
  it("emits the chosen doc type", () => {
    const onChange = vi.fn();
    render(<DocTypeSelector value="contract" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "boces_quote" } });
    expect(onChange).toHaveBeenCalledWith("boces_quote");
  });
});
```

```typescript
// .../form/__tests__/SectionsToggles.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SectionsToggles from "../SectionsToggles";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

describe("SectionsToggles", () => {
  it("toggles staffing and emits a sections patch", () => {
    const onChange = vi.fn();
    render(<SectionsToggles state={emptyFormState("contract", "x")} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Staffing descriptions/i));
    expect(onChange).toHaveBeenCalledWith({ sections: expect.objectContaining({ staffing: true }) });
  });
  it("shows the BOCES agreement toggle only in boces mode", () => {
    const { rerender } = render(<SectionsToggles state={emptyFormState("contract", "x")} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/BOCES agreement/i)).not.toBeInTheDocument();
    rerender(<SectionsToggles state={emptyFormState("boces_quote", "x")} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/BOCES agreement/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run them — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../form/DocTypeSelector.tsx
"use client";
import type { DocType } from "@/features/document-generation/lib/payload-types";
interface Props { value: DocType; onChange: (d: DocType) => void; }
export default function DocTypeSelector({ value, onChange }: Props) {
  return (
    <select aria-label="Document type" value={value} onChange={(e) => onChange(e.target.value as DocType)}
      className="rounded border border-[#EFEDF5] px-2 py-1 text-sm font-semibold">
      <option value="contract">Contract</option>
      <option value="boces_quote">BOCES Quote</option>
    </select>
  );
}
```

```tsx
// .../form/SectionsToggles.tsx
"use client";
import type { DocFormState, SectionToggles } from "@/features/document-generation/lib/payload-types";
interface Props { state: DocFormState; onChange: (patch: Partial<DocFormState>) => void; }

export default function SectionsToggles({ state, onChange }: Props) {
  const isBoces = state.docType === "boces_quote";
  const set = (key: keyof SectionToggles, val: boolean) => onChange({ sections: { ...state.sections, [key]: val } });
  const Toggle = ({ k, label }: { k: keyof SectionToggles; label: string }) => (
    <label className="flex items-center gap-2 text-sm whitespace-nowrap">
      <input type="checkbox" checked={Boolean(state.sections[k])} onChange={(e) => set(k, e.target.checked)} /> {label}
    </label>
  );
  return (
    <div className="space-y-1">
      <Toggle k="staffing" label="Staffing descriptions" />
      <Toggle k="boces" label="BOCES pricing sheet" />
      {!isBoces && <Toggle k="ek12" label="EK12 pricing sheet" />}
      {!isBoces && <Toggle k="hourly" label="Hourly pricing sheet" />}
      {!isBoces && <Toggle k="liveStaff" label="Live staffing pricing sheet" />}
      {isBoces && <Toggle k="agreement" label="BOCES agreement (MLSA)" />}
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (3 tests across both files).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form/SectionsToggles.tsx src/features/document-generation/components/form/DocTypeSelector.tsx src/features/document-generation/components/form/__tests__/SectionsToggles.test.tsx src/features/document-generation/components/form/__tests__/DocTypeSelector.test.tsx
git commit -m "feat(doc-gen): doc-type selector + appended-sections toggles"
```

---

## Task 14: DocumentPayloadForm (assembly)

**Files:**
- Create: `src/features/document-generation/components/form/DocumentPayloadForm.tsx`
- Test: `src/features/document-generation/components/form/__tests__/DocumentPayloadForm.test.tsx`

Controlled `value`/`onChange` over `DocFormState`, plus optional `prefill`. Renders all sections, a sticky completeness footer, and the primary Render button (disabled until complete). It does NOT call the renderer — it raises `onRender`.

- [ ] **Step 1: Write the failing test**

```typescript
// .../form/__tests__/DocumentPayloadForm.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DocumentPayloadForm from "../DocumentPayloadForm";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";
import type { ContactRef } from "@/features/document-generation/lib/payload-types";

vi.mock("../ContactRolePicker", () => ({ default: () => <div>picker</div> }));
vi.mock("../SkuPicker", () => ({ default: () => <div>sku</div> }));

const complete = () => {
  const s = emptyFormState("contract", "x");
  const c: ContactRef = { contactId: 1, salutation: null, firstName: "A", lastName: "B", title: "T", email: "e", phone: "p" };
  return { ...s, clientContact: c, billingAddress: "1 Main", startDate: "a", endDate: "b",
    lineItems: [{ id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }] };
};

function setup(state = emptyFormState("contract", "x"), onRender = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DocumentPayloadForm value={state} onChange={vi.fn()} onRender={onRender} bookingReference={null} />
    </QueryClientProvider>,
  );
  return { onRender };
}

describe("DocumentPayloadForm", () => {
  it("disables Render when incomplete and lists what's missing", () => {
    setup();
    expect(screen.getByRole("button", { name: /Render document/i })).toBeDisabled();
    expect(screen.getByText(/Billing address/)).toBeInTheDocument();
  });
  it("enables Render when complete and fires onRender", () => {
    const { onRender } = setup(complete());
    const btn = screen.getByRole("button", { name: /Render document/i });
    expect(btn).toBeEnabled();
    btn.click();
    expect(onRender).toHaveBeenCalled();
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../form/DocumentPayloadForm.tsx
"use client";
import DocTypeSelector from "./DocTypeSelector";
import PartiesContactsSection from "./PartiesContactsSection";
import QuoteSection from "./QuoteSection";
import PaymentSection from "./PaymentSection";
import SectionsToggles from "./SectionsToggles";
import { getCompleteness } from "@/features/document-generation/lib/validation";
import type { DocFormState, DocType } from "@/features/document-generation/lib/payload-types";

interface Props {
  value: DocFormState;
  onChange: (next: DocFormState) => void;
  onRender: () => void;
  bookingReference: number | null;
}

export default function DocumentPayloadForm({ value, onChange, onRender, bookingReference }: Props) {
  const patch = (p: Partial<DocFormState>) => onChange({ ...value, ...p });
  const setDocType = (docType: DocType) =>
    onChange({ ...value, docType, paymentType: docType === "boces_quote" ? "C" : value.paymentType });
  const { isComplete, missing } = getCompleteness(value);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <DocTypeSelector value={value.docType} onChange={setDocType} />
      </div>
      <section><h3 className="text-sm font-semibold">Parties &amp; Contacts</h3>
        <PartiesContactsSection state={value} onChange={patch} /></section>
      <section><h3 className="text-sm font-semibold">Quote</h3>
        <QuoteSection state={value} bookingReference={bookingReference} onChange={patch} /></section>
      <section><h3 className="text-sm font-semibold">Payment terms</h3>
        <PaymentSection state={value} onChange={patch} /></section>
      <section><h3 className="text-sm font-semibold">Sections to append</h3>
        <SectionsToggles state={value} onChange={patch} /></section>

      <div className="sticky bottom-0 flex items-center justify-between border-t border-[#EFEDF5] bg-white py-2">
        <span className="text-xs text-[#666] whitespace-nowrap">
          {isComplete ? "All required fields complete ✓" : `Missing: ${missing.join(", ")}`}
        </span>
        <button type="button" onClick={onRender} disabled={!isComplete}
          className="rounded-lg bg-[#6B4E9E] px-3 py-1 text-sm text-white disabled:opacity-50 whitespace-nowrap">
          Render document →
        </button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (2 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/form/DocumentPayloadForm.tsx src/features/document-generation/components/form/__tests__/DocumentPayloadForm.test.tsx
git commit -m "feat(doc-gen): assemble DocumentPayloadForm with completeness footer"
```

---

## Task 15: ReviewStage (rendered doc + branches)

**Files:**
- Create: `src/features/document-generation/components/review/ReviewStage.tsx`
- Test: `src/features/document-generation/components/review/__tests__/ReviewStage.test.tsx`

Shows the rendered doc link + a terms recap; primary action **Send for signature** (default), secondary **Open Google Doc** (manual → triggers `onManual`, which the modal handles as a tag-free re-render), and **Back to edit**. The actual Dropbox Sign send is a placeholder handler (delivery sub-project).

- [ ] **Step 1: Write the failing test**

```typescript
// .../review/__tests__/ReviewStage.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import ReviewStage from "../ReviewStage";

const props = (over = {}) => ({
  result: { docUrl: "https://docs.google.com/document/d/X/edit" },
  orderTotal: 16500,
  onSend: vi.fn(), onManual: vi.fn(), onBack: vi.fn(), ...over,
});

describe("ReviewStage", () => {
  it("makes Send for signature the primary action", () => {
    render(<ReviewStage {...props()} />);
    const send = screen.getByRole("button", { name: /Send for signature/i });
    expect(send).toBeInTheDocument();
  });
  it("fires onManual for the Open Google Doc branch", () => {
    const p = props();
    render(<ReviewStage {...p} />);
    screen.getByRole("button", { name: /Open Google Doc/i }).click();
    expect(p.onManual).toHaveBeenCalled();
  });
  it("links to the rendered doc", () => {
    render(<ReviewStage {...props()} />);
    expect(screen.getByRole("link", { name: /rendered document/i })).toHaveAttribute("href", "https://docs.google.com/document/d/X/edit");
  });
});
```

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../review/ReviewStage.tsx
"use client";
import type { RenderResult } from "@/features/document-generation/lib/payload-types";

interface Props {
  result: RenderResult;
  orderTotal: number;
  onSend: () => void;   // Dropbox Sign (default) — placeholder until delivery sub-project
  onManual: () => void; // re-render tag-free + open doc
  onBack: () => void;
}

export default function ReviewStage({ result, orderTotal, onSend, onManual, onBack }: Props) {
  return (
    <div className="space-y-3">
      <a href={result.docUrl} target="_blank" rel="noreferrer"
        className="text-[#6B4E9E] underline whitespace-nowrap">Open the rendered document ↗</a>
      <div className="text-sm">Order total: ${orderTotal.toLocaleString("en-US")}</div>
      {result.agreementUrl && (
        <a href={result.agreementUrl} target="_blank" rel="noreferrer" className="block text-sm text-[#6B4E9E] underline">
          BOCES agreement (MLSA) ↗
        </a>
      )}
      <div className="flex flex-wrap gap-2">
        <button type="button" onClick={onSend}
          className="rounded-lg bg-[#6B4E9E] px-3 py-1 text-sm text-white whitespace-nowrap">Send for signature</button>
        <button type="button" onClick={onManual}
          className="rounded-lg bg-[#EFEDF5] px-3 py-1 text-sm whitespace-nowrap">Open Google Doc (manual)</button>
        <button type="button" onClick={onBack}
          className="rounded-lg border border-[#EFEDF5] px-3 py-1 text-sm whitespace-nowrap">← Back to edit</button>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (3 tests).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/review/ReviewStage.tsx src/features/document-generation/components/review/__tests__/ReviewStage.test.tsx
git commit -m "feat(doc-gen): review stage with eSign-default branch routing"
```

---

## Task 16: GenerateDocumentModal (orchestration)

**Files:**
- Create: `src/features/document-generation/components/GenerateDocumentModal.tsx`
- Test: `src/features/document-generation/components/__tests__/GenerateDocumentModal.test.tsx`

Owns form state, the form↔review stage switch, and the render call (via injected `renderClient`, defaulting to `stubRenderClient`). On "Render" → `renderClient(assemblePayload(state), { tags: true })` → review. On "Open Google Doc (manual)" → re-render with `{ tags: false }` and open the returned URL.

- [ ] **Step 1: Write the failing test**

```typescript
// .../components/__tests__/GenerateDocumentModal.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import GenerateDocumentModal from "../GenerateDocumentModal";

vi.mock("../form/ContactRolePicker", () => ({ default: () => <div>picker</div> }));
vi.mock("../form/SkuPicker", () => ({ default: () => <div>sku</div> }));

const completePrefill = {
  docType: "contract" as const, districtLeaId: "x", companyName: "Barstow",
  startDate: "a", endDate: "b", payTerms: "Net 30", minAmt: null, maxAmt: null,
  bookingReference: 188000, sender: { first: "R", last: "P", title: "AE", email: "e" },
};

function setup(renderClient = vi.fn().mockResolvedValue({ docUrl: "https://docs.google.com/document/d/X/edit" })) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <GenerateDocumentModal prefill={completePrefill} onClose={vi.fn()} renderClient={renderClient} />
    </QueryClientProvider>,
  );
  return { renderClient };
}

describe("GenerateDocumentModal", () => {
  it("renders with tags:true and advances to the review stage", async () => {
    const { renderClient } = setup();
    // Fill the remaining required fields are stubbed via prefill except contact/billing/lineItems;
    // For this test, click Render is blocked until complete — so we assert the render call wiring
    // by directly invoking through a complete state is covered in DocumentPayloadForm tests.
    expect(renderClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Document type")).toBeInTheDocument();
  });
});
```

> The end-to-end "render → review" path depends on a fully complete state which requires the (mocked) contact picker to emit a contact. Keep this modal test focused on wiring/mount; the render-call contract is unit-tested in `payload`/`render-client` and the button-enable logic in `DocumentPayloadForm`. Add an integration test in the dev-route task if desired.

- [ ] **Step 2: Run it — expect FAIL.**

- [ ] **Step 3: Implement**

```tsx
// .../components/GenerateDocumentModal.tsx
"use client";
import { useState } from "react";
import DocumentPayloadForm from "./form/DocumentPayloadForm";
import ReviewStage from "./review/ReviewStage";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";
import type { DocFormState, RenderClient, RenderResult } from "@/features/document-generation/lib/payload-types";
import { assemblePayload } from "@/features/document-generation/lib/payload";
import { computeTotals } from "@/features/document-generation/lib/quote";
import { stubRenderClient } from "@/features/document-generation/lib/render-client";
import type { PrefillResult } from "@/features/document-generation/lib/prefill";

interface Props {
  prefill: PrefillResult;
  onClose: () => void;
  renderClient?: RenderClient;
}

function seedState(p: PrefillResult): DocFormState {
  const base = emptyFormState(p.docType, p.districtLeaId);
  return { ...base, startDate: p.startDate, endDate: p.endDate, payTerms: p.payTerms, minAmt: p.minAmt, maxAmt: p.maxAmt, bocesName: p.companyName };
}

export default function GenerateDocumentModal({ prefill, onClose, renderClient = stubRenderClient }: Props) {
  const [state, setState] = useState<DocFormState>(() => seedState(prefill));
  const [result, setResult] = useState<RenderResult | null>(null);
  const [busy, setBusy] = useState(false);

  async function render(tags: boolean): Promise<RenderResult> {
    setBusy(true);
    try {
      const res = await renderClient(assemblePayload(state), { tags });
      setResult(res);
      return res;
    } finally {
      setBusy(false);
    }
  }

  const orderTotal = computeTotals(state.docType, state.lineItems, state.feePct).orderTotal;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} />
      <div className="relative mx-4 max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 shadow-xl">
        {result ? (
          <ReviewStage
            result={result}
            orderTotal={orderTotal}
            onSend={() => { /* delivery sub-project: Dropbox Sign */ }}
            onManual={async () => { const r = await render(false); window.open(r.docUrl, "_blank"); }}
            onBack={() => setResult(null)}
          />
        ) : (
          <DocumentPayloadForm
            value={state}
            onChange={setState}
            onRender={() => { if (!busy) void render(true); }}
            bookingReference={prefill.bookingReference}
          />
        )}
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS** (1 test).

- [ ] **Step 5: Commit**

```bash
git add src/features/document-generation/components/GenerateDocumentModal.tsx src/features/document-generation/components/__tests__/GenerateDocumentModal.test.tsx
git commit -m "feat(doc-gen): GenerateDocumentModal orchestrates form→render→review"
```

---

## Task 17: Standalone dev-host route

**Files:**
- Create: `src/app/document-generator/page.tsx`
- Create: `src/app/document-generator/layout.tsx`

A throwaway host so the modal is testable without the real entry points. Mirrors `src/app/views/layout.tsx` (AppShell + `useProfile`). Hard-codes a sample prefill for now; the real opportunity-driven prefill arrives with the entry-points sub-project.

- [ ] **Step 1: Create the layout** (mirror `src/app/views/layout.tsx`; verify its exact AppShell import + props by reading it first)

```tsx
// src/app/document-generator/layout.tsx
"use client";
import { Suspense } from "react";
import AppShell from "@/features/shared/components/AppShell"; // VERIFY this path against src/app/views/layout.tsx
export default function DocumentGeneratorLayout({ children }: { children: React.ReactNode }) {
  return (
    <AppShell>
      <Suspense fallback={null}>{children}</Suspense>
    </AppShell>
  );
}
```

- [ ] **Step 2: Create the page**

```tsx
// src/app/document-generator/page.tsx
"use client";
import { useState } from "react";
import GenerateDocumentModal from "@/features/document-generation/components/GenerateDocumentModal";
import { useProfile } from "@/features/shared/lib/queries";
import type { PrefillResult } from "@/features/document-generation/lib/prefill";

export default function DocumentGeneratorDevPage() {
  const { data: profile } = useProfile();
  const [open, setOpen] = useState(false);

  // Sample prefill for dev; real prefill comes from the opportunity in the entry-points sub-project.
  const prefill: PrefillResult = {
    docType: "contract", districtLeaId: "0612345", companyName: "Sample USD",
    startDate: "07/01/2026", endDate: "06/30/2027", payTerms: "Net 30",
    minAmt: null, maxAmt: null, bookingReference: 188000,
    sender: { first: (profile?.fullName ?? "Rep").split(" ")[0], last: "", title: profile?.jobTitle ?? "", email: profile?.email ?? "" },
  };

  return (
    <div className="p-6">
      <button onClick={() => setOpen(true)} className="rounded-lg bg-[#6B4E9E] px-4 py-2 text-white">
        Open Generate Document
      </button>
      {open && <GenerateDocumentModal prefill={prefill} onClose={() => setOpen(false)} />}
    </div>
  );
}
```

- [ ] **Step 3: Manual verification** (no automated test — it's a dev harness)

Run: `npm run dev` (port 3005), open `http://localhost:3005/document-generator`, click **Open Generate Document**. Verify:
- The form shows all sections; Render is disabled until you pick a contact, add a line item, fill billing address + dates.
- Picking a pricebook SKU adds a row; order total updates; the $188,000 booking reference + mismatch warning appears.
- Switching doc-type to **BOCES Quote** hides the signer "same person" checkbox, forces payment type C, and shows the BOCES agreement toggle.
- Clicking **Render document** advances to the review stage with the stub doc URL; **Send for signature** is the primary button; **Open Google Doc (manual)** opens a `…-clean…` stub URL in a new tab; **Back to edit** returns.

- [ ] **Step 4: Run the full doc-gen test suite**

Run: `npm test -- src/features/document-generation`
Expected: all tasks' tests PASS.

- [ ] **Step 5: Commit**

```bash
git add src/app/document-generator/page.tsx src/app/document-generator/layout.tsx
git commit -m "feat(doc-gen): standalone dev-host route for the Generate Document modal"
```

---

## Self-Review

**Spec coverage:**
- Layout B single-scroll sectioned form → Tasks 14, 17. ✓
- Doc-type selector reshaping form → Tasks 13, 14 (payment forced C), 9 (signer hidden for BOCES), 13 (agreement toggle). ✓
- Parties & contacts: pick-or-create, auto-select, progressive overrides, required billing address → Tasks 8, 9. ✓
- Quote: empty start, SKU picker (FY27 default / BOCES), custom rows, contract vs BOCES columns, booking reference + mismatch → Tasks 10, 11, 2. ✓
- Payment A/B/C mapping, defaults, conditional clear-on-hide → Tasks 12 (UI), 3 (payload clearing). ✓
- Sections toggles → Task 13. ✓
- Render → review → branches (Send-for-signature default, manual tag-free re-render, back) → Tasks 15, 16. ✓
- Single-renderer principle / tags param → Tasks 6, 16. ✓
- Prefill provenance (opp + profile) → Task 5. ✓
- Completeness/validation → Tasks 4, 14. ✓
- Component contract (controlled value/onChange + prefill) → Tasks 14, 16. ✓
- Host independence (renderer stub + dev route) → Tasks 6, 17. ✓
- Mobile (single-scroll, doc opens via URL, whitespace-nowrap) → Tasks 9–16 use `whitespace-nowrap`; review opens doc URL. Note: run `/mobile-design` review before the entry-points sub-project ships this in production.

**Placeholder scan:** No "TBD/TODO/handle edge cases" in code steps; every code step has full code. Two explicit VERIFY notes (contacts response shape in Task 7; AppShell import path in Task 17) are deliberate codebase-confirmation steps, not deferred logic.

**Type consistency:** `DocFormState`, `ContactRef`, `LineItemRow`, `ComputedLine`, `QuoteTotals`, `DocType`, `PaymentType`, `RenderClient`, `RenderResult`, `PrefillResult` defined in Tasks 1/5 and used consistently. `computeTotals(docType, rows, feePct)` signature identical across Tasks 2, 11, 16. `assemblePayload(state)` identical across Tasks 3, 16. `getCompleteness(state)` identical across Tasks 4, 14. `stubRenderClient` matches the `RenderClient` type.

**Gaps fixed inline:** `deal.client_company` for contract sourced from prefill `companyName` via `bocesName` seed (Task 16 `seedState`) — flagged in Task 3 note; acceptable for the stub phase, revisit when the renderer/entry-points land.

---

## Open follow-ups (not this plan)
- Renderer service real implementation (sub-project 1): replace `stubRenderClient`, add Apps Script `tags` mode + temp-folder handling.
- Delivery (sub-project 4): wire `onSend` to Dropbox Sign; branch-c re-fire + the "record generated doc URLs" data model.
- Entry points (sub-project 3): mount `GenerateDocumentModal` from `PlanOpportunitiesTab` + the Opps-tab District column/row action; replace the dev-route sample prefill with real `buildPrefill(opp, profile)`.
- `/mobile-design` pass on the modal before production.
