// src/components/common/__tests__/ViewToggle.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewToggle from "../ViewToggle";

describe("ViewToggle", () => {
  it("renders both toggle buttons", () => {
    render(<ViewToggle view="cards" onViewChange={() => {}} />);

    expect(screen.getByRole("button", { name: /grid view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /table view/i })).toBeInTheDocument();
  });

  it("highlights cards button when view is cards", () => {
    render(<ViewToggle view="cards" onViewChange={() => {}} />);

    const cardsButton = screen.getByRole("button", { name: /grid view/i });
    expect(cardsButton).toHaveClass("bg-[#403770]");
  });

  it("highlights table button when view is table", () => {
    render(<ViewToggle view="table" onViewChange={() => {}} />);

    const tableButton = screen.getByRole("button", { name: /table view/i });
    expect(tableButton).toHaveClass("bg-[#403770]");
  });

  it("calls onViewChange with 'cards' when cards button clicked", () => {
    const handleChange = vi.fn();
    render(<ViewToggle view="table" onViewChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: /grid view/i }));
    expect(handleChange).toHaveBeenCalledWith("cards");
  });

  it("calls onViewChange with 'table' when table button clicked", () => {
    const handleChange = vi.fn();
    render(<ViewToggle view="cards" onViewChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: /table view/i }));
    expect(handleChange).toHaveBeenCalledWith("table");
  });
});
