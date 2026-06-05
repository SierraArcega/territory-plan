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

  it("coalesces null opportunity/profile fields to empty strings (numbers pass through as null)", () => {
    const s = buildPrefill(
      { doc_type: "boces_quote" },
      { districtLeaId: null, districtName: null, startDate: null, contractThrough: null, paymentTerms: null, minimumPurchaseAmount: null, maximumBudget: null, netBookingAmount: null },
      { fullName: null, email: null, jobTitle: null },
    );
    expect(s.districtLeaId).toBe("");
    expect(s.companyName).toBe("");
    expect(s.payTerms).toBe("");
    expect(s.minAmt).toBeNull();
    expect(s.bookingReference).toBeNull();
    expect(s.sender).toEqual({ first: "", last: "", title: "", email: "" });
    expect(s.docType).toBe("boces_quote");
  });

  it("handles a single-word sender name (empty last) and multi-word last names", () => {
    const single = buildPrefill({ doc_type: "contract" }, baseOpp(), { fullName: "Cher", email: null, jobTitle: null });
    expect(single.sender).toMatchObject({ first: "Cher", last: "" });
    const multi = buildPrefill({ doc_type: "contract" }, baseOpp(), { fullName: "Maria del Carmen", email: null, jobTitle: null });
    expect(multi.sender).toMatchObject({ first: "Maria", last: "del Carmen" });
  });
});

function baseOpp() {
  return { districtLeaId: "x", districtName: "D", startDate: "a", contractThrough: "b", paymentTerms: "Net 30", minimumPurchaseAmount: null, maximumBudget: null, netBookingAmount: null };
}
