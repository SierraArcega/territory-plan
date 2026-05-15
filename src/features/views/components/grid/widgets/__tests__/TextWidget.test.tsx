import { render, screen, fireEvent, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { TextWidget } from "../TextWidget";

const widget = { kind: "text" as const };

describe("TextWidget", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("renders with initial value populated in input", () => {
    render(
      <TextWidget
        widget={widget}
        value="hello"
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText(/search/i)).toHaveValue("hello");
  });

  it("renders with empty input when value is null", () => {
    render(
      <TextWidget
        widget={widget}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    expect(screen.getByPlaceholderText(/search/i)).toHaveValue("");
  });

  it("typing updates the input value immediately", () => {
    render(
      <TextWidget
        widget={widget}
        value={null}
        onApply={() => {}}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "foo" } });
    expect(input).toHaveValue("foo");
  });

  it("fires onApply with the typed text after 300ms", async () => {
    const onApply = vi.fn();
    render(
      <TextWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "bar" },
    });
    expect(onApply).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith("bar");
  });

  it("rapid typing within 300ms collapses to one onApply call", async () => {
    const onApply = vi.fn();
    render(
      <TextWidget
        widget={widget}
        value={null}
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    const input = screen.getByPlaceholderText(/search/i);
    fireEvent.change(input, { target: { value: "a" } });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.change(input, { target: { value: "ab" } });
    act(() => {
      vi.advanceTimersByTime(100);
    });
    fireEvent.change(input, { target: { value: "abc" } });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onApply).toHaveBeenCalledTimes(1);
    expect(onApply).toHaveBeenCalledWith("abc");
  });

  it("does not fire onApply when text matches the initial value", async () => {
    const onApply = vi.fn();
    render(
      <TextWidget
        widget={widget}
        value="existing"
        onApply={onApply}
        onCancel={() => {}}
      />,
    );
    // Simulate typing the same value back — the diff check should suppress the call
    fireEvent.change(screen.getByPlaceholderText(/search/i), {
      target: { value: "existing" },
    });
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(onApply).not.toHaveBeenCalled();
  });

  it("Cancel fires onCancel callback", () => {
    const onCancel = vi.fn();
    render(
      <TextWidget
        widget={widget}
        value={null}
        onApply={() => {}}
        onCancel={onCancel}
      />,
    );
    fireEvent.click(screen.getByRole("button", { name: /cancel/i }));
    expect(onCancel).toHaveBeenCalledTimes(1);
  });
});
