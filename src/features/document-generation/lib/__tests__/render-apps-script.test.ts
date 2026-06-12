import { describe, it, expect, vi, beforeEach } from "vitest";

// render-apps-script imports "server-only"; stub it so the test can import the module.
vi.mock("server-only", () => ({}));

// vi.mock factories are hoisted to the top of the file, so module-scope `const`
// declarations are not yet initialised when the factory runs. Use vi.hoisted()
// to create the mocks before hoisting so they're available inside the factory.
const { getAccessToken, MockJWT } = vi.hoisted(() => {
  const getAccessToken = vi.fn();
  const MockJWT = vi.fn().mockImplementation(() => ({ getAccessToken }));
  return { getAccessToken, MockJWT };
});

vi.mock("googleapis", () => ({
  google: { auth: { JWT: MockJWT } },
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
    // Ensure KEY_FILE doesn't leak between tests.
    delete process.env.GOOGLE_DOC_RENDER_KEY_FILE;
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

  it("uses keyFile when GOOGLE_DOC_RENDER_KEY_FILE is set", async () => {
    process.env.GOOGLE_DOC_RENDER_KEY_FILE = "/tmp/key.json";
    delete process.env.GOOGLE_DOC_RENDER_SA_EMAIL;
    delete process.env.GOOGLE_DOC_RENDER_SA_KEY;
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "https://docs.google.com/d/1/edit" }),
    }));

    await renderViaAppsScript({ doc_type: "contract" } as never, false);

    expect(MockJWT).toHaveBeenCalledOnce();
    const [opts] = MockJWT.mock.calls[0];
    expect(opts).toMatchObject({
      keyFile: "/tmp/key.json",
      subject: "rep@fullmindlearning.com",
      scopes: expect.arrayContaining(["https://www.googleapis.com/auth/drive"]),
    });
    expect(opts).not.toHaveProperty("email");
    expect(opts).not.toHaveProperty("key");
  });

  it("falls back to email+key when GOOGLE_DOC_RENDER_KEY_FILE is absent", async () => {
    // KEY_FILE already deleted in beforeEach; SA_EMAIL/SA_KEY are set.
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "https://docs.google.com/d/2/edit" }),
    }));

    await renderViaAppsScript({ doc_type: "boces_quote" } as never, true);

    expect(MockJWT).toHaveBeenCalledOnce();
    const [opts] = MockJWT.mock.calls[0];
    expect(opts).toMatchObject({
      email: "sa@proj.iam.gserviceaccount.com",
      key: "-----KEY-----",
      subject: "rep@fullmindlearning.com",
      scopes: expect.arrayContaining(["https://www.googleapis.com/auth/drive"]),
    });
    expect(opts).not.toHaveProperty("keyFile");
  });

  it("strips client-smuggled send directives (auto_send/test_mode)", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "https://docs.google.com/document/d/D/edit" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await renderViaAppsScript({ doc_type: "contract", auto_send: true, test_mode: "0" } as never, false);

    const sent = JSON.parse(fetchMock.mock.calls[0][1].body);
    expect(sent.auto_send).toBe(false);
    expect(sent).not.toHaveProperty("test_mode");
  });
});

import { sendForSignature } from "../render-apps-script";

describe("sendForSignature", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    getAccessToken.mockResolvedValue({ token: "tok-123" });
    process.env.GOOGLE_DOC_RENDER_URL = "https://script.google.com/x/exec";
    process.env.GOOGLE_DOC_RENDER_SA_EMAIL = "sa@proj.iam.gserviceaccount.com";
    process.env.GOOGLE_DOC_RENDER_SA_KEY = "-----KEY-----";
    process.env.GOOGLE_DOC_RENDER_SUBJECT = "rep@fullmindlearning.com";
    delete process.env.GOOGLE_DOC_RENDER_KEY_FILE;
  });

  it("POSTs tags:true + auto_send:true and returns the send result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "https://docs.google.com/document/d/D/edit", docId: "D", sent: true, signatureRequestId: "sig_123" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await sendForSignature({ doc_type: "contract" } as never, { testMode: true });

    expect(result).toEqual({ docUrl: "https://docs.google.com/document/d/D/edit", docId: "D", sent: true, signatureRequestId: "sig_123", sendError: undefined });
    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ doc_type: "contract", tags: true, auto_send: true, test_mode: "1" });
  });

  it("POSTs test_mode '0' when live", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "u", docId: "D", sent: true, signatureRequestId: "s" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    await sendForSignature({ doc_type: "contract" } as never, { testMode: false });

    expect(JSON.parse(fetchMock.mock.calls[0][1].body)).toMatchObject({ test_mode: "0" });
  });

  it("returns sent:false + sendError when the script could not send", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200,
      json: async () => ({ success: true, url: "u", docId: "D", sent: false, sendError: "domain not allowed" }),
    }));
    const r = await sendForSignature({ doc_type: "contract" } as never, { testMode: true });
    expect(r).toMatchObject({ docUrl: "u", sent: false, sendError: "domain not allowed" });
  });

  it("throws when the script reports success:false", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({
      ok: true, status: 200, json: async () => ({ success: false, error: "render boom" }),
    }));
    await expect(sendForSignature({ doc_type: "contract" } as never, { testMode: true })).rejects.toThrow(/render boom/);
  });
});
