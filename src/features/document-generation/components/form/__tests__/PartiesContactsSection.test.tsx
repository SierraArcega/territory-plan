import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PartiesContactsSection from "../PartiesContactsSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

vi.mock("../ContactRolePicker", () => ({
  default: ({ label }: { label: string }) => <div>picker:{label}</div>,
}));

function setup(stateOverride = {}) {
  const state = { ...emptyFormState("contract", "0612345"), ...stateOverride };
  const onChange = vi.fn();
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <PartiesContactsSection state={state} onChange={onChange} />
    </QueryClientProvider>,
  );
  return { onChange };
}

describe("PartiesContactsSection", () => {
  it("hides signer/billing pickers when 'same as client' is checked (default)", () => {
    setup();
    expect(screen.getByText("picker:Client contact")).toBeInTheDocument();
    expect(screen.queryByText("picker:Signer")).not.toBeInTheDocument();
    expect(screen.queryByText("picker:Billing contact")).not.toBeInTheDocument();
  });
  it("shows the signer picker when 'signer same as client' is unchecked", () => {
    setup({ signerSameAsClient: false });
    expect(screen.getByText("picker:Signer")).toBeInTheDocument();
  });
  it("shows the billing contact picker when billing is not the same as client", () => {
    setup({ billingSameAsClient: false });
    expect(screen.getByText("picker:Billing contact")).toBeInTheDocument();
  });
  it("suppresses the entire signer block for a BOCES quote", () => {
    setup({ docType: "boces_quote" });
    expect(screen.queryByText("Signer is the same person")).not.toBeInTheDocument();
    expect(screen.queryByText("picker:Signer")).not.toBeInTheDocument();
  });
  it("always shows the required billing address field", () => {
    setup();
    expect(screen.getByPlaceholderText(/Billing address/i)).toBeInTheDocument();
  });
});
