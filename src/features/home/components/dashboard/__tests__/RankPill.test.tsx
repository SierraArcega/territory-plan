import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import RankPill from "../RankPill";

describe("RankPill", () => {
  it("shows rank position and top percentile", () => {
    render(<RankPill rank={3} totalReps={12} inRoster />);
    expect(screen.getByText("#3/12")).toBeInTheDocument();
    expect(screen.getByText("top 25%")).toBeInTheDocument();
  });
  it("labels the leader instead of a percentile", () => {
    render(<RankPill rank={1} totalReps={39} inRoster />);
    expect(screen.getByText("#1/39")).toBeInTheDocument();
    expect(screen.getByText("leader")).toBeInTheDocument();
  });
  it("renders 'Not ranked' when out of roster", () => {
    render(<RankPill rank={0} totalReps={39} inRoster={false} />);
    expect(screen.getByText("Not ranked")).toBeInTheDocument();
  });
});
