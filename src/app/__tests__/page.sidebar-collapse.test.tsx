import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { render } from "@testing-library/react";
import { useMapStore } from "@/features/shared/lib/app-store";

// ── Stub out every heavy dependency page.tsx pulls in ──────────────────────
vi.mock("next/navigation", () => ({
  useRouter: () => ({ push: vi.fn(), replace: vi.fn() }),
  useSearchParams: () => new URLSearchParams(),
}));
vi.mock("@/features/shared/lib/queries", () => ({
  useProfile: () => ({ data: null, isLoading: false }),
}));
vi.mock("next/dynamic", () => ({
  default: (_fn: unknown) => () => null,
}));
vi.mock("@/features/shared/components/layout/AppShell", () => ({
  default: () => null,
}));
vi.mock("@/features/shared/components/navigation/Sidebar", () => ({
  default: () => null,
}));
vi.mock("@/features/map/components/MapV2Shell", () => ({ default: () => null }));
vi.mock("@/features/shared/components/views/PlansView", () => ({ default: () => null }));
vi.mock("@/features/shared/components/views/ActivitiesView", () => ({ default: () => null }));
vi.mock("@/features/shared/components/views/TasksView", () => ({ default: () => null }));
vi.mock("@/features/home/components/HomeView", () => ({ default: () => null }));
vi.mock("@/features/shared/components/views/ProfileView", () => ({ default: () => null }));
vi.mock("@/features/admin/components/AdminDashboard", () => ({ default: () => null }));
vi.mock("@/features/shared/components/views/ResourcesView", () => ({ default: () => null }));
vi.mock("@/features/leaderboard/components/LeaderboardDetailView", () => ({ default: () => null }));
vi.mock("@/features/reports/components/ReportsTab", () => ({ ReportsTab: () => null }));
vi.mock("@/features/leaderboard/components/LowHangingFruitView", () => ({ default: () => null }));
// ───────────────────────────────────────────────────────────────────────────

import Page from "../page";

describe("page.tsx — sidebar auto-collapse on mobile", () => {
  const originalInnerWidth = window.innerWidth;

  beforeEach(() => {
    useMapStore.setState({ sidebarCollapsed: false });
  });

  afterEach(() => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: originalInnerWidth,
    });
  });

  it("collapses sidebar on mount when viewport is narrow (< 768 px)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 390,
    });
    render(<Page />);
    expect(useMapStore.getState().sidebarCollapsed).toBe(true);
  });

  it("leaves sidebar expanded on mount when viewport is wide (>= 768 px)", () => {
    Object.defineProperty(window, "innerWidth", {
      writable: true,
      configurable: true,
      value: 1280,
    });
    render(<Page />);
    expect(useMapStore.getState().sidebarCollapsed).toBe(false);
  });
});
