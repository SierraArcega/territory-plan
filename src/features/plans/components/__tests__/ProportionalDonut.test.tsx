import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import ProportionalDonut from "../ProportionalDonut";

describe("ProportionalDonut", () => {
  // Test 1: Renders SVG with correct dimensions
  it("renders SVG with correct dimensions from size prop", () => {
    const { container } = render(
      <ProportionalDonut
        segments={[{ value: 100, color: "#8AA891", label: "Renewal" }]}
        size={80}
        strokeWidth={10}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "80");
    expect(svg).toHaveAttribute("height", "80");
  });

  // Test 2: Empty ring when total is 0
  it("shows only gray track circle when total is 0", () => {
    const { container } = render(
      <ProportionalDonut
        segments={[
          { value: 0, color: "#8AA891", label: "Renewal" },
          { value: 0, color: "#6EA3BE", label: "Expansion" },
        ]}
      />
    );
    const circles = container.querySelectorAll("circle");
    // Only the gray track circle should be present
    expect(circles).toHaveLength(1);
    expect(circles[0]).toHaveAttribute("stroke", "#f0f0f0");
  });

  // Test 3: Single segment fills entire ring
  it("renders one colored circle when only one segment has a value", () => {
    const { container } = render(
      <ProportionalDonut
        segments={[
          { value: 100, color: "#8AA891", label: "Renewal" },
          { value: 0, color: "#6EA3BE", label: "Expansion" },
          { value: 0, color: "#F37167", label: "Win Back" },
          { value: 0, color: "#403770", label: "New Business" },
        ]}
      />
    );
    const circles = container.querySelectorAll("circle");
    // 1 gray track + 1 colored segment
    expect(circles).toHaveLength(2);
    expect(circles[1]).toHaveAttribute("stroke", "#8AA891");
  });

  // Test 4: Multiple segments render correct number of circles
  it("renders one circle per non-zero segment plus the track", () => {
    const { container } = render(
      <ProportionalDonut
        segments={[
          { value: 100, color: "#8AA891", label: "Renewal" },
          { value: 200, color: "#6EA3BE", label: "Expansion" },
          { value: 50, color: "#F37167", label: "Win Back" },
          { value: 150, color: "#403770", label: "New Business" },
        ]}
      />
    );
    const circles = container.querySelectorAll("circle");
    // 1 gray track + 4 colored segments
    expect(circles).toHaveLength(5);
  });

  // Test 5: Segment proportions are correct
  it("calculates correct stroke-dasharray proportions", () => {
    const size = 40;
    const strokeWidth = 5;
    const radius = (size - strokeWidth) / 2; // 17.5
    const circumference = 2 * Math.PI * radius;

    const { container } = render(
      <ProportionalDonut
        segments={[
          { value: 100, color: "#8AA891", label: "Renewal" },    // 20%
          { value: 200, color: "#6EA3BE", label: "Expansion" },   // 40%
          { value: 50, color: "#F37167", label: "Win Back" },     // 10%
          { value: 150, color: "#403770", label: "New Business" }, // 30%
        ]}
        size={size}
        strokeWidth={strokeWidth}
      />
    );

    const coloredCircles = Array.from(container.querySelectorAll("circle")).slice(1);
    expect(coloredCircles).toHaveLength(4);

    // First segment: 20% of circumference
    const expected0 = 0.2 * circumference;
    const dasharray0 = coloredCircles[0].getAttribute("stroke-dasharray")!;
    const segLength0 = parseFloat(dasharray0.split(" ")[0]);
    expect(segLength0).toBeCloseTo(expected0, 1);

    // Second segment: 40% of circumference
    const expected1 = 0.4 * circumference;
    const dasharray1 = coloredCircles[1].getAttribute("stroke-dasharray")!;
    const segLength1 = parseFloat(dasharray1.split(" ")[0]);
    expect(segLength1).toBeCloseTo(expected1, 1);
  });

  // Test 6: Segments use correct colors
  it("applies the correct stroke color to each segment", () => {
    const { container } = render(
      <ProportionalDonut
        segments={[
          { value: 100, color: "#8AA891", label: "Renewal" },
          { value: 200, color: "#6EA3BE", label: "Expansion" },
        ]}
      />
    );
    const coloredCircles = Array.from(container.querySelectorAll("circle")).slice(1);
    expect(coloredCircles[0]).toHaveAttribute("stroke", "#8AA891");
    expect(coloredCircles[1]).toHaveAttribute("stroke", "#6EA3BE");
  });

  // Test 7: Custom size and strokeWidth apply
  it("uses custom size and strokeWidth for SVG dimensions and circle radii", () => {
    const { container } = render(
      <ProportionalDonut
        segments={[{ value: 100, color: "#8AA891", label: "Renewal" }]}
        size={80}
        strokeWidth={10}
      />
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "80");
    expect(svg).toHaveAttribute("height", "80");

    // Track circle should have radius = (80 - 10) / 2 = 35
    const track = container.querySelector("circle");
    expect(track).toHaveAttribute("r", "35");
    expect(track).toHaveAttribute("stroke-width", "10");
  });
});
