import { render, screen, fireEvent } from "@testing-library/react";
import { describe, it, expect, vi } from "vitest";
import { DateRangeWidget } from "../DateRangeWidget";

describe("DateRangeWidget", () => {
  const widget = {
    kind: "dateRange" as const,
    relativeChips: ["7d", "30d", "90d", "qtd", "ytd"] as const,
  };

  it("renders custom from/to date inputs", () => {
    render(
      <DateRangeWidget
        widget={widget}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByLabelText("From")).toBeInTheDocument();
    expect(screen.getByLabelText("To")).toBeInTheDocument();
  });

  it("renders relative chips when relativeChips is provided", () => {
    render(
      <DateRangeWidget
        widget={widget}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByText("Last 7 days")).toBeInTheDocument();
    expect(screen.getByText("Last 30 days")).toBeInTheDocument();
    expect(screen.getByText("Last 90 days")).toBeInTheDocument();
    expect(screen.getByText("QTD")).toBeInTheDocument();
    expect(screen.getByText("YTD")).toBeInTheDocument();
  });

  it("clicking 7d chip immediately emits { kind: 'within', value: '7 days' }", () => {
    const onApply = vi.fn();
    render(
      <DateRangeWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Last 7 days"));
    expect(onApply).toHaveBeenCalledWith({ kind: "within", value: "7 days" });
  });

  it("clicking 30d chip immediately emits { kind: 'within', value: '30 days' }", () => {
    const onApply = vi.fn();
    render(
      <DateRangeWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.click(screen.getByText("Last 30 days"));
    expect(onApply).toHaveBeenCalledWith({ kind: "within", value: "30 days" });
  });

  it("custom from/to range emits { kind: 'between', from, to } on Apply", () => {
    const onApply = vi.fn();
    render(
      <DateRangeWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByLabelText("From"), { target: { value: "2025-01-01" } });
    fireEvent.change(screen.getByLabelText("To"), { target: { value: "2025-12-31" } });
    fireEvent.click(screen.getByText("Apply"));
    expect(onApply).toHaveBeenCalledWith({ kind: "between", from: "2025-01-01", to: "2025-12-31" });
  });

  it("Cancel fires without applying", () => {
    const onApply = vi.fn();
    const onCancel = vi.fn();
    render(
      <DateRangeWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByText("Cancel"));
    expect(onCancel).toHaveBeenCalled();
    expect(onApply).not.toHaveBeenCalled();
  });
});
