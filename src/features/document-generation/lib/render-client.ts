import type { RenderClient } from "./payload-types";

/**
 * STUB renderer. The real implementation (sub-project 1) POSTs the payload to
 * the deployed Apps Script and returns the generated Google Doc URL. Until then
 * this returns a deterministic placeholder so the form is independently testable.
 */
export const stubRenderClient: RenderClient = async (payload, opts) => {
  const tagSuffix = opts.tags ? "tagged" : "clean";
  return {
    docUrl: `https://docs.google.com/document/d/STUB-${payload.doc_type}-${tagSuffix}/edit`,
    ...(payload.doc_type === "boces_quote" && payload.sections.boces_agreement
      ? { agreementUrl: "https://drive.google.com/file/d/STUB-AGREEMENT/view" }
      : {}),
  };
};
