import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import NumberInput from "../NumberInput";

describe("NumberInput", () => {
  it("focus selects the input content (spy on select())", () => {
    // jsdom doesn't support selection APIs for type="number"; spy instead.
    const selectSpy = vi.spyOn(HTMLInputElement.prototype, "select");
    render(<NumberInput value={0} onValue={vi.fn()} aria-label="test" />);
    const input = screen.getByLabelText("test");
    fireEvent.focus(input);
    expect(selectSpy).toHaveBeenCalledTimes(1);
    selectSpy.mockRestore();
  });

  it("typing a value calls onValue with the parsed number", () => {
    const onValue = vi.fn();
    render(<NumberInput value={0} onValue={onValue} aria-label="test" />);
    const input = screen.getByLabelText("test");
    fireEvent.change(input, { target: { value: "5" } });
    expect(onValue).toHaveBeenCalledWith(5);
  });

  it("clearing the field does NOT call onValue immediately with 0, and the input shows empty", () => {
    const onValue = vi.fn();
    render(<NumberInput value={3} onValue={onValue} aria-label="test" />);
    const input = screen.getByLabelText<HTMLInputElement>("test");
    fireEvent.change(input, { target: { value: "" } });
    // onValue must not have been called with 0 yet
    expect(onValue).not.toHaveBeenCalled();
    // the raw input should display "" (draft drives the value while editing)
    expect(input.value).toBe("");
  });

  it("blur after clearing commits onValue(0) and display returns to state value", () => {
    const onValue = vi.fn();
    const { rerender } = render(<NumberInput value={3} onValue={onValue} aria-label="test" />);
    const input = screen.getByLabelText<HTMLInputElement>("test");
    fireEvent.change(input, { target: { value: "" } });
    fireEvent.blur(input);
    // blur must fire onValue(0)
    expect(onValue).toHaveBeenCalledWith(0);
    // after blur the draft is cleared; re-render with new value 0 (simulating parent update)
    rerender(<NumberInput value={0} onValue={onValue} aria-label="test" />);
    expect(input.value).toBe("0");
  });

  it("external value updates are displayed when not editing", () => {
    const onValue = vi.fn();
    const { rerender } = render(<NumberInput value={1} onValue={onValue} aria-label="test" />);
    const input = screen.getByLabelText<HTMLInputElement>("test");
    rerender(<NumberInput value={42} onValue={onValue} aria-label="test" />);
    expect(input.value).toBe("42");
  });

  it("blur without clearing does not call onValue", () => {
    const onValue = vi.fn();
    render(<NumberInput value={5} onValue={onValue} aria-label="test" />);
    const input = screen.getByLabelText("test");
    fireEvent.change(input, { target: { value: "7" } });
    onValue.mockClear();
    fireEvent.blur(input);
    expect(onValue).not.toHaveBeenCalled();
  });

  it("forwards className, step, min, max props to the underlying input", () => {
    render(
      <NumberInput value={0} onValue={vi.fn()} aria-label="test"
        className="my-class" step="0.01" min={0} max={100} />,
    );
    const input = screen.getByLabelText<HTMLInputElement>("test");
    expect(input.className).toContain("my-class");
    expect(input.step).toBe("0.01");
    expect(input.min).toBe("0");
    expect(input.max).toBe("100");
  });
});
