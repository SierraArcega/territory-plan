import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render, screen, fireEvent, act } from "@testing-library/react";
import ProfileSidebar from "../ProfileSidebar";

// ── Mocks ────────────────────────────────────────────────────────────────────

vi.mock("@/lib/api", () => ({
  useProfile: () => ({
    data: {
      fullName: "Aston Arcega",
      email: "aston@test.com",
      jobTitle: "RevOps Engineer",
      avatarUrl: null,
      phone: null,
      location: null,
      lastLoginAt: null,
    },
    isLoading: false,
  }),
  useCreateTerritoryPlan: () => ({ mutateAsync: vi.fn() }),
}));

vi.mock("@/features/calendar/lib/queries", () => ({
  useCalendarConnection: () => ({ data: null, isLoading: false }),
}));

vi.mock("@/features/shared/lib/app-store", () => ({
  useMapStore: (selector: (s: Record<string, unknown>) => unknown) =>
    selector({ setActiveTab: vi.fn() }),
}));

vi.mock("@/features/leaderboard/components/LeaderboardHomeWidget", () => ({
  default: () => null,
}));

vi.mock("@/features/leaderboard/components/LeaderboardModal", () => ({
  default: () => null,
}));

vi.mock("@/features/plans/components/PlanFormModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="plan-modal-open" /> : null,
}));

vi.mock("@/features/activities/components/ActivityFormModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="activity-modal-open" /> : null,
}));

vi.mock("@/features/tasks/components/TaskFormModal", () => ({
  default: ({ isOpen }: { isOpen: boolean }) =>
    isOpen ? <div data-testid="task-modal-open" /> : null,
}));

// ── Helpers ──────────────────────────────────────────────────────────────────

function renderSidebar() {
  return render(<ProfileSidebar />);
}

// ── Tests ────────────────────────────────────────────────────────────────────

describe("ProfileSidebar collapse", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    localStorage.clear();
    // jsdom defaults innerWidth to 0; set a desktop width so tests default to expanded
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: originalInnerWidth });
  });

  it("renders a collapse chevron button when expanded", () => {
    renderSidebar();
    expect(
      screen.getByRole("button", { name: /collapse sidebar/i })
    ).toBeInTheDocument();
  });

  it("shows full sidebar content by default", () => {
    renderSidebar();
    expect(screen.getByText("Aston Arcega")).toBeInTheDocument();
  });

  it("clicking collapse hides full content and shows icon strip", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(screen.queryByText("Aston Arcega")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand sidebar/i })
    ).toBeInTheDocument();
  });

  it("clicking expand chevron in strip restores full content", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    fireEvent.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(screen.getByText("Aston Arcega")).toBeInTheDocument();
  });

  it("clicking avatar in strip restores full content", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    fireEvent.click(screen.getByRole("button", { name: /expand via avatar/i }));
    expect(screen.getByText("Aston Arcega")).toBeInTheDocument();
  });

  it("clicking Create Plan icon in strip opens plan modal", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    expect(screen.getByTestId("plan-modal-open")).toBeInTheDocument();
  });

  it("clicking Log Activity icon in strip opens activity modal", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    fireEvent.click(screen.getByRole("button", { name: /log activity/i }));
    expect(screen.getByTestId("activity-modal-open")).toBeInTheDocument();
  });

  it("clicking Create Task icon in strip opens task modal", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    fireEvent.click(screen.getByRole("button", { name: /create task/i }));
    expect(screen.getByTestId("task-modal-open")).toBeInTheDocument();
  });

  it("strip stays collapsed after clicking an action icon", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    fireEvent.click(screen.getByRole("button", { name: /create plan/i }));
    expect(screen.queryByText("Aston Arcega")).not.toBeInTheDocument();
  });

  it("saves collapsed=true to localStorage on collapse", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    expect(localStorage.getItem("home-sidebar-collapsed")).toBe("true");
  });

  it("saves collapsed=false to localStorage on expand", () => {
    renderSidebar();
    fireEvent.click(screen.getByRole("button", { name: /collapse sidebar/i }));
    fireEvent.click(screen.getByRole("button", { name: /expand sidebar/i }));
    expect(localStorage.getItem("home-sidebar-collapsed")).toBe("false");
  });

  it("starts collapsed when localStorage has collapsed=true", () => {
    localStorage.setItem("home-sidebar-collapsed", "true");
    renderSidebar();
    expect(screen.queryByText("Aston Arcega")).not.toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: /expand sidebar/i })
    ).toBeInTheDocument();
  });

  it("starts expanded when localStorage has collapsed=false", () => {
    localStorage.setItem("home-sidebar-collapsed", "false");
    renderSidebar();
    expect(screen.getByText("Aston Arcega")).toBeInTheDocument();
  });

  it("auto-collapses on narrow viewport (< 768px) regardless of localStorage", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });
    renderSidebar();
    expect(screen.queryByText("Aston Arcega")).not.toBeInTheDocument();
    expect(screen.getByRole("button", { name: /expand sidebar/i })).toBeInTheDocument();
  });

  it("collapses reactively when window resizes below 768px", () => {
    renderSidebar();
    expect(screen.getByText("Aston Arcega")).toBeInTheDocument();
    act(() => {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByText("Aston Arcega")).not.toBeInTheDocument();
  });

  it("does not auto-expand when window resizes above 768px", () => {
    Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 390 });
    renderSidebar();
    act(() => {
      Object.defineProperty(window, "innerWidth", { writable: true, configurable: true, value: 1280 });
      window.dispatchEvent(new Event("resize"));
    });
    expect(screen.queryByText("Aston Arcega")).not.toBeInTheDocument();
  });
});
