import { describe, it, expect, vi, afterEach } from "vitest";
import { stubRenderClient, appsScriptRenderClient } from "../render-client";
import { assemblePayload } from "../payload";
import { emptyFormState } from "../payload-types";

describe("stubRenderClient", () => {
  it("returns a placeholder doc URL and echoes tag mode", async () => {
    const payload = assemblePayload(emptyFormState("contract", "x"));
    const res = await stubRenderClient(payload, { tags: true });
    expect(res.docUrl).toMatch(/^https:\/\/docs\.google\.com\/document\/d\/STUB/);
  });

  it("encodes doc_type and the tagged/clean suffix in the URL", async () => {
    const payload = assemblePayload(emptyFormState("contract", "x"));
    expect((await stubRenderClient(payload, { tags: true })).docUrl).toBe("https://docs.google.com/document/d/STUB-contract-tagged/edit");
    expect((await stubRenderClient(payload, { tags: false })).docUrl).toBe("https://docs.google.com/document/d/STUB-contract-clean/edit");
  });

  it("includes agreementUrl only for a BOCES quote with the agreement section on", async () => {
    const withAgreement = emptyFormState("boces_quote", "x");
    withAgreement.sections.agreement = true;
    const on = await stubRenderClient(assemblePayload(withAgreement), { tags: true });
    expect(on.agreementUrl).toBe("https://drive.google.com/file/d/STUB-AGREEMENT/view");

    const off = await stubRenderClient(assemblePayload(emptyFormState("boces_quote", "x")), { tags: true });
    expect(off.agreementUrl).toBeUndefined();
  });
});

afterEach(() => vi.restoreAllMocks());

describe("appsScriptRenderClient", () => {
  it("POSTs payload+tags to the render route and returns the result", async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ docUrl: "https://docs.google.com/document/d/REAL/edit" }),
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await appsScriptRenderClient({ doc_type: "contract" } as never, { tags: true });

    expect(result.docUrl).toBe("https://docs.google.com/document/d/REAL/edit");
    const [url, opts] = fetchMock.mock.calls[0];
    expect(url).toBe("/api/document-generation/render");
    expect(JSON.parse(opts.body)).toEqual({ payload: { doc_type: "contract" }, tags: true });
  });

  it("throws on a non-ok response", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue({ ok: false, status: 500, json: async () => ({}) }));
    await expect(appsScriptRenderClient({ doc_type: "contract" } as never, { tags: false })).rejects.toThrow();
  });
});
