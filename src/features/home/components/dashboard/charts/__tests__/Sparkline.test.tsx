import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import Sparkline from "../Sparkline";

describe("Sparkline", () => {
  it("renders a single polyline for the current series", () => {
    const { container } = render(<Sparkline data={[1, 2, 3, 5, 8]} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(1);
    expect(container.querySelector("circle")).toBeTruthy(); // end dot
  });

  it("renders a second (prior) polyline when priorData is given", () => {
    const { container } = render(<Sparkline data={[1, 2, 3]} priorData={[2, 2, 4]} />);
    expect(container.querySelectorAll("polyline")).toHaveLength(2);
  });

  it("renders nothing for an empty series", () => {
    const { container } = render(<Sparkline data={[]} />);
    expect(container.querySelector("svg")).toBeNull();
  });
});
