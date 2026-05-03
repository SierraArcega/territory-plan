import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { SaveButton } from "../SaveButton";

describe("SaveButton", () => {
  it("fresh mode: renders single Save report button + popover on click", () => {
    const onSaveNew = vi.fn();
    render(
      <SaveButton
        sessionMode="fresh"
        initialTitle="My report"
        initialDescription=""
        onSaveNew={onSaveNew}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /save report/i }));
    expect(screen.getByRole("dialog", { name: /save report/i })).toBeInTheDocument();
  });

  it("loaded-refined mode: Update primary fires immediately; chevron opens popover", () => {
    const onUpdate = vi.fn();
    const onSaveNew = vi.fn();
    render(
      <SaveButton
        sessionMode="loaded-refined"
        initialTitle="Texas opps"
        initialDescription=""
        onSaveNew={onSaveNew}
        onUpdateSavedReport={onUpdate}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /^update$/i }));
    expect(onUpdate).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole("dialog")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /save as new/i }));
    expect(screen.getByRole("dialog", { name: /save changes/i })).toBeInTheDocument();
  });

  it("loaded-unmodified mode: Edit details + Delete buttons (no Update)", () => {
    const onDelete = vi.fn();
    render(
      <SaveButton
        sessionMode="loaded-unmodified"
        initialTitle="Texas opps"
        initialDescription="open"
        onSaveNew={() => {}}
        onDelete={onDelete}
      />,
    );
    expect(screen.getByRole("button", { name: /edit details/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /delete/i })).toBeInTheDocument();
    expect(screen.queryByRole("button", { name: /^update$/i })).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
