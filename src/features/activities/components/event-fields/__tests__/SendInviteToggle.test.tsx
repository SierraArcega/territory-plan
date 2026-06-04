import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import SendInviteToggle from "../SendInviteToggle";

describe("SendInviteToggle", () => {
  it("renders off by default and shows the not-emailed helper text", () => {
    render(<SendInviteToggle checked={false} onChange={() => {}} />);
    const checkbox = screen.getByRole("checkbox", { name: "Send calendar invite to contacts" });
    expect(checkbox).not.toBeChecked();
    expect(screen.getByText(/added to the calendar event but not emailed/i)).toBeInTheDocument();
  });

  it("shows the will-invite helper text when checked", () => {
    render(<SendInviteToggle checked={true} onChange={() => {}} />);
    expect(screen.getByText(/will get a google calendar invite/i)).toBeInTheDocument();
  });

  it("calls onChange with the next value when toggled", () => {
    const onChange = vi.fn();
    render(<SendInviteToggle checked={false} onChange={onChange} />);
    fireEvent.click(screen.getByRole("checkbox", { name: /send calendar invite/i }));
    expect(onChange).toHaveBeenCalledWith(true);
  });
});
