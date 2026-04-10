import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import BackfillWindowPicker from "../BackfillWindowPicker";

describe("BackfillWindowPicker", () => {
  it("renders 4 preset cards with symmetric past+future labels", () => {
    render(
      <BackfillWindowPicker onStart={vi.fn()} onCancel={vi.fn()} isLoading={false} />
    );
    expect(screen.getAllByRole("radio")).toHaveLength(4);
    expect(screen.getByText("± 7 days")).toBeInTheDocument();
    expect(screen.getByText("± 30 days")).toBeInTheDocument();
    expect(screen.getByText("± 60 days")).toBeInTheDocument();
    expect(screen.getByText("± 90 days")).toBeInTheDocument();
    // The "back + forward" split must appear on every card so users aren't
    // surprised by future events in the wizard.
    expect(screen.getByText("7 days back + 7 days forward")).toBeInTheDocument();
    expect(screen.getByText("30 days back + 30 days forward")).toBeInTheDocument();
    expect(screen.getByText("60 days back + 60 days forward")).toBeInTheDocument();
    expect(screen.getByText("90 days back + 90 days forward")).toBeInTheDocument();
  });

  it("pre-selects the 30-day card with a Recommended badge", () => {
    render(
      <BackfillWindowPicker onStart={vi.fn()} onCancel={vi.fn()} isLoading={false} />
    );
    const thirty = screen.getByRole("radio", { name: /± 30 days/i });
    expect(thirty).toHaveAttribute("aria-checked", "true");
    expect(screen.getByText("Recommended")).toBeInTheDocument();
  });

  it("moves selection when a different card is clicked", async () => {
    const user = userEvent.setup();
    render(
      <BackfillWindowPicker onStart={vi.fn()} onCancel={vi.fn()} isLoading={false} />
    );
    const ninety = screen.getByRole("radio", { name: /± 90 days/i });
    await user.click(ninety);
    expect(ninety).toHaveAttribute("aria-checked", "true");
    expect(screen.getByRole("radio", { name: /± 30 days/i })).toHaveAttribute(
      "aria-checked",
      "false"
    );
  });

  it("calls onStart with the selected days when Start sync is clicked", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <BackfillWindowPicker onStart={onStart} onCancel={vi.fn()} isLoading={false} />
    );
    await user.click(screen.getByRole("radio", { name: /± 60 days/i }));
    await user.click(screen.getByRole("button", { name: /start sync/i }));
    expect(onStart).toHaveBeenCalledWith(60);
  });

  it("defaults to 30 days on Start sync when the user doesn't change selection", async () => {
    const user = userEvent.setup();
    const onStart = vi.fn();
    render(
      <BackfillWindowPicker onStart={onStart} onCancel={vi.fn()} isLoading={false} />
    );
    await user.click(screen.getByRole("button", { name: /start sync/i }));
    expect(onStart).toHaveBeenCalledWith(30);
  });

  it("calls onCancel on Maybe later", async () => {
    const user = userEvent.setup();
    const onCancel = vi.fn();
    render(
      <BackfillWindowPicker onStart={vi.fn()} onCancel={onCancel} isLoading={false} />
    );
    await user.click(screen.getByRole("button", { name: /maybe later/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("disables Start sync while isLoading", () => {
    render(
      <BackfillWindowPicker onStart={vi.fn()} onCancel={vi.fn()} isLoading={true} />
    );
    expect(screen.getByRole("button", { name: /starting sync/i })).toBeDisabled();
  });

  it("uses the coral Start button class", () => {
    render(
      <BackfillWindowPicker onStart={vi.fn()} onCancel={vi.fn()} isLoading={false} />
    );
    const startBtn = screen.getByRole("button", { name: /start sync/i });
    expect(startBtn.className).toMatch(/bg-\[#F37167\]/);
  });
});
