import { describe, it, expect } from "vitest";
import { render } from "@testing-library/react";
import { Skeleton } from "../Skeleton";

describe("Skeleton", () => {
  it("renders with text variant by default", () => {
    const { container } = render(<Skeleton />);
    const el = container.firstChild as HTMLElement;
    expect(el.className).toContain("h-4");
    expect(el.className).toContain("animate-pulse");
    expect(el.getAttribute("aria-label")).toBe("Loading");
    expect(el.getAttribute("role")).toBe("status");
  });

  it("applies card variant classes", () => {
    const { container } = render(<Skeleton variant="card" />);
    expect((container.firstChild as HTMLElement).className).toContain("h-24");
  });

  it("applies thumbnail variant classes", () => {
    const { container } = render(<Skeleton variant="thumbnail" />);
    expect((container.firstChild as HTMLElement).className).toContain("h-12");
  });

  it("merges custom className", () => {
    const { container } = render(<Skeleton className="mt-4" />);
    expect((container.firstChild as HTMLElement).className).toContain("mt-4");
  });

  it("uses plum-derived neutral (no gray) for base", () => {
    const { container } = render(<Skeleton />);
    expect((container.firstChild as HTMLElement).className).toContain("#EFEDF5");
  });
});
