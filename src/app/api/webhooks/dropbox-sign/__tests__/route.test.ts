import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const { mockUpdateMany, mockFindUnique, mockRowUpdate, mockFetchPdf, mockUpload } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockRowUpdate: vi.fn(),
  mockFetchPdf: vi.fn(),
  mockUpload: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { updateMany: mockUpdateMany, findUnique: mockFindUnique, update: mockRowUpdate } } }));
vi.mock("@/features/document-generation/lib/dropbox-files", () => ({ fetchExecutedPdf: mockFetchPdf }));
vi.mock("@/features/document-generation/lib/drive-archive", () => ({ uploadExecutedPdf: mockUpload }));

import { POST } from "../route";

const API_KEY = "wh-key";
function eventForm(eventType: string, sigId: string | null, opts: { tamper?: boolean } = {}) {
  const eventTime = "1700000000";
  const hash = createHmac("sha256", API_KEY).update(eventTime + eventType).digest("hex");
  const event = {
    event: { event_time: eventTime, event_type: eventType, event_hash: opts.tamper ? "deadbeef" : hash },
    ...(sigId ? { signature_request: { signature_request_id: sigId } } : {}),
  };
  const form = new FormData();
  form.set("json", JSON.stringify(event));
  return new Request("http://localhost/api/webhooks/dropbox-sign", { method: "POST", body: form });
}

describe("POST /api/webhooks/dropbox-sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DROPBOX_SIGN_API_KEY = API_KEY;
    mockUpdateMany.mockResolvedValue({ count: 1 });
    mockFindUnique.mockResolvedValue(null);
  });

  it("advances status and returns the magic ack string", async () => {
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello API Event Received");
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ signatureRequestId: "sig_1" }),
      data: expect.objectContaining({ status: "signed" }),
    }));
  });

  it("sets signedAt for signed events", async () => {
    await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(mockUpdateMany.mock.calls[0][0].data).toHaveProperty("signedAt");
  });

  it("400s on an invalid HMAC and does not touch the DB", async () => {
    const res = await POST(eventForm("signature_request_sent", "sig_1", { tamper: true }));
    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("acks callback_test without a DB write", async () => {
    const res = await POST(eventForm("callback_test", null));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello API Event Received");
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("acks (200) an unknown signature id without error (updateMany count 0)", async () => {
    mockUpdateMany.mockResolvedValue({ count: 0 });
    const res = await POST(eventForm("signature_request_viewed", "sig_unknown"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello API Event Received");
  });

  it("400s (not 500) on an unparseable json field", async () => {
    const form = new FormData();
    form.set("json", "{not valid json");
    const res = await POST(new Request("http://localhost/api/webhooks/dropbox-sign", { method: "POST", body: form }));
    expect(res.status).toBe(400);
    expect(mockUpdateMany).not.toHaveBeenCalled();
  });

  it("guards terminal statuses from downgrade (where includes notIn)", async () => {
    await POST(eventForm("signature_request_viewed", "sig_1"));
    expect(mockUpdateMany).toHaveBeenCalledWith(expect.objectContaining({
      where: expect.objectContaining({ signatureRequestId: "sig_1", status: { notIn: ["signed", "declined", "canceled"] } }),
    }));
  });

  it("stamps errorMessage with the event type on error events", async () => {
    await POST(eventForm("signature_request_invalid", "sig_1"));
    expect(mockUpdateMany.mock.calls[0][0].data).toMatchObject({
      status: "error",
      errorMessage: "signature_request_invalid",
    });
  });

  it("does not touch errorMessage on non-error transitions", async () => {
    await POST(eventForm("signature_request_viewed", "sig_1"));
    expect(mockUpdateMany.mock.calls[0][0].data).not.toHaveProperty("errorMessage");
  });

  it("archives the executed PDF on all_signed", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme ISD", executedPdfFileId: null });
    mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
    mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalled();
    expect(mockRowUpdate).toHaveBeenCalledWith(expect.objectContaining({
      where: { id: 5 },
      data: { executedPdfUrl: "https://drive/f1", executedPdfFileId: "F1" },
    }));
  });

  it("skips archiving when the row already has an executed file (idempotent across signed events)", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", executedPdfFileId: "F-old" });
    await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(mockFetchPdf).not.toHaveBeenCalled();
  });

  it("still acks when archiving fails", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", executedPdfFileId: null });
    mockFetchPdf.mockRejectedValue(new Error("boom"));
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello API Event Received");
  });

  it("does not archive on non-signed events", async () => {
    await POST(eventForm("signature_request_viewed", "sig_1"));
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("leaves columns untouched when the PDF is not ready yet (null)", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", executedPdfFileId: null });
    mockFetchPdf.mockResolvedValue(null);
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(mockUpload).not.toHaveBeenCalled();
  });
});
