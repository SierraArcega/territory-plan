import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { AnswerBlock } from "../AnswerBlock";

describe("AnswerBlock", () => {
  it("hides id columns and shows the View-on-map button when leaids are present", () => {
    const onViewOnMap = vi.fn();
    render(
      <AnswerBlock
        answer={{ columns: ["leaid", "name"], rows: [{ leaid: "1900001", name: "Lake Mills" }], rowCount: 1 }}
        onViewOnMap={onViewOnMap}
      />,
    );
    expect(screen.queryByText("leaid")).toBeNull();
    expect(screen.getByText("name")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /view .* on the map/i }));
    expect(onViewOnMap).toHaveBeenCalledTimes(1);
  });

  it("shows no map button when there is no leaid column", () => {
    render(
      <AnswerBlock
        answer={{ columns: ["name"], rows: [{ name: "Lake Mills" }], rowCount: 1 }}
        onViewOnMap={vi.fn()}
      />,
    );
    expect(screen.queryByRole("button", { name: /view .* on the map/i })).toBeNull();
  });
});
