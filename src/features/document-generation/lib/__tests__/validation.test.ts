import { describe, it, expect } from "vitest";
import { parseCcEmails, getCompleteness } from "../validation";
import { emptyFormState } from "../payload-types";
import type { ContactRef } from "../payload-types";

const c: ContactRef = { contactId: 1, salutation: null, firstName: "A", lastName: "B", title: "T", email: "a@b.c", phone: "1" };

/** Build a fully-populated contract state, optionally overriding fields. */
function completeContractState(overrides: Partial<typeof emptyFormState extends (...a: never[]) => infer R ? R : never> = {}) {
  const s = emptyFormState("contract", "x");
  s.clientContact = c;
  s.billingAddress = "1 Main";
  s.startDate = "07/01/26";
  s.endDate = "06/30/27";
  s.minAmt = 10000;
  s.maxAmt = 50000;
  s.lineItems = [{ id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }];
  return { ...s, ...overrides };
}

describe("getCompleteness", () => {
  it("flags missing contact, billing address, line items, dates", () => {
    const r = getCompleteness(emptyFormState("contract", "x"));
    expect(r.isComplete).toBe(false);
    expect(r.missing).toEqual(expect.arrayContaining(["Client contact", "Billing address", "At least one line item", "Start date", "End date"]));
  });
  it("is complete when required fields present", () => {
    const r = getCompleteness(completeContractState());
    expect(r.isComplete).toBe(true);
    expect(r.missing).toEqual([]);
  });
  it("requires min and max amounts when the table is included", () => {
    const r = getCompleteness(completeContractState({ minAmt: null, maxAmt: null }));
    expect(r.missing).toContain("Minimum purchase amount");
    expect(r.missing).toContain("Maximum district budget");
    expect(r.isComplete).toBe(false);
  });
  it("does not require the amounts when the table is excluded", () => {
    const r = getCompleteness(
      completeContractState({ includeMinMax: false, minAmt: null, maxAmt: null }),
    );
    expect(r.missing).not.toContain("Minimum purchase amount");
    expect(r.missing).not.toContain("Maximum district budget");
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

describe("getCompleteness — schoolYear", () => {
  it("requires a non-empty school year for contracts", () => {
    const s = emptyFormState("contract", "0601234");
    s.schoolYear = "";
    expect(getCompleteness(s).missing).toContain("School year");
  });
  it("does not require school year for BOCES quotes", () => {
    const s = emptyFormState("boces_quote", "0601234");
    s.schoolYear = "";
    expect(getCompleteness(s).missing).not.toContain("School year");
  });
});

describe("parseCcEmails", () => {
  it("splits on commas and semicolons, trims, drops empties", () => {
    expect(parseCcEmails(" a@x.com, b@y.org ;; c@z.io ,")).toEqual(["a@x.com", "b@y.org", "c@z.io"]);
  });
  it("dedupes case-insensitively, keeping first casing", () => {
    expect(parseCcEmails("AP@x.com, ap@x.com")).toEqual(["AP@x.com"]);
  });
  it("returns [] for empty/whitespace input", () => {
    expect(parseCcEmails("")).toEqual([]);
    expect(parseCcEmails("  ")).toEqual([]);
  });
  it("drops whitespace-only tokens between separators", () => {
    expect(parseCcEmails("a@x.com,   ,b@y.com")).toEqual(["a@x.com", "b@y.com"]);
  });
});

describe("getCompleteness — ccEmails", () => {
  it("flags invalid CC tokens", () => {
    const s = emptyFormState("contract", "0601234");
    s.ccEmails = "good@x.com, not-an-email";
    const { missing } = getCompleteness(s);
    expect(missing).toContain("Invalid CC email: not-an-email");
    expect(missing).not.toContain("Invalid CC email: good@x.com");
  });
  it("accepts an empty ccEmails field", () => {
    const s = emptyFormState("contract", "0601234");
    s.ccEmails = "";
    expect(getCompleteness(s).missing.filter((m) => m.startsWith("Invalid CC"))).toEqual([]);
  });
  it("ignores invalid CC tokens for BOCES quotes (field is hidden)", () => {
    const s = emptyFormState("boces_quote", "0601234");
    s.ccEmails = "not-an-email";
    expect(getCompleteness(s).missing.filter((m) => m.startsWith("Invalid CC"))).toEqual([]);
  });
});
