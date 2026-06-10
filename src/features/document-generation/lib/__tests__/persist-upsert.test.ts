// Tests for upsertBocesRender (mocked prisma — kept separate from pure persist.test.ts).
import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockFindFirst, mockUpdate, mockCreate } = vi.hoisted(() => ({
  mockFindFirst: vi.fn(),
  mockUpdate: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    generatedDocument: {
      findFirst: mockFindFirst,
      update: mockUpdate,
      create: mockCreate,
    },
  },
}));

import { upsertBocesRender } from "../persist";
import { assemblePayload } from "../payload";
import { emptyFormState } from "../payload-types";
import type { ContactRef } from "../payload-types";

const jane: ContactRef = {
  contactId: 1, salutation: "Ms.", firstName: "Jane", lastName: "Doe",
  title: "CFO", email: "jane@d.org", phone: "555",
};

function makeBocesPayload(quoteNumber: string) {
  const s = emptyFormState("boces_quote", "0601234");
  s.clientContact = jane;
  s.quoteNumber = quoteNumber;
  return assemblePayload(s);
}

const BOCES_PAYLOAD = makeBocesPayload("Q-1042");
const BOCES_NO_QN = makeBocesPayload("");

describe("upsertBocesRender", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFindFirst.mockResolvedValue(null);
    mockCreate.mockResolvedValue({ id: 1 });
    mockUpdate.mockResolvedValue({ id: 9 });
  });

  it("creates a rendered row for a new quote number", async () => {
    mockFindFirst.mockResolvedValue(null);
    await upsertBocesRender({
      payload: BOCES_PAYLOAD,
      docUrl: "https://docs.google.com/document/d/D1/edit",
      docId: "D1",
      districtLeaId: "0601234",
      ownerProfileId: "u1",
    });
    expect(mockCreate).toHaveBeenCalledWith(expect.objectContaining({
      data: expect.objectContaining({
        docType: "boces_quote",
        status: "rendered",
        quoteNumber: "Q-1042",
        ownerProfileId: "u1",
      }),
    }));
  });

  it("updates the existing row on re-render of the same quote number", async () => {
    mockFindFirst.mockResolvedValue({ id: 9 });
    await upsertBocesRender({
      payload: BOCES_PAYLOAD,
      docUrl: "u2",
      docId: "D2",
      districtLeaId: null,
      ownerProfileId: "u1",
    });
    expect(mockCreate).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({ where: { id: 9 } }));
  });

  it("skips silently when quote number is blank", async () => {
    await upsertBocesRender({
      payload: BOCES_NO_QN,
      docUrl: "u",
      docId: "D",
      districtLeaId: null,
      ownerProfileId: "u1",
    });
    expect(mockFindFirst).not.toHaveBeenCalled();
    expect(mockCreate).not.toHaveBeenCalled();
  });
});
