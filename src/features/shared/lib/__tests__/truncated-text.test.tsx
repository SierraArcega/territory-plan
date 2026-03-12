import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { TruncatedText } from "../truncated-text";

describe("TruncatedText", () => {
  it("renders the text content", () => {
    render(<TruncatedText text="Hello World" />);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });

  it("applies truncation CSS classes", () => {
    const { container } = render(<TruncatedText text="Hello World" />);
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("truncate");
  });

  it("sets title attribute for tooltip", () => {
    const { container } = render(
      <TruncatedText text="A very long district name that should be truncated" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.getAttribute("title")).toBe(
      "A very long district name that should be truncated",
    );
  });

  it("accepts custom className", () => {
    const { container } = render(
      <TruncatedText text="Hello" className="text-sm" />,
    );
    const el = container.firstElementChild as HTMLElement;
    expect(el.className).toContain("text-sm");
  });
});
