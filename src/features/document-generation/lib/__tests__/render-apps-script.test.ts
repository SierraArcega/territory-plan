import { describe, it, expect, vi, beforeEach } from "vitest";

// render-apps-script imports "server-only"; stub it so the test can import the module.
vi.mock("server-only", () => ({}));

const getAccessToken = vi.fn();
vi.mock("googleapis", () => ({
  google: { auth: { JWT: vi.fn().mockImplementation(() => ({ getAccessToken })) } },
}));

import { renderViaAppsScript } from "../render-apps-script";

describe("renderViaAppsScript", () => {
  beforeEach(() => {
    // clearAllMocks resets call history without wiping mock implementations.
    // restoreAllMocks would clear the JWT constructor's .mockImplementation,
    // breaking the factory-mock closure on every test after the first.
    vi.clearAllMocks();
    getAccessToken.mockResolvedValue({ token: "tok-123" });
    process.env.GOOGLE_DOC_RENDER_URL = "https://script.google.com/x/exec";
    process.env.GOOGLE_DOC_RENDER_SA_EMAIL = "sa@proj.iam.gserviceaccount.com";
    process.env.GOOGLE_DOC_RENDER_SA_KEY = "-----KEY-----";
    process.env.GOOGLE_DOC_RENDER_SUBJECT = "rep@fullmindlearning.com";
  });

  it("POSTs payload+tags with a bearer token and maps url→docUrl", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "https://docs.google.com/document/d/REAL/edit", docId: "REAL" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await renderViaAppsScript({ doc_type: "contract" } as never, false);

    expect(result).toEqual({ docUrl: "https://docs.google.com/document/d/REAL/edit" });
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("https://script.google.com/x/exec");
    expect(opts.headers.Authorization).toBe("Bearer tok-123");
    expect(JSON.parse(opts.body)).toMatchObject({ doc_type: "contract", tags: false });
  });

  it("passes through agreementUrl when present", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "u", agreementUrl: "a" }),
    }));
    const r = await renderViaAppsScript({ doc_type: "boces_quote" } as never, true);
    expect(r).toEqual({ docUrl: "u", agreementUrl: "a" });
  });

  it("throws when the script reports success:false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: false, error: "boom" }),
    }));
    await expect(renderViaAppsScript({ doc_type: "contract" } as never, true)).rejects.toThrow(/boom/);
  });

  it("throws when the HTTP response is not ok", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(renderViaAppsScript({ doc_type: "contract" } as never, false)).rejects.toThrow(/500/);
  });
});
