import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import DocumentPayloadForm from "../DocumentPayloadForm";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";
import type { ContactRef } from "@/features/document-generation/lib/payload-types";

vi.mock("../ContactRolePicker", () => ({ default: () => <div>picker</div> }));
vi.mock("../SkuPicker", () => ({ default: () => <div>sku</div> }));

const complete = () => {
  const s = emptyFormState("contract", "x");
  const c: ContactRef = { contactId: 1, salutation: null, firstName: "A", lastName: "B", title: "T", email: "e", phone: "p" };
  return { ...s, clientContact: c, billingAddress: "1 Main", startDate: "a", endDate: "b",
    lineItems: [{ id: "1", sku: null, service: "S", description: "", qty: 1, unit: "hrs", listRate: 10, discountPct: 0 }] };
};

function setup(state = emptyFormState("contract", "x"), onRender = vi.fn()) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={qc}>
      <DocumentPayloadForm value={state} onChange={vi.fn()} onRender={onRender} bookingReference={null} />
    </QueryClientProvider>,
  );
  return { onRender };
}

describe("DocumentPayloadForm", () => {
  it("disables Render when incomplete and lists what's missing", () => {
    setup();
    expect(screen.getByRole("button", { name: /Render document/i })).toBeDisabled();
    expect(screen.getByText(/Billing address/)).toBeInTheDocument();
  });
  it("enables Render when complete and fires onRender", () => {
    const { onRender } = setup(complete());
    const btn = screen.getByRole("button", { name: /Render document/i });
    expect(btn).toBeEnabled();
    btn.click();
    expect(onRender).toHaveBeenCalled();
  });

  it("forces payment type C when switching the doc type to BOCES Quote", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DocumentPayloadForm value={emptyFormState("contract", "x")} onChange={onChange} onRender={vi.fn()} bookingReference={null} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Document type"), { target: { value: "boces_quote" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ docType: "boces_quote", paymentType: "C" }));
  });

  it("resets BOCES-only payment type C back to A when switching to Contract", () => {
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const bocesState = { ...emptyFormState("boces_quote", "x"), paymentType: "C" as const };
    render(
      <QueryClientProvider client={qc}>
        <DocumentPayloadForm value={bocesState} onChange={onChange} onRender={vi.fn()} bookingReference={null} />
      </QueryClientProvider>,
    );
    fireEvent.change(screen.getByLabelText("Document type"), { target: { value: "contract" } });
    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ docType: "contract", paymentType: "A" }));
  });

  it("shows generating label and disables button when busy=true", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DocumentPayloadForm value={complete()} onChange={vi.fn()} onRender={vi.fn()} bookingReference={null} busy={true} />
      </QueryClientProvider>,
    );
    const btn = screen.getByRole("button", { name: /Generating/i });
    expect(btn).toBeDisabled();
  });

  it("shows normal label and is enabled when busy=false and form complete", () => {
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    render(
      <QueryClientProvider client={qc}>
        <DocumentPayloadForm value={complete()} onChange={vi.fn()} onRender={vi.fn()} bookingReference={null} busy={false} />
      </QueryClientProvider>,
    );
    const btn = screen.getByRole("button", { name: /Render document →/i });
    expect(btn).toBeEnabled();
  });
});
