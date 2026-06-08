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
  it("is incomplete when line items total $0 (zero qty/rate)", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = c; s.billingAddress = "1 Main"; s.startDate = "a"; s.endDate = "b";
    s.lineItems = [{ id: "1", sku: null, service: "S", description: "", qty: 0, unit: "Day", listRate: 100, discountPct: 0 }];
    const r = getCompleteness(s);
    expect(r.isComplete).toBe(false);
    expect(r.missing).toContain("Line items must total more than $0");
  });
  it("requires a signer contact only when signer is not the same as client", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = c; s.billingAddress = "1"; s.startDate = "a"; s.endDate = "b";
    s.lineItems = [{ id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }];
    expect(getCompleteness(s).missing).not.toContain("Signer contact");
    s.signerSameAsClient = false; // now an explicit signer is required
    expect(getCompleteness(s).missing).toContain("Signer contact");
  });
  it("requires a billing contact only when billing is not the same as client", () => {
    const s = emptyFormState("contract", "x");
    s.clientContact = c; s.billingAddress = "1"; s.startDate = "a"; s.endDate = "b";
    s.lineItems = [{ id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }];
    s.billingSameAsClient = false;
    expect(getCompleteness(s).missing).toContain("Billing contact");
  });
  it("boces additionally requires a quote number", () => {
    const s = emptyFormState("boces_quote", "x");
    s.clientContact = c; s.billingAddress = "1"; s.startDate = "a"; s.endDate = "b";
    s.lineItems = [{ id: "1", sku: "B", service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }];
    expect(getCompleteness(s).missing).toContain("Quote number");
  });
});
