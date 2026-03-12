import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { Highlight } from "../highlight";

describe("Highlight", () => {
  it("renders plain text when query is empty", () => {
    render(<Highlight text="Hello World" query="" />);
    expect(screen.getByText("Hello World")).toBeTruthy();
    expect(screen.queryByRole("mark")).toBeNull();
  });

  it("wraps matching text in mark elements", () => {
    const { container } = render(
      <Highlight text="Springfield School District" query="spring" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("Spring");
  });

  it("is case-insensitive", () => {
    const { container } = render(
      <Highlight text="Springfield" query="SPRING" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("Spring");
  });

  it("highlights multiple occurrences", () => {
    const { container } = render(
      <Highlight text="an apple and an orange" query="an" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks.length).toBeGreaterThanOrEqual(3); // "an" in "an", "and", "an", "orange"
  });

  it("escapes regex special characters", () => {
    const { container } = render(
      <Highlight text="price is $10.00" query="$10.00" />,
    );
    const marks = container.querySelectorAll("mark");
    expect(marks).toHaveLength(1);
    expect(marks[0].textContent).toBe("$10.00");
  });

  it("applies brand styling to mark elements", () => {
    const { container } = render(
      <Highlight text="Hello World" query="hello" />,
    );
    const mark = container.querySelector("mark");
    expect(mark?.className).toContain("bg-[#C4E7E6]");
    expect(mark?.className).toContain("text-[#403770]");
  });

  it("returns plain text when no match found", () => {
    render(<Highlight text="Hello World" query="xyz" />);
    expect(screen.getByText("Hello World")).toBeTruthy();
  });
});
