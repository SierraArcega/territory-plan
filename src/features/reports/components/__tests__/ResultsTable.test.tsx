import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import React from "react";
import { ResultsTable } from "../ResultsTable";

describe("ResultsTable", () => {
  it("hides columns whose metadata is format=id by default", () => {
    render(
      <ResultsTable
        columns={["leaid", "name", "state"]}
        rows={[{ leaid: "3100009", name: "Houston", state: "TX" }]}
      />,
    );
    expect(screen.queryByText(/leaid/i)).not.toBeInTheDocument();
    expect(screen.getByText("Name")).toBeInTheDocument();
  });

  it("reveals ID columns when 'show technical columns' is toggled", () => {
    render(
      <ResultsTable
        columns={["leaid", "name"]}
        rows={[{ leaid: "3100009", name: "Houston" }]}
      />,
    );
    const toggle = screen.getByRole("button", { name: /technical/i });
    fireEvent.click(toggle);
    expect(screen.getByText(/leaid/i)).toBeInTheDocument();
  });

  it("shows empty state when rows is []", () => {
    render(<ResultsTable columns={["name"]} rows={[]} />);
    expect(screen.getByText(/no rows/i)).toBeInTheDocument();
  });

  it("renders URL cell values as anchors that open in a new tab", () => {
    render(
      <ResultsTable
        columns={["website_url"]}
        rows={[{ website_url: "https://rsdshafter.org" }]}
      />,
    );
    const link = screen.getByRole("link", { name: /rsdshafter\.org/i });
    expect(link).toHaveAttribute("href", "https://rsdshafter.org");
    expect(link).toHaveAttribute("target", "_blank");
    expect(link).toHaveAttribute("rel", "noopener noreferrer");
  });
});
