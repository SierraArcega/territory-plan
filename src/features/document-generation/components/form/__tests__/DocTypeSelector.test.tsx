import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import DocTypeSelector from "../DocTypeSelector";

describe("DocTypeSelector", () => {
  it("emits the chosen doc type", () => {
    const onChange = vi.fn();
    render(<DocTypeSelector value="contract" onChange={onChange} />);
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "boces_quote" } });
    expect(onChange).toHaveBeenCalledWith("boces_quote");
  });
});
