import { describe, it, expect } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ThisWeekColumnCard from "../ThisWeekColumnCard";
import type { ThisWeekColumn } from "@/features/home/lib/pipeline";

function col(n: number): ThisWeekColumn {
  const deals = Array.from({ length: n }, (_, i) => ({
    account: `Acct ${i}`,
    value: (n - i) * 1000,
    motion: i === 0 ? null : "Return",
    product: i === 0 ? null : "Tutoring",
    stage: "Discovery" as string | undefined,
  }));
  return { count: n, total: deals.reduce((s, d) => s + d.value, 0), deals };
}

describe("ThisWeekColumnCard", () => {
  it("shows only the top 5 deals and a Show-more affordance for the rest", () => {
    render(<ThisWeekColumnCard title="Newly Created" accent="#403770" sign="+" column={col(7)} />);
    expect(screen.getByText("Acct 0")).toBeInTheDocument();
    expect(screen.getByText("Acct 4")).toBeInTheDocument();
    expect(screen.queryByText("Acct 5")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /show 2 more/i }));
    expect(screen.getByText("Acct 5")).toBeInTheDocument();
    expect(screen.getByText("Acct 6")).toBeInTheDocument();
    // Collapses back to the top 5.
    fireEvent.click(screen.getByRole("button", { name: /show less/i }));
    expect(screen.queryByText("Acct 5")).not.toBeInTheDocument();
  });

  it("omits null tags without leaving a stray separator", () => {
    render(<ThisWeekColumnCard title="Newly Created" accent="#403770" sign="+" column={col(1)} />);
    // Acct 0 has null motion + null product → only the stage shows, no leading "·".
    const tag = screen.getByText("Discovery");
    expect(tag.textContent).toBe("Discovery");
  });

  it("renders an empty state when there are no deals", () => {
    render(<ThisWeekColumnCard title="Closed Lost" accent="#F37167" sign="−" column={{ count: 0, total: 0, deals: [] }} />);
    expect(screen.getByText(/no deals/i)).toBeInTheDocument();
  });
});
