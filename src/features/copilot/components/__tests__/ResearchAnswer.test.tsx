import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ResearchAnswer } from "../ResearchAnswer";

describe("ResearchAnswer", () => {
  const citations = [
    { url: "https://austinisd.org/bond", title: "2024 Bond Program" },
    { url: "https://www.kut.org/news/123", title: "Voters approve bond" },
  ];

  it("renders the prose answer and a numbered Sources list with links", () => {
    render(<ResearchAnswer text="Austin ISD passed a $2.4B bond." citations={citations} />);
    expect(screen.getByText(/Austin ISD passed/)).toBeInTheDocument();
    expect(screen.getByText("Sources")).toBeInTheDocument();
    const first = screen.getByRole("link", { name: /2024 Bond Program/ });
    expect(first).toHaveAttribute("href", "https://austinisd.org/bond");
    expect(first).toHaveAttribute("target", "_blank");
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });

  it("omits the Sources section when there are no citations", () => {
    render(<ResearchAnswer text="No external sources." citations={[]} />);
    expect(screen.queryByText("Sources")).not.toBeInTheDocument();
    expect(screen.queryAllByRole("link")).toHaveLength(0);
  });

  it("renders only the Sources list when text is empty (panel reuse)", () => {
    render(<ResearchAnswer text="" citations={citations} />);
    expect(screen.getByText("Sources")).toBeInTheDocument();
    expect(screen.getAllByRole("link")).toHaveLength(2);
  });
});
