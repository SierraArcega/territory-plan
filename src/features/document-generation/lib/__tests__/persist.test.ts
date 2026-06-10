// src/features/document-generation/lib/__tests__/persist.test.ts
import { describe, it, expect } from "vitest";
import { promotedFields } from "../persist";
import { assemblePayload } from "../payload";
import { emptyFormState } from "../payload-types";
import type { ContactRef } from "../payload-types";

// Mirror the jane fixture from payload.test.ts (ContactRef requires contactId).
const jane: ContactRef = {
  contactId: 1, salutation: "Ms.", firstName: "Jane", lastName: "Doe",
  title: "CFO", email: "jane@d.org", phone: "555",
};

describe("promotedFields", () => {
  it("extracts report columns from a contract payload", () => {
    const s = emptyFormState("contract", "0601234");
    s.clientContact = jane;
    s.paymentType = "A";
    s.schoolYear = "2026 - 2027";
    s.startDate = "2026-07-01";
    s.endDate = "2027-06-30";
    const p = assemblePayload(s);
    const f = promotedFields(p);
    expect(f.paymentType).toBe("A");
    expect(f.schoolYear).toBe("2026 - 2027");
    expect(f.startDate?.toISOString()).toContain("2026-07-01");
    expect(f.endDate?.toISOString()).toContain("2027-06-30");
    expect(f.orderTotal).toBe(0); // empty line items
    expect(f.quoteNumber).toBeNull(); // contracts have no quote number
  });
  it("extracts quote number + total from a boces payload, nulls blank dates", () => {
    const s = emptyFormState("boces_quote", "0601234");
    s.clientContact = jane;
    s.quoteNumber = "Q-1042";
    s.startDate = "";
    s.endDate = "";
    const p = assemblePayload(s);
    const f = promotedFields(p);
    expect(f.quoteNumber).toBe("Q-1042");
    expect(f.startDate).toBeNull();
    expect(f.schoolYear).toBeNull(); // BOCES has no school year
  });
});
