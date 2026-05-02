import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SavePopover } from "../SavePopover";

describe("SavePopover", () => {
  it("prefills title and description from props", () => {
    render(
      <SavePopover
        mode="save-new"
        initialTitle="Texas opps"
        initialDescription="open + stuck"
        onClose={() => {}}
        onSaveNew={() => {}}
      />,
    );
    expect((screen.getByDisplayValue("Texas opps") as HTMLInputElement).tagName).toBe("INPUT");
    expect(screen.getByDisplayValue("open + stuck")).toBeInTheDocument();
  });

  it("save-new mode: Save report submits with current title + description", () => {
    const onSaveNew = vi.fn();
    render(
      <SavePopover
        mode="save-new"
        initialTitle="Texas opps"
        initialDescription=""
        onClose={() => {}}
        onSaveNew={onSaveNew}
      />,
    );
    const titleInput = screen.getByDisplayValue("Texas opps") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Texas Q4 opps" } });
    fireEvent.click(screen.getByRole("button", { name: /save report/i }));
    expect(onSaveNew).toHaveBeenCalledWith("Texas Q4 opps", "");
  });

  it("save-new mode: title required — disables Save when empty", () => {
    const onSaveNew = vi.fn();
    render(
      <SavePopover
        mode="save-new"
        initialTitle="X"
        initialDescription=""
        onClose={() => {}}
        onSaveNew={onSaveNew}
      />,
    );
    const titleInput = screen.getByDisplayValue("X") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "  " } });
    const save = screen.getByRole("button", { name: /save report/i });
    expect(save).toBeDisabled();
    fireEvent.click(save);
    expect(onSaveNew).not.toHaveBeenCalled();
  });

  it("update-or-save-new mode: Update calls onUpdate; Save as new calls onSaveNew", () => {
    const onSaveNew = vi.fn();
    const onUpdate = vi.fn();
    render(
      <SavePopover
        mode="update-or-save-new"
        initialTitle="Texas opps"
        initialDescription=""
        onClose={() => {}}
        onSaveNew={onSaveNew}
        onUpdate={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^update saved report$/i }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByRole("button", { name: /^save as new$/i }));
    expect(onSaveNew).toHaveBeenCalledTimes(1);
  });

  it("edit-details mode: Save calls onEditDetails (not onSaveNew)", () => {
    const onSaveNew = vi.fn();
    const onEditDetails = vi.fn();
    render(
      <SavePopover
        mode="edit-details"
        initialTitle="Texas opps"
        initialDescription="open"
        onClose={() => {}}
        onSaveNew={onSaveNew}
        onEditDetails={onEditDetails}
      />,
    );
    const titleInput = screen.getByDisplayValue("Texas opps") as HTMLInputElement;
    fireEvent.change(titleInput, { target: { value: "Texas open opps" } });
    fireEvent.click(screen.getByRole("button", { name: /^save$/i }));
    expect(onEditDetails).toHaveBeenCalledWith("Texas open opps", "open");
    expect(onSaveNew).not.toHaveBeenCalled();
  });

  it("Escape key closes the popover", () => {
    const onClose = vi.fn();
    render(
      <SavePopover
        mode="save-new"
        initialTitle="X"
        initialDescription=""
        onClose={onClose}
        onSaveNew={() => {}}
      />,
    );
    fireEvent.keyDown(document, { key: "Escape" });
    expect(onClose).toHaveBeenCalled();
  });
});
