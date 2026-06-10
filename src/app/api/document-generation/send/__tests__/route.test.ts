import { describe, it, expect, vi, beforeEach } from "vitest";

const { mockGetUser, mockSend, mockCreate } = vi.hoisted(() => ({
  mockGetUser: vi.fn(),
  mockSend: vi.fn(),
  mockCreate: vi.fn(),
}));

vi.mock("@/lib/supabase/server", () => ({ getUser: mockGetUser }));
vi.mock("@/features/document-generation/lib/render-apps-script", () => ({ sendForSignature: mockSend }));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { create: mockCreate } } }));

import { POST } from "../route";

function req(body: unknown) {
  return new Request("http://localhost/api/document-generation/send", {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body),
  });
}
const CONTRACT = { doc_type: "contract", deal: { client_company: "Acme ISD", client_email: "c@acme.org", signer_email: "s@acme.org" } };

describe("POST /api/document-generation/send", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetUser.mockResolvedValue({ id: "user-uuid" });
    mockSend.mockResolvedValue({ docUrl: "https://docs.google.com/d/D/edit", docId: "D", sent: true, signatureRequestId: "sig_1" });
    mockCreate.mockResolvedValue({ id: 1 });
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
    expect(mockSend).toHaveBeenCalledWith(CONTRACT);
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
});
