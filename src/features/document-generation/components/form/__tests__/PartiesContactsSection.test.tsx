import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PartiesContactsSection from "../PartiesContactsSection";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";
import {
  startYearOptions,
  splitSchoolYear,
  joinSchoolYear,
} from "@/features/document-generation/lib/school-year";

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

describe("PartiesContactsSection — school-year selector (pair)", () => {
  // Helper: renders the component inside a QueryClientProvider
  function setupSY(stateOverride: Record<string, unknown> = {}) {
    const baseState = { ...emptyFormState("contract", "0612345"), ...stateOverride };
    const onChange = vi.fn();
    const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    const { rerender } = render(
      <QueryClientProvider client={qc}>
        <PartiesContactsSection state={baseState} onChange={onChange} />
      </QueryClientProvider>,
    );
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

  it("(a) renders two selects with correct aria-labels and options from the window", () => {
    setupSY();
    const startSelect = screen.getByRole("combobox", {
      name: /School year start/i,
    }) as HTMLSelectElement;
    const endSelect = screen.getByRole("combobox", {
      name: /School year end/i,
    }) as HTMLSelectElement;

    // Both selects are present
    expect(startSelect).toBeInTheDocument();
    expect(endSelect).toBeInTheDocument();

    // Left select shows the window start-years (year-proof — use startYearOptions())
    const starts = startYearOptions();
    expect(starts).toHaveLength(5);
    for (const yr of starts) {
      expect(
        Array.from(startSelect.options).some((o) => o.value === String(yr)),
      ).toBe(true);
    }

    // Right select defaults to start+1..start+3 for the current start year
    const defaultStart = splitSchoolYear(emptyFormState("contract", "0612345").schoolYear)!.start;
    const expectedEnds = [defaultStart + 1, defaultStart + 2, defaultStart + 3];
    for (const yr of expectedEnds) {
      expect(
        Array.from(endSelect.options).some((o) => o.value === String(yr)),
      ).toBe(true);
    }
  });

  it("(a) both selects reflect the current state value", () => {
    const sy = joinSchoolYear(startYearOptions()[1], startYearOptions()[1] + 1);
    setupSY({ schoolYear: sy });
    const parsed = splitSchoolYear(sy)!;
    const startSelect = screen.getByRole("combobox", {
      name: /School year start/i,
    }) as HTMLSelectElement;
    const endSelect = screen.getByRole("combobox", {
      name: /School year end/i,
    }) as HTMLSelectElement;
    expect(startSelect.value).toBe(String(parsed.start));
    expect(endSelect.value).toBe(String(parsed.end));
  });

  it("(b) picking a left year fires onChange with joinSchoolYear(newStart, newStart+1)", () => {
    const { onChange } = setupSY();
    const starts = startYearOptions();
    const newStart = starts[2]; // pick 3rd option (in-window, not the default)
    const startSelect = screen.getByRole("combobox", { name: /School year start/i });
    fireEvent.change(startSelect, { target: { value: String(newStart) } });
    expect(onChange).toHaveBeenCalledWith({
      schoolYear: joinSchoolYear(newStart, newStart + 1),
    });
  });

  it("(c) picking a right year fires onChange with joinSchoolYear(currentStart, pickedEnd)", () => {
    // Use a state with the first window start, so we can pick end = start+3 (multi-year)
    const starts = startYearOptions();
    const currentStart = starts[0];
    const initialSY = joinSchoolYear(currentStart, currentStart + 1);
    const { onChange } = setupSY({ schoolYear: initialSY });
    const endSelect = screen.getByRole("combobox", { name: /School year end/i });
    const multiYearEnd = currentStart + 3;
    fireEvent.change(endSelect, { target: { value: String(multiYearEnd) } });
    expect(onChange).toHaveBeenCalledWith({
      schoolYear: joinSchoolYear(currentStart, multiYearEnd),
    });
  });

  it("(d) out-of-window start year is injected into the left select", () => {
    const outOfWindowSY = "2031 - 2035"; // both start and end are far out of the 2026 window
    setupSY({ schoolYear: outOfWindowSY });
    const startSelect = screen.getByRole("combobox", {
      name: /School year start/i,
    }) as HTMLSelectElement;
    // The injected start year (2031) should appear as an option
    expect(
      Array.from(startSelect.options).some((o) => o.value === "2031"),
    ).toBe(true);
    expect(startSelect.value).toBe("2031");
  });

  it("(d) out-of-window end year is injected into the right select", () => {
    const outOfWindowSY = "2031 - 2035";
    setupSY({ schoolYear: outOfWindowSY });
    const endSelect = screen.getByRole("combobox", {
      name: /School year end/i,
    }) as HTMLSelectElement;
    // The injected end year (2035) should appear as an option
    expect(
      Array.from(endSelect.options).some((o) => o.value === "2035"),
    ).toBe(true);
    expect(endSelect.value).toBe("2035");
  });

  it("(e) start-date sync re-derives schoolYear when untouched", () => {
    const { onChange, rerenderState } = setupSY({
      schoolYear: "2026 - 2027",
      startDate: "2026-09-01",
      schoolYearManual: false,
    });
    rerenderState({
      schoolYear: "2026 - 2027",
      startDate: "2027-09-01",
      schoolYearManual: false,
    });
    expect(onChange).toHaveBeenCalledWith({ schoolYear: "2027 - 2028" });
  });

  it("(e) does NOT re-derive after picking from the left select (syTouched)", () => {
    const { onChange, rerenderState } = setupSY({
      schoolYear: "2026 - 2027",
      startDate: "2026-09-01",
      schoolYearManual: false,
    });
    const starts = startYearOptions();
    const newStart = starts.at(-1)!; // pick last in-window start year
    const startSelect = screen.getByRole("combobox", { name: /School year start/i });
    fireEvent.change(startSelect, { target: { value: String(newStart) } });
    expect(onChange).toHaveBeenCalledWith({
      schoolYear: joinSchoolYear(newStart, newStart + 1),
    });

    const syCallsBefore = onChange.mock.calls.filter(
      (call) => "schoolYear" in call[0] && !("schoolYearManual" in call[0]),
    ).length;

    rerenderState({
      schoolYear: joinSchoolYear(newStart, newStart + 1),
      startDate: "2027-09-01",
      schoolYearManual: false,
    });

    const syCallsAfter = onChange.mock.calls.filter(
      (call) => "schoolYear" in call[0] && !("schoolYearManual" in call[0]),
    ).length;
    expect(syCallsAfter).toBe(syCallsBefore);
  });

  it("(f) 'Type manually' fires onChange({ schoolYearManual: true })", () => {
    const { onChange } = setupSY({ schoolYearManual: false });
    expect(screen.getByRole("combobox", { name: /School year start/i })).toBeInTheDocument();
    fireEvent.click(screen.getByText("Type manually"));
    expect(onChange).toHaveBeenCalledWith({ schoolYearManual: true });
  });

  it("(f) manual mode shows a textbox, hides selects, and button reads 'Use selector'", () => {
    setupSY({ schoolYearManual: true, schoolYear: "2026 - 2027" });
    expect(screen.queryByRole("combobox", { name: /School year start/i })).toBeNull();
    expect(screen.queryByRole("combobox", { name: /School year end/i })).toBeNull();
    expect(screen.getByPlaceholderText("e.g. 2026 - 2027")).toBeInTheDocument();
    expect(screen.getByText("Use selector")).toBeInTheDocument();
  });

  it("(f) empty value in manual mode gets the red border class", () => {
    setupSY({ schoolYearManual: true, schoolYear: "" });
    const input = screen.getByPlaceholderText("e.g. 2026 - 2027");
    expect(input.className).toContain("border-[#F37167]");
  });
});

describe("PartiesContactsSection — required date inputs", () => {
  it("empty date shows the 'Select date' hint, transparent ghost text, and red border", () => {
    setup({ startDate: "", endDate: "2027-06-30" });
    const hints = screen.getAllByText("Select date");
    expect(hints).toHaveLength(1); // only the empty one
    const start = screen.getByLabelText("Start date");
    expect(start.className).toContain("text-transparent");
    expect(start.className).toContain("border-[#F37167]");
    const end = screen.getByLabelText("End date");
    expect(end.className).not.toContain("text-transparent");
    expect(end.className).toContain("border-[#C2BBD4]");
  });
  it("filled dates show no hint", () => {
    setup({ startDate: "2026-09-01", endDate: "2027-06-30" });
    expect(screen.queryByText("Select date")).toBeNull();
  });
});
