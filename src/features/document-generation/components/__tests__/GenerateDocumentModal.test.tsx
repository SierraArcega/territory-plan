import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import GenerateDocumentModal from "../GenerateDocumentModal";

vi.mock("../form/ContactRolePicker", () => ({ default: () => <div>picker</div> }));
vi.mock("../form/SkuPicker", () => ({ default: () => <div>sku</div> }));
// Make the form always appear complete so we can exercise the render path
vi.mock("@/features/document-generation/lib/validation", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/features/document-generation/lib/validation")>();
  return {
    ...actual,
    getCompleteness: () => ({ isComplete: true, missing: [] }),
  };
});
// Mock the queries module — GenerateDocumentModal uses useGeneratedDocumentStatus which needs a QueryClientProvider otherwise
vi.mock("@/features/document-generation/lib/queries", () => ({
  useGeneratedDocumentStatus: () => ({ data: undefined, dataUpdateCount: 0, errorUpdateCount: 0 }),
  SEND_POLL_MAX_UPDATES: 30,
  SEND_POLL_MAX_ERRORS: 5,
}));
// Mock send-client so we can control what the send POST returns
const mockSendForSignatureRequest = vi.fn();
vi.mock("@/features/document-generation/lib/send-client", () => ({
  sendForSignatureRequest: (...args: unknown[]) => mockSendForSignatureRequest(...args),
}));

const completePrefill = {
  docType: "contract" as const, districtLeaId: "x", companyName: "Barstow", billingAddress: "1 Main St",
  startDate: "a", endDate: "b", payTerms: "Net 30", minAmt: null, maxAmt: null,
  bookingReference: 188000, sender: { first: "R", last: "P", title: "AE", email: "e" },
};

function setup(renderClient = vi.fn().mockResolvedValue({ docUrl: "https://docs.google.com/document/d/X/edit" })) {
  render(
    <GenerateDocumentModal prefill={completePrefill} onClose={vi.fn()} renderClient={renderClient} />,
  );
  return { renderClient };
}

describe("GenerateDocumentModal", () => {
  it("mounts on the form stage with the doc-type selector and has not rendered yet", () => {
    const { renderClient } = setup();
    expect(renderClient).not.toHaveBeenCalled();
    expect(screen.getByLabelText("Document type")).toBeInTheDocument();
  });

  it("calls renderClient with tags:false when the generate button is clicked", async () => {
    const { renderClient } = setup();
    const btn = screen.getByRole("button", { name: /Render document/i });
    expect(btn).toBeEnabled();
    await act(async () => { btn.click(); });
    expect(renderClient).toHaveBeenCalledWith(
      expect.anything(),
      { tags: false },
    );
  });

  it("shows Sending… banner after a successful send POST (processing + no poll data yet)", async () => {
    mockSendForSignatureRequest.mockResolvedValueOnce({
      id: 5,
      status: "processing",
      recipientEmail: "s@x.org",
      docUrl: "https://docs.google.com/document/d/X/edit",
      signatureRequestId: "sig_abc",
    });

    const renderClient = vi.fn().mockResolvedValue({ docUrl: "https://docs.google.com/document/d/X/edit" });
    setup(renderClient);

    // First render to get to review stage
    const renderBtn = screen.getByRole("button", { name: /Render document/i });
    await act(async () => { renderBtn.click(); });

    // Now send for signature
    const sendBtn = screen.getByRole("button", { name: /Send for signature/i });
    await act(async () => { sendBtn.click(); });

    // The mocked useGeneratedDocumentStatus returns no data → phase "processing" → shows "Sending…"
    expect(screen.getByText("Sending…")).toBeInTheDocument();
  });
});
