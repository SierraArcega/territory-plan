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
    s.invoiceDate = "time of signing";
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
