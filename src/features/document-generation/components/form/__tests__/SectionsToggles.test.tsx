import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SectionsToggles from "../SectionsToggles";
import { emptyFormState } from "@/features/document-generation/lib/payload-types";

describe("SectionsToggles", () => {
  it("toggles staffing and emits a sections patch", () => {
    const onChange = vi.fn();
    render(<SectionsToggles state={emptyFormState("contract", "x")} onChange={onChange} />);
    fireEvent.click(screen.getByLabelText(/Staffing descriptions/i));
    expect(onChange).toHaveBeenCalledWith({ sections: expect.objectContaining({ staffing: true }) });
  });
  it("shows the BOCES agreement toggle only in boces mode", () => {
    const { rerender } = render(<SectionsToggles state={emptyFormState("contract", "x")} onChange={vi.fn()} />);
    expect(screen.queryByLabelText(/BOCES agreement/i)).not.toBeInTheDocument();
    rerender(<SectionsToggles state={emptyFormState("boces_quote", "x")} onChange={vi.fn()} />);
    expect(screen.getByLabelText(/BOCES agreement/i)).toBeInTheDocument();
  });
});
