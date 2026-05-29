import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResearchAnswer } from "../ResearchAnswer";

// The panel reuses ResearchAnswer for the Sources list; this asserts the
// citations -> Sources rendering contract the panel depends on.
describe("CopilotPanel research rendering contract", () => {
  it("renders a Sources list from message citations", () => {
    render(
      <ResearchAnswer
        text=""
        citations={[{ url: "https://nces.ed.gov/x", title: "NCES" }]}
      />,
    );
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getByRole("link", { name: /NCES/ })).toHaveAttribute(
      "href",
      "https://nces.ed.gov/x",
    );
  });
});
