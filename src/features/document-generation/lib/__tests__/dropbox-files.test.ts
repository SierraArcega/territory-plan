import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { fetchExecutedPdf } from "../dropbox-files";

describe("fetchExecutedPdf", () => {
  const realFetch = global.fetch;
  beforeEach(() => { process.env.DROPBOX_SIGN_API_KEY = "k"; });
  afterEach(() => { global.fetch = realFetch; });

  it("returns the PDF buffer on 200", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response(Buffer.from("%PDF-1.7"), { status: 200 }));
    const buf = await fetchExecutedPdf("sig_1");
    expect(buf?.subarray(0, 4).toString()).toBe("%PDF");
    expect(global.fetch).toHaveBeenCalledWith(
      "https://api.hellosign.com/v3/signature_request/files/sig_1?file_type=pdf",
      expect.objectContaining({ headers: expect.objectContaining({ Authorization: expect.stringContaining("Basic ") }) }),
    );
  });
  it("returns null when the file is not ready yet (409)", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("conflict", { status: 409 }));
    expect(await fetchExecutedPdf("sig_1")).toBeNull();
  });
  it("throws on other failures", async () => {
    global.fetch = vi.fn().mockResolvedValue(new Response("nope", { status: 500 }));
    await expect(fetchExecutedPdf("sig_1")).rejects.toThrow(/500/);
  });
});
