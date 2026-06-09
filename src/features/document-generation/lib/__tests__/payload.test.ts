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
    s.companyName = "Barstow USD";
    s.senderFirst = "Rep"; s.senderLast = "Person"; s.senderTitle = "AE"; s.senderEmail = "rep@fm.com";
    // invoiceDate left blank → should render as "time of signing"
    s.billingAddress = "1 Main St";
    s.lineItems = [{ id: "1", sku: "HS", service: "HS", description: "", qty: 2, unit: "hrs", listRate: 85, discountPct: 0 }];
    const p = assemblePayload(s) as Extract<ReturnType<typeof assemblePayload>, { doc_type: "contract" }>;
    expect(p.deal.signer_first).toBe("Jane");
    expect(p.payment.billing_name).toBe("Jane Smith");
    expect(p.payment.billing_add).toBe("1 Main St");
    expect(p.quote.line_items).toHaveLength(1);
    expect(p.quote.order_total).toBe(170);
    expect(p.deal.client_company).toBe("Barstow USD");
    expect(p.deal.sender_first).toBe("Rep");
    expect(p.deal.sender_email).toBe("rep@fm.com");
    expect(p.payment.invoice_date).toBe("time of signing");
  });

  it("uses the entered invoice date when one is set", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = jane;
    s.invoiceDate = "2026-07-15";
    const p = assemblePayload(s);
    expect(p.payment.invoice_date).toBe("2026-07-15");
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

describe("assemblePayload — count field", () => {
  it("propagates count:3 into contract line items and exposes billable_days", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = jane;
    s.lineItems = [{ id: "1", sku: "HS", service: "HS SpEd", description: "", count: 3, qty: 5, unit: "Day", listRate: 100, discountPct: 0 }];
    const p = assemblePayload(s) as Extract<ReturnType<typeof assemblePayload>, { doc_type: "contract" }>;
    expect(p.quote.line_items[0]).toMatchObject(expect.objectContaining({ count: 3 }));
    expect(typeof p.quote.billable_days).toBe("number");
  });
});

describe("assemblePayload — adjustments", () => {
  it("filters out blank/zero adjustments and emits savings + gross_subtotal", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = jane;
    s.lineItems = [{ id: "1", sku: "S", service: "S", description: "", qty: 1, unit: "Day", listRate: 100, discountPct: 0 }];
    s.adjustments = [
      { id: "1", label: "Early Signing", type: "discount", mode: "percent", value: 10 },
      { id: "2", label: "", type: "fee", mode: "amount", value: 0 },
    ];
    const p = assemblePayload(s) as Extract<ReturnType<typeof assemblePayload>, { doc_type: "contract" }>;
    expect(p.quote.adjustments).toHaveLength(1);
    expect(p.quote.adjustments[0].label).toBe("Early Signing");
    expect(typeof p.quote.savings).toBe("number");
    expect(typeof p.quote.gross_subtotal).toBe("number");
  });
});

describe("assemblePayload — BOCES order_total", () => {
  it("forwards the computed order_total on the BOCES quote payload", () => {
    const state = emptyFormState("boces_quote", "0600001");
    state.companyName = "Test BOCES";
    state.feePct = 10;
    state.lineItems = [
      { id: "r1", count: 2, sku: "BOC27-1", service: "Tutoring", description: "",
        qty: 10, unit: "Hour", listRate: 100, discountPct: 0 },
    ];
    const payload = assemblePayload(state);
    if (payload.doc_type !== "boces_quote") throw new Error("expected boces_quote");
    // subtotal = 2 * 10 * 100 = 2000; fee 10% = 200; order_total = 2200
    expect(payload.quote.order_total).toBe(2200);
  });
});

describe("assemblePayload — BOCES unit forwarding", () => {
  it("forwards unit from line item into boces quote line_items", () => {
    const state = emptyFormState("boces_quote", "0600001");
    state.companyName = "Test BOCES";
    state.feePct = 10;
    state.lineItems = [
      { id: "r1", count: 2, sku: "BOC27-1", service: "Tutoring", description: "",
        qty: 10, unit: "Hour", listRate: 100, discountPct: 0 },
    ];
    const payload = assemblePayload(state);
    if (payload.doc_type !== "boces_quote") throw new Error("expected boces_quote");
    expect(payload.quote.line_items[0].unit).toBe("Hour");
  });

  it("defaults to empty string when unit is absent from line item", () => {
    const state = emptyFormState("boces_quote", "0600001");
    state.companyName = "Test BOCES";
    state.feePct = 10;
    // unit intentionally omitted to test fallback
    state.lineItems = [
      { id: "r2", count: 1, sku: "BOC27-2", service: "Homebound", description: "",
        qty: 5, unit: "" as unknown as string, listRate: 80, discountPct: 0 },
    ];
    const payload = assemblePayload(state);
    if (payload.doc_type !== "boces_quote") throw new Error("expected boces_quote");
    expect(payload.quote.line_items[0].unit).toBe("");
  });
});
