import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { CopilotNavButton } from "../CopilotNavButton";

const setCopilotOpen = vi.fn();
vi.mock("@/features/shared/lib/app-store", () => ({
  useMapStore: (sel: (s: { setCopilotOpen: (v: boolean) => void }) => unknown) =>
    sel({ setCopilotOpen }),
}));

describe("CopilotNavButton", () => {
  it("opens the copilot rail on click and shows its label when expanded", () => {
    render(<CopilotNavButton collapsed={false} />);
    expect(screen.getByText("Copilot")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: /copilot/i }));
    expect(setCopilotOpen).toHaveBeenCalledWith(true);
  });
});
