import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import DonutChart from "../DonutChart";

describe("DonutChart", () => {
  // Test 1: Renders SVG with correct dimensions
  it("renders SVG with correct dimensions", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" size={120} />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toBeInTheDocument();
    expect(svg).toHaveAttribute("width", "120");
    expect(svg).toHaveAttribute("height", "120");
  });

  // Test 2: Background circle uses track color
  it("background circle uses track color #f0f0f0", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" />,
    );
    const circles = container.querySelectorAll("circle");
    expect(circles[0]).toHaveAttribute("stroke", "#f0f0f0");
  });

  // Test 3: Fill circle uses provided color
  it("fill circle uses the provided color", () => {
    const { container } = render(
      <DonutChart percent={50} color="#6EA3BE" />,
    );
    const circles = container.querySelectorAll("circle");
    expect(circles[1]).toHaveAttribute("stroke", "#6EA3BE");
  });

  // Test 4: 0% shows full offset (empty ring)
  it("0% shows full offset (empty ring) after animation timer", () => {
    vi.useFakeTimers();
    const size = 100;
    const strokeWidth = 8;
    const radius = (size - strokeWidth) / 2;
    const circumference = 2 * Math.PI * radius;

    const { container } = render(
      <DonutChart percent={0} color="#F37167" size={size} strokeWidth={strokeWidth} />,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const fillCircle = container.querySelectorAll("circle")[1];
    const offset = parseFloat(fillCircle.style.strokeDashoffset || fillCircle.getAttribute("stroke-dashoffset") || "0");
    // For 0%, offset should equal full circumference
    expect(offset).toBeCloseTo(circumference, 1);

    vi.useRealTimers();
  });

  // Test 5: 100% shows zero offset (full ring)
  it("100% shows zero offset (full ring) after animation timer", () => {
    vi.useFakeTimers();

    const { container } = render(
      <DonutChart percent={100} color="#F37167" />,
    );

    act(() => {
      vi.advanceTimersByTime(200);
    });

    const fillCircle = container.querySelectorAll("circle")[1];
    const dashoffset = fillCircle.getAttribute("stroke-dashoffset");
    // After timer fires, offset should be approximately 0 for 100%
    expect(parseFloat(dashoffset || "0")).toBeCloseTo(0, 1);

    vi.useRealTimers();
  });

  // Test 6: Percentage > 100 is capped at 100
  it("caps percentage at 100 when given >100", () => {
    render(<DonutChart percent={150} color="#F37167" />);
    expect(screen.getByText("100%")).toBeInTheDocument();
  });

  // Test 7: Center label shows rounded percentage
  it("center label shows rounded percentage", () => {
    render(<DonutChart percent={33.7} color="#F37167" />);
    expect(screen.getByText("34%")).toBeInTheDocument();
  });

  // Test 8: onClick fires when clicked
  it("fires onClick when clicked", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <DonutChart percent={50} color="#F37167" onClick={handleClick} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.click(wrapper);
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  // Test 9: Cursor is pointer when onClick provided
  it("has cursor-pointer class when onClick is provided", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" onClick={() => {}} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).toContain("cursor-pointer");
  });

  // Test 10: Custom fontSize applies to center label
  it("applies custom fontSize class to center label", () => {
    render(
      <DonutChart percent={50} color="#F37167" fontSize="text-[10px]" />,
    );
    const label = screen.getByText("50%");
    expect(label.className).toContain("text-[10px]");
  });

  // ─── Accessibility & keyboard interaction tests ───

  it("sets role=button and tabIndex=0 when onClick is provided", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" onClick={() => {}} ariaLabel="Earnings goal" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveAttribute("role", "button");
    expect(wrapper).toHaveAttribute("tabindex", "0");
  });

  it("does not set role or tabIndex when onClick is not provided", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).not.toHaveAttribute("role");
    expect(wrapper).not.toHaveAttribute("tabindex");
  });

  it("sets aria-label when onClick and ariaLabel are provided", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" onClick={() => {}} ariaLabel="View Earnings" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper).toHaveAttribute("aria-label", "View Earnings");
  });

  it("fires onClick on Enter key press", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <DonutChart percent={50} color="#F37167" onClick={handleClick} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(wrapper, { key: "Enter" });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("fires onClick on Space key press", () => {
    const handleClick = vi.fn();
    const { container } = render(
      <DonutChart percent={50} color="#F37167" onClick={handleClick} />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    fireEvent.keyDown(wrapper, { key: " " });
    expect(handleClick).toHaveBeenCalledTimes(1);
  });

  it("does not have cursor-pointer class when onClick is not provided", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" />,
    );
    const wrapper = container.firstElementChild as HTMLElement;
    expect(wrapper.className).not.toContain("cursor-pointer");
  });

  it("uses default size of 100 when size prop is omitted", () => {
    const { container } = render(
      <DonutChart percent={50} color="#F37167" />,
    );
    const svg = container.querySelector("svg");
    expect(svg).toHaveAttribute("width", "100");
    expect(svg).toHaveAttribute("height", "100");
  });

  it("uses default fontSize text-base when fontSize prop is omitted", () => {
    render(<DonutChart percent={50} color="#F37167" />);
    const label = screen.getByText("50%");
    expect(label.className).toContain("text-base");
  });
});
