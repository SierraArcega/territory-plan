import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, act } from "@testing-library/react";
import { ToastProvider, useToast } from "../Toast";

function Trigger({
  message = "Saved",
  tone,
  duration,
}: {
  message?: string;
  tone?: "success" | "info" | "alert";
  duration?: number;
}) {
  const { showToast } = useToast();
  return (
    <button onClick={() => showToast(message, { tone, duration })}>
      fire
    </button>
  );
}

describe("ToastProvider / useToast", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("shows a toast when showToast is called", () => {
    render(
      <ToastProvider>
        <Trigger message="Lead accepted" tone="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    expect(screen.getByText("Lead accepted")).toBeInTheDocument();
    expect(screen.getByRole("status")).toBeInTheDocument();
  });

  it("auto-dismisses after ~3.2s", () => {
    render(
      <ToastProvider>
        <Trigger message="Saved" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();

    // Just before the deadline it is still visible
    act(() => {
      vi.advanceTimersByTime(3100);
    });
    expect(screen.getByText("Saved")).toBeInTheDocument();

    // ...and gone right after
    act(() => {
      vi.advanceTimersByTime(200);
    });
    expect(screen.queryByText("Saved")).not.toBeInTheDocument();
  });

  it("respects a custom duration", () => {
    render(
      <ToastProvider>
        <Trigger message="Quick" duration={500} />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.queryByText("Quick")).not.toBeInTheDocument();
  });

  it("stacks multiple toasts and dismisses each independently", () => {
    render(
      <ToastProvider>
        <Trigger message="First" duration={1000} />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    act(() => {
      vi.advanceTimersByTime(500);
    });
    act(() => {
      screen.getByText("fire").click();
    });
    // Two stacked toasts
    expect(screen.getAllByText("First")).toHaveLength(2);
    // First expires, second remains
    act(() => {
      vi.advanceTimersByTime(600);
    });
    expect(screen.getAllByText("First")).toHaveLength(1);
  });

  it("dismisses on click", () => {
    render(
      <ToastProvider>
        <Trigger message="Click me away" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    act(() => {
      screen.getByText("Click me away").closest("button")!.click();
    });
    expect(screen.queryByText("Click me away")).not.toBeInTheDocument();
  });

  it("renders the plum card with the alert-tone icon tint", () => {
    render(
      <ToastProvider>
        <Trigger message="Something failed" tone="alert" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    const card = screen.getByText("Something failed").closest("button")!;
    expect(card.className).toContain("bg-[#403770]");
    expect(card.className).toContain("text-white");
    expect(card.querySelector(".text-\\[\\#F7C9C5\\]")).not.toBeNull();
  });

  it("tones differentiate via icon color on the same plum card", () => {
    render(
      <ToastProvider>
        <Trigger message="All good" tone="success" />
      </ToastProvider>,
    );
    act(() => {
      screen.getByText("fire").click();
    });
    const card = screen.getByText("All good").closest("button")!;
    expect(card.className).toContain("bg-[#403770]");
    expect(card.querySelector(".text-\\[\\#9FE0B0\\]")).not.toBeNull();
  });

  it("throws when useToast is used outside the provider", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Trigger />)).toThrow(
      "useToast must be used within a <ToastProvider>",
    );
    spy.mockRestore();
  });
});
