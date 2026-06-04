import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import Modal from "../Modal";

describe("Modal", () => {
  it("renders nothing when closed", () => {
    render(
      <Modal open={false} onClose={() => {}} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByText("body")).toBeNull();
    expect(screen.queryByRole("dialog")).toBeNull();
  });

  it("renders the dialog with its content and aria label when open", () => {
    render(
      <Modal open onClose={() => {}} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toHaveAttribute("aria-modal", "true");
    expect(dialog).toHaveAttribute("aria-label", "Test dialog");
    expect(screen.getByText("body")).toBeInTheDocument();
  });

  it("closes on Escape", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    );
    fireEvent.keyDown(window, { key: "Escape" });
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("closes on backdrop click but not on panel click", () => {
    const onClose = vi.fn();
    render(
      <Modal open onClose={onClose} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    );
    // Clicking the inner content must not close (stopPropagation on the panel)
    fireEvent.click(screen.getByText("body"));
    expect(onClose).not.toHaveBeenCalled();
    // Clicking the backdrop (the dialog element itself) closes
    fireEvent.click(screen.getByRole("dialog"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("renders a close button that calls onClose, and can hide it", () => {
    const onClose = vi.fn();
    const { rerender } = render(
      <Modal open onClose={onClose} ariaLabel="Test dialog">
        <p>body</p>
      </Modal>,
    );
    fireEvent.click(screen.getByRole("button", { name: "Close" }));
    expect(onClose).toHaveBeenCalledTimes(1);

    rerender(
      <Modal open onClose={onClose} ariaLabel="Test dialog" showClose={false}>
        <p>body</p>
      </Modal>,
    );
    expect(screen.queryByRole("button", { name: "Close" })).toBeNull();
  });
});
