import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
    expect(screen.getByLabelText(/Billing address/i)).toBeInTheDocument();
  });
  it("flags the billing address with the coral border only while empty", () => {
    setup({ billingAddress: "" });
    expect(screen.getByLabelText(/Billing address/i).className).toContain("border-[#F37167]");
  });
  it("uses the neutral border once billing address is filled", () => {
    setup({ billingAddress: "1 Main St, Town, ST 00000" });
    const input = screen.getByLabelText(/Billing address/i);
    expect(input.className).toContain("border-[#C2BBD4]");
    expect(input.className).not.toContain("border-[#F37167]");
  });
  it("shows the CC field for contracts and forwards changes", () => {
    const { onChange } = setup();
    const input = screen.getByLabelText("CC executed copy to");
    fireEvent.change(input, { target: { value: "ap@x.com" } });
    expect(onChange).toHaveBeenCalledWith({ ccEmails: "ap@x.com" });
  });
  it("hides the CC field for BOCES quotes", () => {
    setup({ docType: "boces_quote" });
    expect(screen.queryByLabelText("CC executed copy to")).toBeNull();
  });
});
