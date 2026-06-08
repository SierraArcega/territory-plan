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
  it("defaults signer/billing to 'same as client' and all section toggles off", () => {
    const s = emptyFormState("contract", "x");
    expect(s.signerSameAsClient).toBe(true);
    expect(s.billingSameAsClient).toBe(true);
    expect(s.sections.sowType).toBeNull();
    expect(Object.values(s.sections).every((v) => v === false || v === null)).toBe(true);
  });
});
