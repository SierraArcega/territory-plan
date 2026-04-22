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
    expect(screen.queryByText("leaid")).not.toBeInTheDocument();
    expect(screen.getByText("name")).toBeInTheDocument();
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
    expect(screen.getByText("leaid")).toBeInTheDocument();
  });

  it("shows empty state when rows is []", () => {
    render(<ResultsTable columns={["name"]} rows={[]} />);
    expect(screen.getByText(/no rows/i)).toBeInTheDocument();
  });
});
