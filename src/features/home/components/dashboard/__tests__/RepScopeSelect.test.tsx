import { describe, it, expect, vi } from "vitest";
import { render, screen } from "@testing-library/react";
import RepScopeSelect from "../RepScopeSelect";

// Mutable state so we can flip isLoading between tests.
const mockState = {
  data: [
    { id: "me", fullName: "Me", avatarUrl: null },
    { id: "u2", fullName: "Bob", avatarUrl: null },
  ] as { id: string; fullName: string | null; avatarUrl: string | null }[] | undefined,
  isLoading: false,
};

vi.mock("@/features/home/lib/queries", () => ({
  useActiveReps: () => mockState,
}));

describe("RepScopeSelect — loaded", () => {
  it("renders Whole team + each rep, value controlled", () => {
    mockState.data = [
      { id: "me", fullName: "Me", avatarUrl: null },
      { id: "u2", fullName: "Bob", avatarUrl: null },
    ];
    mockState.isLoading = false;

    render(<RepScopeSelect value="me" onChange={() => {}} />);
    const select = screen.getByRole("combobox") as HTMLSelectElement;
    expect([...select.options].map((o) => o.textContent)).toEqual(["Whole team", "Me", "Bob"]);
    expect(select.value).toBe("me");
  });
});

describe("RepScopeSelect — loading", () => {
  it("renders a disabled combobox while the roster is loading", () => {
    mockState.data = undefined;
    mockState.isLoading = true;

    render(<RepScopeSelect value="team" onChange={() => {}} />);
    expect(screen.getByRole("combobox")).toBeDisabled();
  });
});
