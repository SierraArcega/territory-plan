import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHmac } from "node:crypto";

const { mockUpdateMany } = vi.hoisted(() => ({ mockUpdateMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ default: { generatedDocument: { updateMany: mockUpdateMany } } }));

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
});
