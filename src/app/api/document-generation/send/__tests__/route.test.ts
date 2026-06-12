import { describe, it, expect, vi, beforeEach } from "vitest";
import { DROPBOX_SIGN_TEST_MODE_KEY } from "@/features/shared/lib/app-setting-keys";

vi.mock("server-only", () => ({}));

const { mockGetUser, mockSend, mockCreate, mockFindUnique } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSend: vi.fn(),
  mockCreate: vi.fn(),
  mockFindUnique: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mockGetUser }));
vi.mock("@/features/document-generation/lib/render-apps-script", () => ({ sendForSignature: mockSend }));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { create: mockCreate }, appSetting: { findUnique: mockFindUnique } } }));

import { POST } from "../route";

function req(body: unknown) {
  return new Request("http://localhost/api/document-generation/send", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
const CONTRACT = {
  doc_type: "contract",
  deal: { client_company: "Acme ISD", client_email: "c@acme.org", signer_email: "s@acme.org" },
  quote: { order_total: 5869, include: true, show_pricing: true, line_items: [], min_amt: null, max_amt: null, billable_days: 0, billable_hours: 0, adjustments: [], savings: 0, gross_subtotal: 0 },
  payment: { type: "A" },
  sections: {},
} as const;

describe("POST /api/document-generation/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-uuid" });
    mockSend.mockResolvedValue({ docUrl: "https://docs.google.com/d/D/edit", docId: "D", sent: true, signatureRequestId: "sig_1" });
    mockCreate.mockResolvedValue({ id: 1 });
    mockFindUnique.mockResolvedValue(null);
  });

  it("401s when unauthenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await POST(req({ payload: CONTRACT }));
    expect(res.status).toBe(401);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("400s for a boces_quote payload (no eSign)", async () => {
    const res = await POST(req({ payload: { doc_type: "boces_quote", deal: {} } }));
    expect(res.status).toBe(400);
    expect(mockSend).not.toHaveBeenCalled();
  });

  it("writes the row as processing on synchronous accept", async () => {
    const res = await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(CONTRACT, { testMode: true });
    expect(mockCreate.mock.calls[0][0].data.status).toBe("processing");
    expect(mockCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "processing", signatureRequestId: "sig_1", recipientEmail: "s@acme.org",
      companyName: "Acme ISD", districtLeaId: "0601234", ownerProfileId: "user-uuid", docId: "D",
    }) });
    const body = await res.json();
    expect(body.status).toBe("processing");
    expect(body.id).toBe(1);
    expect(body.signatureRequestId).toBe("sig_1");
    expect(body.recipientEmail).toBe("s@acme.org");
    expect(body.docUrl).toBe("https://docs.google.com/d/D/edit");
  });

  it("writes an 'error' row (no signatureRequestId) when the script could not send", async () => {
    mockSend.mockResolvedValue({ docUrl: "u", docId: "D", sent: false, sendError: "domain not allowed" });
    const res = await POST(req({ payload: CONTRACT }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({ data: expect.objectContaining({
      status: "error", errorMessage: "domain not allowed", signatureRequestId: null,
    }) });
    expect(await res.json()).toMatchObject({ status: "error" });
  });

  it("falls back to client_email when signer_email is absent", async () => {
    const res = await POST(req({ payload: { doc_type: "contract", deal: { client_company: "X", client_email: "c@x.org" } } }));
    expect(res.status).toBe(200);
    expect(mockCreate).toHaveBeenCalledWith({ data: expect.objectContaining({ recipientEmail: "c@x.org" }) });
  });

  it("500s when the send throws", async () => {
    mockSend.mockRejectedValue(new Error("renderer exploded"));
    const res = await POST(req({ payload: CONTRACT }));
    expect(res.status).toBe(500);
  });

  it("persists the payload and promoted report columns", async () => {
    await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
    const data = mockCreate.mock.calls[0][0].data;
    expect(data.payload).toEqual(CONTRACT);
    expect(data.orderTotal).toBe(CONTRACT.quote.order_total);
    expect(data.paymentType).toBe(CONTRACT.payment.type);
  });

  it("passes testMode false when the setting is live", async () => {
    mockFindUnique.mockResolvedValue({ key: DROPBOX_SIGN_TEST_MODE_KEY, value: false });
    const res = await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
    expect(res.status).toBe(200);
    expect(mockSend).toHaveBeenCalledWith(CONTRACT, { testMode: false });
  });

  it("passes testMode true when no setting row exists", async () => {
    mockFindUnique.mockResolvedValue(null);
    await POST(req({ payload: CONTRACT, districtLeaId: "0601234" }));
    expect(mockSend).toHaveBeenCalledWith(CONTRACT, { testMode: true });
  });
});
