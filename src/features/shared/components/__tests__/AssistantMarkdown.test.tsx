import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { AssistantMarkdown } from "../AssistantMarkdown";

describe("AssistantMarkdown", () => {
  it("renders **bold** as <strong>, not literal asterisks", () => {
    const { container } = render(<AssistantMarkdown text="Your **plans** matter" />);
    expect(container.querySelector("strong")?.textContent).toBe("plans");
    expect(container.textContent).not.toContain("**");
  });

  it("renders '- ' lines as a bulleted list (no leading dashes shown)", () => {
    const { container } = render(<AssistantMarkdown text={"Options:\n- one\n- two"} />);
    const items = container.querySelectorAll("ul li");
    expect(items.length).toBe(2);
    expect(items[0]?.textContent).toBe("one");
    expect(container.textContent).not.toContain("- one");
  });

  it("renders '1.' lines as a numbered list", () => {
    const { container } = render(<AssistantMarkdown text={"1. first\n2. second"} />);
    expect(container.querySelectorAll("ol li").length).toBe(2);
  });
});
