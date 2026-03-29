import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import CollapsibleSection from "../CollapsibleSection";

describe("CollapsibleSection", () => {
  it("shows content when defaultOpen is true", () => {
    render(
      <CollapsibleSection title="Test Section" defaultOpen>
        <p>Inner content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText("Inner content")).toBeInTheDocument();
  });

  it("hides content when defaultOpen is false", () => {
    render(
      <CollapsibleSection title="Test Section">
        <p>Inner content</p>
      </CollapsibleSection>
    );
    expect(screen.queryByText("Inner content")).not.toBeInTheDocument();
  });

  it("toggles content on click", async () => {
    const user = userEvent.setup();
    render(
      <CollapsibleSection title="Test Section">
        <p>Inner content</p>
      </CollapsibleSection>
    );

    expect(screen.queryByText("Inner content")).not.toBeInTheDocument();

    await user.click(screen.getByText("Test Section"));
    expect(screen.getByText("Inner content")).toBeInTheDocument();

    await user.click(screen.getByText("Test Section"));
    expect(screen.queryByText("Inner content")).not.toBeInTheDocument();
  });

  it("shows subtitle when provided", () => {
    render(
      <CollapsibleSection title="Test" subtitle="A subtitle">
        <p>Content</p>
      </CollapsibleSection>
    );
    expect(screen.getByText("A subtitle")).toBeInTheDocument();
  });
});
