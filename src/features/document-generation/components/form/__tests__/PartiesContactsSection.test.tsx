import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PartiesContactsSection from "../PartiesContactsSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";
import { schoolYearOptions } from "@/features/document-generation/lib/school-year";

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

describe("PartiesContactsSection — school-year selector", () => {
  // Helper: renders the component inside a QueryClientProvider, returns { onChange, rerender }
  function setupSY(stateOverride: Record<string, unknown> = {}) {
    const baseState = { ...emptyFormState("contract", "0612345"), ...stateOverride };
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <PartiesContactsSection state={baseState} onChange={onChange} />
      </QueryClientProvider>,
    );
    // rerender helper that keeps the same QueryClient and lets you pass a new state
    function rerenderState(nextOverride: Record<string, unknown>) {
      const nextState = { ...emptyFormState("contract", "0612345"), ...nextOverride };
      rerender(
        <QueryClientProvider client={qc}>
          <PartiesContactsSection state={nextState} onChange={onChange} />
        </QueryClientProvider>,
      );
    }
    return { onChange, rerenderState, baseState };
  }

  it("(a) contract renders a combobox labeled 'School year *' with the 6 generated options", () => {
    setupSY();
    // The label text contains "School year *"
    expect(screen.getByText(/School year \*/i)).toBeInTheDocument();
    // The select element (combobox role)
    const select = screen.getByRole("combobox", { name: /School year/i });
    expect(select).toBeInTheDocument();
    // All 6 options are present
    const opts = schoolYearOptions();
    expect(opts).toHaveLength(6);
    for (const sy of opts) {
      expect(screen.getByRole("option", { name: sy })).toBeInTheDocument();
    }
  });

  it("(b) a value outside the window renders as an extra (first) option and stays selected", () => {
    const legacySY = "2020 - 2021";
    setupSY({ schoolYear: legacySY });
    const select = screen.getByRole("combobox", { name: /School year/i }) as HTMLSelectElement;
    // Legacy option exists and is selected
    expect(screen.getByRole("option", { name: legacySY })).toBeInTheDocument();
    expect(select.value).toBe(legacySY);
    // Total options = 6 window + 1 legacy = 7
    expect(select.options).toHaveLength(7);
    // The legacy option is first
    expect(select.options[0].value).toBe(legacySY);
  });

  it("(c) clicking 'Type manually' swaps to a textbox and fires onChange({ schoolYearManual: true })", () => {
    const { onChange } = setupSY({ schoolYearManual: false });
    // Initially shows select
    expect(screen.getByRole("combobox", { name: /School year/i })).toBeInTheDocument();
    // The toggle button is inside a <label> so query by visible text
    const toggleBtn = screen.getByText("Type manually");
    fireEvent.click(toggleBtn);
    expect(onChange).toHaveBeenCalledWith({ schoolYearManual: true });
  });

  it("(c) in manual mode the button reads 'Use selector' and shows a textbox", () => {
    setupSY({ schoolYearManual: true, schoolYear: "2026 - 2027" });
    expect(screen.queryByRole("combobox", { name: /School year/i })).toBeNull();
    // The text input in manual mode has placeholder text
    expect(screen.getByPlaceholderText("e.g. 2026 - 2027")).toBeInTheDocument();
    expect(screen.getByText("Use selector")).toBeInTheDocument();
  });

  it("(d) changing startDate re-derives schoolYear via onChange when untouched", () => {
    // Start with a state whose schoolYear matches the derived value for the initial date
    const { onChange, rerenderState } = setupSY({
      schoolYear: "2026 - 2027",
      startDate: "2026-09-01",
      schoolYearManual: false,
    });
    // Rerender with a different startDate that would derive a different SY
    rerenderState({
      schoolYear: "2026 - 2027",
      startDate: "2027-09-01",
      schoolYearManual: false,
    });
    // Should have called onChange with the newly derived schoolYear
    expect(onChange).toHaveBeenCalledWith({ schoolYear: "2027 - 2028" });
  });

  it("(d) does NOT re-derive schoolYear after user manually picked from the select", () => {
    const { onChange, rerenderState } = setupSY({
      schoolYear: "2026 - 2027",
      startDate: "2026-09-01",
      schoolYearManual: false,
    });
    // Pick the last option in the generated window (always in-window, never expires)
    const target = schoolYearOptions().at(-1)!;
    // User picks a different year from the selector (marks syTouched)
    const select = screen.getByRole("combobox", { name: /School year/i });
    fireEvent.change(select, { target: { value: target } });
    expect(onChange).toHaveBeenCalledWith({ schoolYear: target });

    // Count only pure schoolYear calls (no schoolYearManual key) before rerender
    const syCallsBefore = onChange.mock.calls.filter(
      (call) => "schoolYear" in call[0] && !("schoolYearManual" in call[0]),
    ).length;

    // Rerender with a changed startDate — should NOT trigger another schoolYear onChange
    rerenderState({
      schoolYear: target,
      startDate: "2027-09-01",
      schoolYearManual: false,
    });

    const syCallsAfter = onChange.mock.calls.filter(
      (call) => "schoolYear" in call[0] && !("schoolYearManual" in call[0]),
    ).length;
    // No additional schoolYear-only calls after the rerender
    expect(syCallsAfter).toBe(syCallsBefore);
  });

  it("(e) empty value in manual mode gets the red border class", () => {
    setupSY({ schoolYearManual: true, schoolYear: "" });
    const input = screen.getByPlaceholderText("e.g. 2026 - 2027");
    expect(input.className).toContain("border-[#F37167]");
  });
});
