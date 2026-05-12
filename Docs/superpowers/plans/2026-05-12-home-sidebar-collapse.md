# Home Profile Sidebar Collapse — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a collapse chevron to the `ProfileSidebar` on the Home tab that shrinks it to a 44px icon strip, persisting state in `localStorage`.

**Architecture:** All changes are confined to `ProfileSidebar.tsx`. A `collapsed` boolean — initialised from `localStorage("home-sidebar-collapsed")` — drives conditional rendering: full sidebar content when expanded, a narrow icon strip when collapsed. The four quick-action modals remain wired in both states. The `<aside>` width transitions via CSS.

**Tech Stack:** React 19, TypeScript, Tailwind 4, Lucide React, Vitest + Testing Library (jsdom)

---

## File Map

| Action | Path |
|--------|------|
| Modify | `src/features/home/components/ProfileSidebar.tsx` |
| Create | `src/features/home/components/__tests__/ProfileSidebar.test.tsx` |

---

## Task 1: Write failing tests

**Files:**
- Create: `src/features/home/components/__tests__/ProfileSidebar.test.tsx`

- [ ] **Step 1: Create the test file**

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
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
  beforeEach(() => {
    localStorage.clear();
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
});
```

- [ ] **Step 2: Run tests to verify they all fail**

```bash
npx vitest run src/features/home/components/__tests__/ProfileSidebar.test.tsx
```

Expected: 14 failures — "getByRole: unable to find button with name /collapse sidebar/i" and similar.

---

## Task 2: Add collapse state and toggle to ProfileSidebar

**Files:**
- Modify: `src/features/home/components/ProfileSidebar.tsx`

- [ ] **Step 1: Add `ChevronLeft` and `ChevronRight` to the Lucide import**

Find this line in `ProfileSidebar.tsx`:
```tsx
import {
  Calendar,
  Clock,
  Mail,
  MessageSquare,
  CircleDollarSign,
  Phone,
  MapPin,
  Check,
  Map,
  FileEdit,
  ListPlus,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
```

Replace with:
```tsx
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Clock,
  Mail,
  MessageSquare,
  CircleDollarSign,
  Phone,
  MapPin,
  Check,
  Map,
  FileEdit,
  ListPlus,
  ExternalLink,
  type LucideIcon,
} from "lucide-react";
```

- [ ] **Step 2: Add `collapsed` state and `toggle` to the `ProfileSidebar` function body**

After the existing `useState` declarations at the top of `ProfileSidebar()`, add:

```tsx
const [collapsed, setCollapsed] = useState(() => {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("home-sidebar-collapsed") === "true";
});

const toggle = () => {
  setCollapsed((prev) => {
    const next = !prev;
    localStorage.setItem("home-sidebar-collapsed", String(next));
    return next;
  });
};
```

- [ ] **Step 3: Run tests — expect partial progress (no compile errors, still failing on render assertions)**

```bash
npx vitest run src/features/home/components/__tests__/ProfileSidebar.test.tsx
```

Expected: still failing, but no TypeScript/import errors.

---

## Task 3: Add collapse chevron to the expanded sidebar

**Files:**
- Modify: `src/features/home/components/ProfileSidebar.tsx`

- [ ] **Step 1: Replace the opening `<aside>` and add the collapse chevron**

Find:
```tsx
  return (
    <aside className="w-[289px] shrink-0 border-r border-[#E2DEEC] bg-white h-full overflow-y-auto">
      <div className="px-6 pt-8">
        {/* ---- Leaderboard Widget ---- */}
        <LeaderboardHomeWidget onOpenModal={() => setShowLeaderboard(true)} />
```

Replace with:
```tsx
  return (
    <aside
      className={`shrink-0 border-r border-[#E2DEEC] bg-white h-full transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-11 overflow-hidden" : "w-[289px] overflow-y-auto"
      }`}
    >
      {!collapsed && (
      <div className="px-6 pt-4">
        {/* ---- Collapse chevron ---- */}
        <div className="flex justify-end mb-2">
          <button
            onClick={toggle}
            aria-label="Collapse sidebar"
            className="w-6 h-6 flex items-center justify-center rounded-full bg-[#F7F5FA] hover:bg-[#EFEDF5] text-[#8A80A8] hover:text-[#544A78] transition-colors cursor-pointer"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* ---- Leaderboard Widget ---- */}
        <LeaderboardHomeWidget onOpenModal={() => setShowLeaderboard(true)} />
```

- [ ] **Step 2: Close the `!collapsed` conditional block**

Find the closing `</div>` that closes `<div className="px-6 pt-8">` — it appears just before the `{/* Modals */}` comment. Replace the old outer div closing tag pattern with the new one by wrapping all expanded content in the `{!collapsed && (...)}` block.

The full updated return structure should be:

```tsx
  return (
    <aside
      className={`shrink-0 border-r border-[#E2DEEC] bg-white h-full transition-[width] duration-200 ease-in-out ${
        collapsed ? "w-11 overflow-hidden" : "w-[289px] overflow-y-auto"
      }`}
    >
      {/* ── Expanded content ── */}
      {!collapsed && (
        <div className="px-6 pt-4">
          {/* Collapse chevron */}
          <div className="flex justify-end mb-2">
            <button
              onClick={toggle}
              aria-label="Collapse sidebar"
              className="w-6 h-6 flex items-center justify-center rounded-full bg-[#F7F5FA] hover:bg-[#EFEDF5] text-[#8A80A8] hover:text-[#544A78] transition-colors cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
            </button>
          </div>

          {/* ---- Leaderboard Widget ---- */}
          <LeaderboardHomeWidget onOpenModal={() => setShowLeaderboard(true)} />

          {/* ---- User Avatar + Info ---- */}
          <div className="flex flex-col items-center mb-6">
            {isLoading ? (
              <div className="w-[88px] h-[88px] rounded-full bg-[#EFEDF5] animate-pulse" />
            ) : profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt={displayName}
                className="w-[88px] h-[88px] rounded-full object-cover shadow-sm"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-[88px] h-[88px] rounded-full flex items-center justify-center bg-coral shadow-sm">
                <span className="text-2xl font-bold text-white">{initials}</span>
              </div>
            )}
            <h2 className="mt-4 text-xl font-bold text-plum text-center">
              {isLoading ? (
                <span className="inline-block w-32 h-5 bg-[#EFEDF5] rounded-lg animate-pulse" />
              ) : (
                displayName
              )}
            </h2>
            {jobTitle && (
              <p className="mt-1 text-sm font-medium text-[#8A80A8] text-center">
                {jobTitle}
              </p>
            )}

            {/* ---- Quick Actions ---- */}
            <div className="mt-4 self-stretch">
              <div className="grid grid-cols-2 gap-2">
                <QuickActionButton icon={Map} label="Create Plan" onClick={() => setShowPlanModal(true)} />
                <QuickActionButton icon={FileEdit} label="Log Activity" onClick={() => setShowActivityModal(true)} />
                <QuickActionButton icon={ListPlus} label="Create Task" onClick={() => setShowTaskModal(true)} />
                <QuickActionButton
                  icon={ExternalLink}
                  label="Create Opp"
                  onClick={() => window.open("https://lms.fullmindlearning.com/opportunities/kanban?school_year=2025-26", "_blank")}
                />
              </div>
            </div>
          </div>

          {/* ---- Integrations ---- */}
          <div className="mt-6">
            <p className="text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider">
              Integrations
            </p>
            <div className="mt-3 flex items-center gap-2.5">
              {INTEGRATIONS.map((integration, i) => (
                <IntegrationChip key={integration.name} integration={integration} alignRight={i >= 2} />
              ))}
            </div>
          </div>

          {/* ---- Divider ---- */}
          <div className="h-px bg-[#E2DEEC] mt-6" />

          {/* ---- Contact Details ---- */}
          {!isLoading && (profile?.email || profile?.phone || profile?.location) && (
            <div className="mt-6 pb-8 flex flex-col gap-1.5 text-[#A69DC0]">
              {profile?.email && (
                <div className="flex items-center gap-2">
                  <Mail className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium text-[#8A80A8]">{profile.email}</span>
                </div>
              )}
              {profile?.phone && (
                <div className="flex items-center gap-2">
                  <Phone className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium text-[#8A80A8]">{profile.phone}</span>
                </div>
              )}
              {profile?.location && (
                <div className="flex items-center gap-2">
                  <MapPin className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium text-[#8A80A8]">{profile.location}</span>
                </div>
              )}
              {profile?.lastLoginAt && (
                <div className="flex items-center gap-2">
                  <Clock className="w-3.5 h-3.5 shrink-0" />
                  <span className="text-xs font-medium text-[#8A80A8]">{relativeTime(profile.lastLoginAt)}</span>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* ── Collapsed icon strip ── */}
      {collapsed && (
        <div>STRIP_PLACEHOLDER</div>
      )}

      {/* Modals */}
      <PlanFormModal
        isOpen={showPlanModal}
        onClose={() => setShowPlanModal(false)}
        onSubmit={async (data: PlanFormData) => {
          await createPlan.mutateAsync({ ...data, ownerId: data.ownerId ?? undefined });
          setShowPlanModal(false);
        }}
      />
      <ActivityFormModal
        isOpen={showActivityModal}
        onClose={() => setShowActivityModal(false)}
      />
      <TaskFormModal
        isOpen={showTaskModal}
        onClose={() => setShowTaskModal(false)}
      />

      {/* Leaderboard modal */}
      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        onNavigateToDetails={handleNavigateToDetails}
      />
    </aside>
  );
```

- [ ] **Step 3: Run tests — expect collapse/expand and localStorage tests to pass now**

```bash
npx vitest run src/features/home/components/__tests__/ProfileSidebar.test.tsx
```

Expected: the collapse button, hide/show content, and localStorage tests pass. Strip-related tests still fail.

---

## Task 4: Build the icon strip

**Files:**
- Modify: `src/features/home/components/ProfileSidebar.tsx`

- [ ] **Step 1: Replace the `STRIP_PLACEHOLDER` block with the real icon strip**

Find:
```tsx
      {/* ── Collapsed icon strip ── */}
      {collapsed && (
        <div>STRIP_PLACEHOLDER</div>
      )}
```

Replace with:
```tsx
      {/* ── Collapsed icon strip ── */}
      {collapsed && (
        <div className="flex flex-col items-center py-3 gap-2">
          {/* Expand chevron */}
          <button
            onClick={toggle}
            aria-label="Expand sidebar"
            className="w-7 h-7 flex items-center justify-center rounded-full bg-[#F7F5FA] hover:bg-[#EFEDF5] text-[#544A78] transition-colors cursor-pointer"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>

          {/* Avatar — click expands */}
          <button
            onClick={toggle}
            aria-label="Expand via avatar"
            className="w-8 h-8 rounded-full overflow-hidden shrink-0 cursor-pointer"
          >
            {profile?.avatarUrl ? (
              <img
                src={profile.avatarUrl}
                alt=""
                className="w-full h-full object-cover"
                referrerPolicy="no-referrer"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-coral">
                <span className="text-xs font-bold text-white">{initials}</span>
              </div>
            )}
          </button>

          {/* Divider */}
          <div className="w-5 h-px bg-[#E2DEEC]" />

          {/* Quick-action icons */}
          {[
            { icon: Map, label: "Create Plan", onClick: () => setShowPlanModal(true) },
            { icon: FileEdit, label: "Log Activity", onClick: () => setShowActivityModal(true) },
            { icon: ListPlus, label: "Create Task", onClick: () => setShowTaskModal(true) },
            {
              icon: ExternalLink,
              label: "Create Opp",
              onClick: () =>
                window.open(
                  "https://lms.fullmindlearning.com/opportunities/kanban?school_year=2025-26",
                  "_blank"
                ),
            },
          ].map(({ icon: Icon, label, onClick }) => (
            <div key={label} className="relative group">
              <button
                onClick={onClick}
                aria-label={label}
                className="w-8 h-8 flex items-center justify-center rounded-lg bg-[#F7F5FA] hover:bg-[#EFEDF5] text-[#8A80A8] hover:text-[#544A78] transition-colors cursor-pointer"
              >
                <Icon className="w-3.5 h-3.5" />
              </button>
              <span className="absolute left-full ml-2 top-1/2 -translate-y-1/2 px-2 py-1 rounded-lg bg-plum text-[10px] font-medium text-white whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity duration-100 pointer-events-none z-50">
                {label}
              </span>
            </div>
          ))}
        </div>
      )}
```

- [ ] **Step 2: Run all tests — expect full suite to pass**

```bash
npx vitest run src/features/home/components/__tests__/ProfileSidebar.test.tsx
```

Expected: all 14 tests pass.

- [ ] **Step 3: Run the full test suite to check for regressions**

```bash
npm test
```

Expected: all pre-existing tests still pass.

- [ ] **Step 4: Commit**

```bash
git add src/features/home/components/ProfileSidebar.tsx src/features/home/components/__tests__/ProfileSidebar.test.tsx
git commit -m "feat(home): collapsible profile sidebar with icon strip"
```

---

## Self-review checklist

- Spec §Trigger: collapse chevron (`‹`) at top-right of expanded sidebar — covered Task 3
- Spec §Collapsed state — avatar, divider, 4 icons, expand chevron — covered Task 4
- Spec §Icons fire action directly — `onClick` handlers on strip icons open modals — covered Task 4
- Spec §Tooltips — `group-hover` tooltip pattern on each strip icon — covered Task 4
- Spec §Animation — `transition-[width] duration-200 ease-in-out` on `<aside>` — covered Task 3
- Spec §Persistence — `localStorage("home-sidebar-collapsed")` read on mount, write on toggle — covered Task 2
- Spec §LeaderboardWidget hidden when collapsed — inside `{!collapsed && ...}` block — covered Task 3
- Spec §Modals remain mounted — modals rendered outside the conditional blocks — covered Task 3
- aria-labels match between tests and implementation: `"Collapse sidebar"`, `"Expand sidebar"`, `"Expand via avatar"`, `"Create Plan"`, `"Log Activity"`, `"Create Task"` — consistent throughout
