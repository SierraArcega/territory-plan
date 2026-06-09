import { describe, it, expect, vi, beforeEach } from "vitest";
import { sendForSignatureRequest } from "../send-client";

describe("sendForSignatureRequest", () => {
  beforeEach(() => vi.restoreAllMocks());
  it("POSTs payload + districtLeaId to /api/document-generation/send and returns json", async () => {
    const fetchMock = vi.fn().mockResolvedValue({ ok: true, json: async () => ({ status: "sent", signatureRequestId: "sig_1", docUrl: "u" }) });
    vi.stubGlobal("fetch", fetchMock);
    const r = await sendForSignatureRequest({ doc_type: "contract" } as never, "0601234");
    expect(r).toMatchObject({ status: "sent", signatureRequestId: "sig_1" });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/document-generation/send");
    expect(JSON.parse(opts.body)).toEqual({ payload: { doc_type: "contract" }, districtLeaId: "0601234" });
  });
  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500 }));
    await expect(sendForSignatureRequest({ doc_type: "contract" } as never, "x")).rejects.toThrow(/500/);
  });
});
