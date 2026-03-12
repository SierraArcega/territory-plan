import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ScreenReaderOnly, srOnlyClass } from "../screen-reader";

describe("ScreenReaderOnly", () => {
  it("renders children", () => {
    render(<ScreenReaderOnly>Hidden label</ScreenReaderOnly>);
    expect(screen.getByText("Hidden label")).toBeTruthy();
  });

  it("applies sr-only styles", () => {
    const { container } = render(
      <ScreenReaderOnly>Hidden</ScreenReaderOnly>,
    );
    const el = container.firstElementChild as HTMLElement;
    // Check for clip-rect technique
    expect(el.style.position).toBe("absolute");
    expect(el.style.width).toBe("1px");
    expect(el.style.height).toBe("1px");
  });

  it("renders as custom element type", () => {
    const { container } = render(
      <ScreenReaderOnly as="h2">Heading</ScreenReaderOnly>,
    );
    expect(container.querySelector("h2")).toBeTruthy();
  });

  it("renders as span by default", () => {
    const { container } = render(
      <ScreenReaderOnly>Text</ScreenReaderOnly>,
    );
    expect(container.querySelector("span")).toBeTruthy();
  });
});

describe("srOnlyClass", () => {
  it("is a non-empty string", () => {
    expect(typeof srOnlyClass).toBe("string");
    expect(srOnlyClass.length).toBeGreaterThan(0);
  });
});
