import { describe, it, expect } from "vitest";
import { stubRenderClient } from "../render-client";
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
