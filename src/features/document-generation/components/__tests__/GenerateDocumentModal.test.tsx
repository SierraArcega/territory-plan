import { describe, it, expect, vi } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
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

const completePrefill = {
  docType: "contract" as const, districtLeaId: "x", companyName: "Barstow", billingAddress: "1 Main St",
  startDate: "a", endDate: "b", payTerms: "Net 30", minAmt: null, maxAmt: null,
  bookingReference: 188000, sender: { first: "R", last: "P", title: "AE", email: "e" },
};

function setup(renderClient = vi.fn().mockResolvedValue({ docUrl: "https://docs.google.com/document/d/X/edit" })) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <GenerateDocumentModal prefill={completePrefill} onClose={vi.fn()} renderClient={renderClient} />
    </QueryClientProvider>,
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
});
