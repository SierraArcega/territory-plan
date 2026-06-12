import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const { mockUpdateMany, mockFindUnique, mockRowUpdate, mockFetchPdf, mockUpload, mockDeletePdf, mockSlackPost } = vi.hoisted(() => ({
  mockUpdateMany: vi.fn(),
  mockFindUnique: vi.fn(),
  mockRowUpdate: vi.fn(),
  mockFetchPdf: vi.fn(),
  mockUpload: vi.fn(),
  mockDeletePdf: vi.fn(),
  mockSlackPost: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { updateMany: mockUpdateMany, findUnique: mockFindUnique, update: mockRowUpdate } } }));
vi.mock("@/features/document-generation/lib/dropbox-files", () => ({ fetchExecutedPdf: mockFetchPdf }));
vi.mock("@/features/document-generation/lib/drive-archive", () => ({ uploadExecutedPdf: mockUpload, deleteExecutedPdf: mockDeletePdf }));
vi.mock("@/features/document-generation/lib/slack-notify", () => ({ postExecutedAgreement: mockSlackPost }));

import { POST } from "../route";

const API_KEY = "wh-key";
function eventForm(eventType: string, sigId: string | null, opts: { tamper?: boolean; testMode?: boolean } = {}) {
  const eventTime = "1700000000";
  const hash = createHmac("sha256", API_KEY).update(eventTime + eventType).digest("hex");
  const event = {
    event: { event_time: eventTime, event_type: eventType, event_hash: opts.tamper ? "deadbeef" : hash },
    ...(sigId
      ? { signature_request: { signature_request_id: sigId, ...(opts.testMode ? { test_mode: true } : {}) } }
      : {}),
  };
  const form = new FormData();
  form.set("json", JSON.stringify(event));
  return new Request("http://localhost/api/webhooks/dropbox-sign", { method: "POST", body: form });
}

function signedRow() {
  mockFindUnique.mockResolvedValue({
    id: 5, companyName: "Acme ISD", schoolYear: "2026 - 2027",
    orderTotal: { toString: () => "20211.18" }, // Prisma Decimal duck-type; Number() coerces via toString
    payload: { deal: { sender_first: "Aston", sender_last: "Arcega" } },
    executedPdfFileId: null,
  });
  mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
  mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
}

describe("POST /api/webhooks/dropbox-sign", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.DROPBOX_SIGN_API_KEY = API_KEY;
    // status-transition call: where has signatureRequestId; claim call: where has executedPdfFileId: null
    mockUpdateMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
      if ("executedPdfFileId" in (args.where ?? {})) {
        // claim call — default to winning
        return Promise.resolve({ count: 1 });
      }
      // status-transition call
      return Promise.resolve({ count: 1 });
    });
    mockFindUnique.mockResolvedValue(null);
    mockDeletePdf.mockResolvedValue(undefined);
    mockSlackPost.mockResolvedValue(undefined);
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

  it("archives the executed PDF on all_signed (claim won — updateMany with id + executedPdfFileId: null)", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme ISD", schoolYear: null, orderTotal: null, payload: null, executedPdfFileId: null });
    mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
    mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalled();
    // NEW: stamp via updateMany (atomic claim), not update
    const claimCall = mockUpdateMany.mock.calls.find(
      (c) => c[0]?.where?.executedPdfFileId === null,
    );
    expect(claimCall).toBeDefined();
    expect(claimCall![0]).toMatchObject({
      where: { id: 5, executedPdfFileId: null },
      data: { executedPdfUrl: "https://drive/f1", executedPdfFileId: "F1" },
    });
    // OLD update() must NOT be called
    expect(mockRowUpdate).not.toHaveBeenCalled();
  });

  it("skips archiving when the row already has an executed file (idempotent across signed events)", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", schoolYear: null, orderTotal: null, payload: null, executedPdfFileId: "F-old" });
    await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(mockFetchPdf).not.toHaveBeenCalled();
  });

  it("still acks when archiving fails", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", schoolYear: null, orderTotal: null, payload: null, executedPdfFileId: null });
    mockFetchPdf.mockRejectedValue(new Error("boom"));
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello API Event Received");
    expect(mockSlackPost).not.toHaveBeenCalled();
  });

  it("does not archive on non-signed events", async () => {
    await POST(eventForm("signature_request_viewed", "sig_1"));
    expect(mockFindUnique).not.toHaveBeenCalled();
  });

  it("retries the archive when the downloadable event lands after a not-ready first attempt", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", schoolYear: null, orderTotal: null, payload: null, executedPdfFileId: null });
    mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
    mockUpload.mockResolvedValue({ fileId: "F2", url: "https://drive/f2" });
    const res = await POST(eventForm("signature_request_downloadable", "sig_1"));
    expect(res.status).toBe(200);
    expect(mockUpload).toHaveBeenCalled();
  });

  it("leaves columns untouched when the PDF is not ready yet (null)", async () => {
    mockFindUnique.mockResolvedValue({ id: 5, companyName: "Acme", schoolYear: null, orderTotal: null, payload: null, executedPdfFileId: null });
    mockFetchPdf.mockResolvedValue(null);
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(mockUpload).not.toHaveBeenCalled();
  });

  it("names the archived PDF with the SP6 convention", async () => {
    mockFindUnique.mockResolvedValue({
      id: 5, companyName: "Acme ISD", schoolYear: "2026 - 2027",
      orderTotal: null, payload: null, executedPdfFileId: null,
    });
    mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
    mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
    await POST(eventForm("signature_request_all_signed", "sig_12345678"));
    const name = mockUpload.mock.calls[0][1] as string;
    expect(name).toMatch(/^SY26-27 — Acme ISD — Contract — signed \d{4}-\d{2}-\d{2} \(sig_1234\)\.pdf$/);
  });

  it("posts the executed agreement to Slack after archiving", async () => {
    signedRow();
    await POST(eventForm("signature_request_all_signed", "sig_12345678"));
    expect(mockSlackPost).toHaveBeenCalledTimes(1);
    const notice = mockSlackPost.mock.calls[0][0];
    expect(notice.companyName).toBe("Acme ISD");
    expect(notice.orderTotal).toBeCloseTo(20211.18);
    expect(notice.schoolYearShort).toBe("SY26-27");
    expect(notice.repName).toBe("Aston Arcega");
    expect(notice.driveUrl).toBe("https://drive/f1");
    expect(notice.filename).toMatch(/^SY26-27 — Acme ISD — Contract — signed/);
  });

  it("skips Slack entirely for test-mode signings (still archives)", async () => {
    signedRow();
    await POST(eventForm("signature_request_all_signed", "sig_1", { testMode: true }));
    expect(mockUpload).toHaveBeenCalled();
    expect(mockSlackPost).not.toHaveBeenCalled();
  });

  it("still acks and the claim stamp happened when Slack throws", async () => {
    signedRow();
    mockSlackPost.mockRejectedValue(new Error("slack down"));
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(await res.text()).toBe("Hello API Event Received");
    // archive stamp (claim) happened before Slack
    const claimCall = mockUpdateMany.mock.calls.find(
      (c) => c[0]?.where?.executedPdfFileId === null,
    );
    expect(claimCall).toBeDefined();
  });

  it("posts to Slack with a null Drive link when the Drive upload fails", async () => {
    signedRow();
    mockUpload.mockRejectedValue(new Error("drive down"));
    const res = await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(res.status).toBe(200);
    expect(mockSlackPost).toHaveBeenCalledTimes(1);
    expect(mockSlackPost.mock.calls[0][0].driveUrl).toBeNull();
  });

  it("does not post to Slack on non-signed events", async () => {
    await POST(eventForm("signature_request_viewed", "sig_1"));
    expect(mockSlackPost).not.toHaveBeenCalled();
  });

  it("does not post to Slack when the PDF is not ready", async () => {
    signedRow();
    mockFetchPdf.mockResolvedValue(null);
    await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(mockSlackPost).not.toHaveBeenCalled();
  });

  // ── Atomic-claim tests ────────────────────────────────────────────────────

  it("claim won (count 1) → Slack posted once with drive url", async () => {
    signedRow();
    // override: claim updateMany returns count:1 (default), status-transition also returns count:1
    const res = await POST(eventForm("signature_request_all_signed", "sig_12345678"));
    expect(res.status).toBe(200);
    // Verify the claim was attempted with correct where shape
    const claimCall = mockUpdateMany.mock.calls.find(
      (c) => c[0]?.where?.executedPdfFileId === null,
    );
    expect(claimCall).toBeDefined();
    expect(claimCall![0].where).toMatchObject({ id: 5, executedPdfFileId: null });
    // Slack was posted exactly once with the drive url
    expect(mockSlackPost).toHaveBeenCalledTimes(1);
    expect(mockSlackPost.mock.calls[0][0].driveUrl).toBe("https://drive/f1");
    // No duplicate Drive file to clean up
    expect(mockDeletePdf).not.toHaveBeenCalled();
  });

  it("claim lost (count 0) → no Slack, duplicate Drive file deleted", async () => {
    signedRow();
    // Override updateMany: claim call returns count:0 (lost), status-transition returns count:1
    mockUpdateMany.mockImplementation((args: { where?: Record<string, unknown> }) => {
      if ("executedPdfFileId" in (args.where ?? {})) {
        return Promise.resolve({ count: 0 }); // lost the race
      }
      return Promise.resolve({ count: 1 });
    });
    const res = await POST(eventForm("signature_request_all_signed", "sig_12345678"));
    expect(res.status).toBe(200);
    // Slack must NOT be called
    expect(mockSlackPost).not.toHaveBeenCalled();
    // Duplicate Drive file must be deleted
    expect(mockDeletePdf).toHaveBeenCalledWith("F1");
  });

  it("archive failed → Slack still posts with null driveUrl (no claim attempted)", async () => {
    signedRow();
    mockUpload.mockRejectedValue(new Error("drive down"));
    const res = await POST(eventForm("signature_request_all_signed", "sig_12345678"));
    expect(res.status).toBe(200);
    // No claim attempted when upload failed
    const claimCall = mockUpdateMany.mock.calls.find(
      (c) => c[0]?.where?.executedPdfFileId === null,
    );
    expect(claimCall).toBeUndefined();
    // Slack still posts with null driveUrl
    expect(mockSlackPost).toHaveBeenCalledTimes(1);
    expect(mockSlackPost.mock.calls[0][0].driveUrl).toBeNull();
  });

  it("posts with null total/SY/rep for pre-SP5 rows (null payload, no school year)", async () => {
    mockFindUnique.mockResolvedValue({
      id: 2, companyName: "Acme ISD", schoolYear: null,
      orderTotal: null, payload: null, executedPdfFileId: null,
    });
    mockFetchPdf.mockResolvedValue(Buffer.from("%PDF"));
    mockUpload.mockResolvedValue({ fileId: "F1", url: "https://drive/f1" });
    await POST(eventForm("signature_request_all_signed", "sig_1"));
    expect(mockSlackPost).toHaveBeenCalledTimes(1);
    const notice = mockSlackPost.mock.calls[0][0];
    expect(notice.orderTotal).toBeNull();
    expect(notice.schoolYearShort).toBeNull();
    expect(notice.repName).toBeNull();
    expect(notice.filename).toMatch(/^Acme ISD — Contract — signed/);
  });
});
