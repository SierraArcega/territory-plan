import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { NumberRangeWidget } from "../NumberRangeWidget";

describe("NumberRangeWidget", () => {
  const widget = {
    kind: "numberRange" as const,
    min: 0,
    presets: [
      { label: "$0–$50k", range: [0, 50_000] as readonly [number, number] },
      { label: "$1M+", range: [1_000_000, Number.MAX_SAFE_INTEGER] as readonly [number, number] },
    ],
  };

  it("renders min/max inputs with current value", () => {
    render(
      <NumberRangeWidget
        widget={widget}
        value={{ min: 100, max: 500 }}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText("Min")).toHaveValue(100);
    expect(screen.getByPlaceholderText("Max")).toHaveValue(500);
  });

  it("applies a preset on click", () => {
    render(
      <NumberRangeWidget
        widget={widget}
        value={{ min: null, max: null }}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("$0–$50k"));
    expect(screen.getByPlaceholderText("Min")).toHaveValue(0);
    expect(screen.getByPlaceholderText("Max")).toHaveValue(50000);
  });

  it("preset with MAX_SAFE_INTEGER leaves max input empty", () => {
    render(
      <NumberRangeWidget
        widget={widget}
        value={{ min: null, max: null }}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("$1M+"));
    expect(screen.getByPlaceholderText("Min")).toHaveValue(1000000);
    expect(screen.getByPlaceholderText("Max")).toHaveValue(null);
  });

  it("Apply emits {min, max} numbers when both set", () => {
    const onApply = vi.fn();
    render(
      <NumberRangeWidget
        widget={widget}
        value={{ min: null, max: null }}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Min"), { target: { value: "5" } });
    fireEvent.change(screen.getByPlaceholderText("Max"), { target: { value: "10" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith({ min: 5, max: 10 });
  });

  it("Apply emits null for empty side", () => {
    const onApply = vi.fn();
    render(
      <NumberRangeWidget
        widget={widget}
        value={{ min: null, max: null }}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText("Min"), { target: { value: "5" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith({ min: 5, max: null });
  });

  it("Cancel fires without applying", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <NumberRangeWidget
        widget={widget}
        value={{ min: null, max: null }}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
