# Bulk Selection & Actions — Plan Districts Table — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add per-row checkboxes, a selection bar, and a Bulk Actions dropdown (Find Contacts, Export CSV, Remove from plan) to the GridView districts table inside a plan.

**Architecture:** Selection state lives in `GridView` as a discriminated union (`none | explicit | all-filtered`). Three new component files handle the dropdown, find-contacts sub-popover, and CSV export. Three backend changes add bulk-remove, leaids-scoped enrichment, and an unpaginated export endpoint. The `ContactsActionBar` enrichment logic is extracted into a shared hook first so the new popover can reuse it without duplication.

**Tech Stack:** Next.js App Router · React 19 · TanStack Query v5 · TanStack Table v8 · Prisma · PostgreSQL · Vitest + Testing Library · Tailwind 4 · Lucide icons

---

## File Map

**New files:**
| File | Purpose |
|---|---|
| `src/features/plans/lib/enrich-flow.ts` | Shared hook extracted from `ContactsActionBar` |
| `src/features/views/components/grid/actions/BulkActionsMenu.tsx` | Dropdown trigger + three bulk actions |
| `src/features/views/components/grid/actions/FindContactsPopover.tsx` | Role selector for bulk contact enrichment |
| `src/app/api/territory-plans/[id]/districts/export/route.ts` | Unpaginated district export |
| Test files for each of the above | |

**Modified files:**
| File | Change |
|---|---|
| `src/features/plans/components/ContactsActionBar.tsx` | Consume `useBulkEnrichFlow` hook |
| `src/features/plans/lib/queries.ts` | Add `useBulkRemoveDistrictsFromPlan`; extend `useBulkEnrich` with optional `leaids` |
| `src/app/api/territory-plans/[id]/districts/route.ts` | Add `DELETE` handler for bulk remove |
| `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts` | Accept optional `leaids?: string[]` |
| `src/features/views/components/grid/GridView.tsx` | Selection state, checkbox column, selection bar, `BulkActionsMenu` |

---

## Task 1: Extract `useBulkEnrichFlow` shared hook

Extract the enrichment state machine from `ContactsActionBar` into a reusable hook. `ContactsActionBar` then becomes a thin consumer. This enables `FindContactsPopover` (Task 6) to reuse the same logic without duplication.

**Files:**
- Create: `src/features/plans/lib/enrich-flow.ts`
- Modify: `src/features/plans/components/ContactsActionBar.tsx`
- Test: `src/features/plans/lib/__tests__/enrich-flow.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/features/plans/lib/__tests__/enrich-flow.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useBulkEnrichFlow } from "../enrich-flow";
import React from "react";

const mockBulkEnrich = vi.fn();
const mockExpandRollup = vi.fn();

vi.mock("../queries", () => ({
  useBulkEnrich: () => ({ mutateAsync: mockBulkEnrich, isPending: false }),
  useExpandRollup: () => ({ mutateAsync: mockExpandRollup, isPending: false }),
  useEnrichProgress: () => ({ data: undefined }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

describe("useBulkEnrichFlow", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("starts not enriching and with no toast", () => {
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    expect(result.current.isEnriching).toBe(false);
    expect(result.current.toast).toBeNull();
    expect(result.current.modalState).toBeNull();
  });

  it("sets isEnriching on successful enrich start", async () => {
    mockBulkEnrich.mockResolvedValueOnce({ queued: 5, skipped: 0, total: 5 });
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    await act(async () => {
      await result.current.handleStartEnrichment({
        targetRole: "Superintendent",
      });
    });
    expect(result.current.isEnriching).toBe(true);
    expect(result.current.toast?.type).toBe("info");
  });

  it("shows info toast when queued=0 and no skip", async () => {
    mockBulkEnrich.mockResolvedValueOnce({
      queued: 0,
      skipped: 0,
      total: 0,
      reason: "no-districts",
    });
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    await act(async () => {
      await result.current.handleStartEnrichment({
        targetRole: "Superintendent",
      });
    });
    expect(result.current.isEnriching).toBe(false);
    expect(result.current.toast?.type).toBe("info");
    expect(result.current.toast?.message).toMatch(/no districts/i);
  });

  it("passes leaids to useBulkEnrich when provided", async () => {
    mockBulkEnrich.mockResolvedValueOnce({ queued: 2, skipped: 0, total: 2 });
    const { result } = renderHook(
      () => useBulkEnrichFlow({ planId: "plan-1" }),
      { wrapper }
    );
    await act(async () => {
      await result.current.handleStartEnrichment({
        targetRole: "Principal",
        schoolLevels: new Set([1, 2]),
        leaids: ["0101010", "0202020"],
      });
    });
    expect(mockBulkEnrich).toHaveBeenCalledWith(
      expect.objectContaining({ leaids: ["0101010", "0202020"] })
    );
  });
});
```

- [ ] **Step 2: Run test — expect FAIL (module not found)**

```bash
cd "/Users/astonfurious/The Laboratory/territory-plan"
npx vitest run src/features/plans/lib/__tests__/enrich-flow.test.ts 2>&1 | tail -20
```

- [ ] **Step 3: Create `enrich-flow.ts`**

```ts
// src/features/plans/lib/enrich-flow.ts
"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useBulkEnrich, useEnrichProgress, useExpandRollup } from "./queries";
import type { TargetRole } from "@/features/shared/types/contact-types";

export interface EnrichToast {
  message: string;
  type: "info" | "success" | "warning" | "error";
  action?: { label: string; onClick: () => void };
}

export interface EnrichModalState {
  variant: "queued-zero" | "partial";
  districtCount: number;
  newCount?: number;
}

export interface StartEnrichParams {
  targetRole: TargetRole;
  schoolLevels?: Set<number>;
  /** When provided, scope enrichment to these leaids only (instead of all plan districts). */
  leaids?: string[];
}

export interface BulkEnrichFlowResult {
  isEnriching: boolean;
  toast: EnrichToast | null;
  setToast: (t: EnrichToast | null) => void;
  modalState: EnrichModalState | null;
  setModalState: (m: EnrichModalState | null) => void;
  progressPercent: number;
  progress: { total: number; enriched: number; queued: number } | undefined;
  handleStartEnrichment: (params: StartEnrichParams) => Promise<void>;
  bulkEnrich: ReturnType<typeof useBulkEnrich>;
  expandRollup: ReturnType<typeof useExpandRollup>;
}

export function useBulkEnrichFlow({
  planId,
  onEnrichingChange,
}: {
  planId: string;
  onEnrichingChange?: (isEnriching: boolean) => void;
}): BulkEnrichFlowResult {
  const [isEnriching, setIsEnriching] = useState(false);
  const [toast, setToast] = useState<EnrichToast | null>(null);
  const [modalState, setModalState] = useState<EnrichModalState | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEnrichedRef = useRef<number>(0);
  const pendingPartialRef = useRef<{ newCount: number; skippedCount: number } | null>(null);

  const bulkEnrich = useBulkEnrich();
  const expandRollup = useExpandRollup();
  const { data: progress } = useEnrichProgress(planId, isEnriching);

  // Auto-detect in-progress enrichment on mount.
  const hasCheckedInitial = useRef(false);
  useEffect(() => {
    if (hasCheckedInitial.current || isEnriching) return;
    if (progress && progress.queued > 0 && progress.enriched < progress.queued) {
      setIsEnriching(true);
    }
    if (progress) hasCheckedInitial.current = true;
  }, [progress, isEnriching]);

  // Notify parent of state changes.
  useEffect(() => {
    onEnrichingChange?.(isEnriching);
  }, [isEnriching, onEnrichingChange]);

  // Auto-dismiss toasts without actions.
  useEffect(() => {
    if (!toast || toast.action) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Completion and stall detection.
  useEffect(() => {
    if (!isEnriching || !progress) return;
    if (progress.queued > 0 && progress.enriched >= progress.queued) {
      setIsEnriching(false);
      setToast({
        message: `Contact enrichment complete — ${progress.enriched} contact${progress.enriched !== 1 ? "s" : ""} found`,
        type: "success",
      });
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (pendingPartialRef.current) {
        setModalState({
          variant: "partial",
          districtCount: pendingPartialRef.current.skippedCount,
          newCount: pendingPartialRef.current.newCount,
        });
        pendingPartialRef.current = null;
      }
      return;
    }
    if (progress.enriched !== lastEnrichedRef.current) {
      lastEnrichedRef.current = progress.enriched;
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        setIsEnriching(false);
        setToast({
          message: "Enrichment may be stalled — some contacts may not have results",
          type: "warning",
        });
      }, 2 * 60 * 1000);
    }
  }, [isEnriching, progress]);

  useEffect(() => () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); }, []);

  const handleStartEnrichmentRef = useRef<(p: StartEnrichParams) => Promise<void>>(() =>
    Promise.resolve()
  );

  const handleStartEnrichment = useCallback(
    async ({ targetRole, schoolLevels, leaids }: StartEnrichParams) => {
      try {
        const result = await bulkEnrich.mutateAsync({
          planId,
          targetRole,
          ...(schoolLevels && schoolLevels.size > 0
            ? { schoolLevels: Array.from(schoolLevels).sort() }
            : {}),
          ...(leaids ? { leaids } : {}),
        });

        if (result.queued === 0) {
          if (result.skipped > 0) {
            setModalState({ variant: "queued-zero", districtCount: result.skipped });
          } else {
            const reasonMap: Record<string, string> = {
              "no-districts": "No districts to enrich — add districts to this plan first",
              "no-schools-in-district": "No schools on record for this district",
              "no-schools-at-levels": "No schools at the selected levels",
            };
            setToast({
              message: result.reason
                ? (reasonMap[result.reason] ??
                    (targetRole === "Principal" ? "No schools to enrich" : "No contacts to enrich"))
                : (targetRole === "Principal" ? "No schools to enrich" : "No contacts to enrich"),
              type: "info",
            });
          }
          return;
        }

        if (result.skipped > 0) {
          pendingPartialRef.current = { newCount: result.queued, skippedCount: result.skipped };
        }

        setIsEnriching(true);
        lastEnrichedRef.current = 0;
        stallTimerRef.current = setTimeout(() => {
          setIsEnriching(false);
          setToast({
            message: "Enrichment may be stalled — some contacts may not have results",
            type: "warning",
          });
        }, 2 * 60 * 1000);
        setToast({
          message: `Looking for ${result.queued} contact${result.queued !== 1 ? "s" : ""}`,
          type: "info",
        });
      } catch (error) {
        const body = (error as { body?: unknown })?.body;
        if (
          body &&
          typeof body === "object" &&
          (body as { reason?: unknown }).reason === "rollup-district"
        ) {
          const b = body as { childLeaids?: string[]; rollupLeaids?: string[] };
          const count = b.childLeaids?.length ?? 0;
          const rollupCount = b.rollupLeaids?.length ?? 0;
          if (rollupCount === 0 || count === 0) {
            setToast({ message: "Plan contains a rollup district; cannot expand automatically.", type: "error" });
            return;
          }
          setToast({
            message: `This plan contains ${count.toLocaleString()} child districts rolled up under a parent.`,
            type: "warning",
            action: {
              label: `Expand to ${count.toLocaleString()} districts`,
              onClick: async () => {
                try {
                  await expandRollup.mutateAsync({ planId });
                  setToast(null);
                  await handleStartEnrichmentRef.current({ targetRole, schoolLevels, leaids });
                } catch {
                  setToast({ message: "Failed to expand rollup; please refresh and try again.", type: "error" });
                }
              },
            },
          });
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to start contact enrichment";
        if (message.includes("409") || message.includes("already in progress")) {
          setToast({ message: "Enrichment already in progress", type: "info" });
          setIsEnriching(true);
        } else {
          setToast({ message, type: "error" });
        }
      }
    },
    [planId, bulkEnrich, expandRollup]
  );

  useEffect(() => {
    handleStartEnrichmentRef.current = handleStartEnrichment;
  }, [handleStartEnrichment]);

  const progressPercent =
    progress && progress.queued > 0
      ? Math.round((progress.enriched / progress.queued) * 100)
      : 0;

  return {
    isEnriching,
    toast,
    setToast,
    modalState,
    setModalState,
    progressPercent,
    progress,
    handleStartEnrichment,
    bulkEnrich,
    expandRollup,
  };
}
```

- [ ] **Step 4: Update `useBulkEnrich` in `queries.ts` to accept optional `leaids`**

Locate `useBulkEnrich` (line ~285) and change the `mutationFn` params type:

```ts
// BEFORE
mutationFn: async ({
  planId,
  targetRole,
  schoolLevels,
}: {
  planId: string;
  targetRole: string;
  schoolLevels?: number[];
}) => {
  // ...
  body: JSON.stringify({
    targetRole,
    ...(schoolLevels ? { schoolLevels } : {}),
  }),
```

```ts
// AFTER
mutationFn: async ({
  planId,
  targetRole,
  schoolLevels,
  leaids,
}: {
  planId: string;
  targetRole: string;
  schoolLevels?: number[];
  leaids?: string[];
}) => {
  // ...
  body: JSON.stringify({
    targetRole,
    ...(schoolLevels ? { schoolLevels } : {}),
    ...(leaids ? { leaids } : {}),
  }),
```

- [ ] **Step 5: Update `ContactsActionBar.tsx` to use the shared hook**

Replace the inline state and handler code with the hook. The full updated file:

```tsx
// src/features/plans/components/ContactsActionBar.tsx
"use client";
import { useState, useEffect } from "react";
import { Search, Download, ChevronDown } from "lucide-react";
import { TARGET_ROLES, type TargetRole } from "@/features/shared/types/contact-types";
import type { Contact } from "@/lib/api";
import { SCHOOL_LEVEL_LABELS, SCHOOL_TYPE_LABELS } from "@/features/shared/lib/schoolLabels";
import { useBulkEnrichFlow } from "@/features/plans/lib/enrich-flow";
import ExistingContactsModal from "./ExistingContactsModal";
import { useExpandRollup } from "@/features/plans/lib/queries";

interface ContactsActionBarProps {
  planId: string;
  planName: string;
  contacts: Contact[];
  districtNameMap?: Map<string, string>;
  allDistrictLeaids: string[];
  districtWebsiteMap?: Map<string, string>;
  onEnrichingChange?: (isEnriching: boolean) => void;
}

export default function ContactsActionBar({
  planId,
  planName,
  contacts,
  districtNameMap,
  allDistrictLeaids,
  districtWebsiteMap,
  onEnrichingChange,
}: ContactsActionBarProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TargetRole>("Superintendent");
  const [schoolLevels, setSchoolLevels] = useState<Set<number>>(new Set([1, 2, 3]));

  const {
    isEnriching,
    toast,
    setToast,
    modalState,
    setModalState,
    progressPercent,
    progress,
    handleStartEnrichment,
    bulkEnrich,
    expandRollup,
  } = useBulkEnrichFlow({ planId, onEnrichingChange });

  const handleExportCsv = () => {
    const headers = [
      "District Name", "Website", "School Name", "School Level", "School Type",
      "Contact Name", "Title", "Email", "Phone", "Department", "Seniority Level",
    ];
    const rows: string[][] = [];
    const seenDistricts = new Set<string>();

    for (const contact of contacts) {
      seenDistricts.add(contact.leaid);
      const districtName = districtNameMap?.get(contact.leaid) || contact.leaid;
      const websiteUrl = districtWebsiteMap?.get(contact.leaid) || "";
      const link = contact.schoolContacts?.[0];
      const schoolName = link?.name ?? "";
      const schoolLevel = link?.schoolLevel != null ? (SCHOOL_LEVEL_LABELS[link.schoolLevel] ?? "") : "";
      const schoolType = link?.schoolType != null ? (SCHOOL_TYPE_LABELS[link.schoolType] ?? "") : "";
      rows.push([districtName, websiteUrl, schoolName, schoolLevel, schoolType,
        contact.name || "", contact.title || "", contact.email || "", contact.phone || "",
        contact.persona || "", contact.seniorityLevel || ""]);
    }
    for (const leaid of allDistrictLeaids) {
      if (seenDistricts.has(leaid)) continue;
      const districtName = districtNameMap?.get(leaid) || leaid;
      const websiteUrl = districtWebsiteMap?.get(leaid) || "";
      rows.push([districtName, websiteUrl, "", "", "", "", "", "", "", "", ""]);
    }
    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = planName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();
    link.download = `${safeName}-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  };

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-y-2 px-4 py-2.5 border-b border-[#EFEDF5]">
        <div className="flex items-center gap-2">
          <div className="relative">
            <button
              onClick={() => setShowPopover((p) => !p)}
              disabled={isEnriching || bulkEnrich.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Find Contacts
            </button>
            {showPopover && (
              <div className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-[#EFEDF5] p-3 z-50"
                style={{ animation: "tooltipEnter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
                <label className="block text-[11px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">Target Role</label>
                <div className="relative mb-3">
                  <select value={selectedRole} onChange={(e) => setSelectedRole(e.target.value as TargetRole)}
                    className="w-full appearance-none px-3 py-2 pr-8 text-[13px] text-[#403770] bg-[#F7F5FA] border border-[#EFEDF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20">
                    {TARGET_ROLES.map((role) => (<option key={role} value={role}>{role}</option>))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#403770]/40 pointer-events-none" />
                </div>
                {selectedRole === "Principal" && (
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">School Level</label>
                    <div className="flex flex-col gap-1.5">
                      {[{ value: 1, label: "Primary" }, { value: 2, label: "Middle" }, { value: 3, label: "High" }].map(({ value, label }) => (
                        <label key={value} className="flex items-center gap-2 text-[13px] text-[#403770] cursor-pointer">
                          <input type="checkbox" checked={schoolLevels.has(value)}
                            onChange={(e) => setSchoolLevels((prev) => { const next = new Set(prev); e.target.checked ? next.add(value) : next.delete(value); return next; })}
                            className="w-3.5 h-3.5 accent-[#403770]" />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}
                <button onClick={() => { setShowPopover(false); handleStartEnrichment({ targetRole: selectedRole, schoolLevels }); }}
                  disabled={bulkEnrich.isPending || (selectedRole === "Principal" && schoolLevels.size === 0)}
                  className="w-full px-3 py-2 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors">
                  {bulkEnrich.isPending ? "Starting..." : "Start"}
                </button>
              </div>
            )}
          </div>
          {isEnriching && progress && progress.queued > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-24 h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
                <div className="h-full bg-[#8AA891] rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="text-[12px] text-[#403770]/60 font-medium whitespace-nowrap">{progress.enriched}/{progress.queued}</span>
            </div>
          )}
        </div>
        <button onClick={handleExportCsv} className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#403770] hover:bg-[#F7F5FA] rounded-lg transition-colors">
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>
      {modalState && (
        <ExistingContactsModal planId={planId} variant={modalState.variant} districtCount={modalState.districtCount} newCount={modalState.newCount} onClose={() => setModalState(null)} />
      )}
      {toast && (
        <div role="status" className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium flex items-center gap-3 ${
          toast.type === "success" ? "bg-[#8AA891] text-white" : toast.type === "warning" ? "bg-amber-500 text-white" : toast.type === "error" ? "bg-red-500 text-white" : "bg-[#403770] text-white"
        }`} style={{ animation: "tooltipEnter 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}>
          <span>{toast.message}</span>
          {toast.action && (
            <button type="button" onClick={toast.action.onClick} disabled={expandRollup.isPending}
              className="inline-flex items-center px-2.5 py-1 text-[12px] font-semibold text-white bg-white/20 hover:bg-white/30 disabled:opacity-50 disabled:cursor-not-allowed rounded-md transition-colors whitespace-nowrap">
              {expandRollup.isPending ? "Expanding..." : toast.action.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 6: Run tests**

```bash
npx vitest run src/features/plans/lib/__tests__/enrich-flow.test.ts src/features/plans/components/__tests__/ContactsActionBar.test.tsx 2>&1 | tail -30
```

Expected: all pass. If `ContactsActionBar` tests fail due to missing imports, adjust mocks to match the new import paths.

- [ ] **Step 7: Commit**

```bash
git add src/features/plans/lib/enrich-flow.ts \
        src/features/plans/lib/__tests__/enrich-flow.test.ts \
        src/features/plans/lib/queries.ts \
        src/features/plans/components/ContactsActionBar.tsx
git commit -m "refactor(plans): extract useBulkEnrichFlow; add leaids param to useBulkEnrich"
```

---

## Task 2: Backend — bulk-enrich leaids scoping

Extend `POST /api/territory-plans/[id]/contacts/bulk-enrich` to accept an optional `leaids` body field. When provided, restrict enrichment to only those districts (both non-Principal and Principal paths).

**Files:**
- Modify: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`
- Test: `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

Open `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts` and add this test case inside the existing describe block (after the existing tests):

```ts
it("restricts enrichment to provided leaids when leaids body field is given", async () => {
  // Arrange: plan has districts 'A', 'B', 'C' but request specifies only 'A'
  prismaMock.territoryPlan.findUnique.mockResolvedValue({
    id: "plan-1",
    enrichmentStartedAt: null,
    enrichmentQueued: null,
    enrichmentActivityId: null,
    districts: [
      { districtLeaid: "A" },
      { districtLeaid: "B" },
      { districtLeaid: "C" },
    ],
  } as never);
  // No contacts for 'A' yet → should be queued
  prismaMock.contact.groupBy.mockResolvedValue([]);
  prismaMock.district.findMany.mockResolvedValue([
    { leaid: "A", name: "Alpha SD", stateAbbrev: "CA", cityLocation: "City", streetLocation: "St", zipLocation: "90000", websiteUrl: null },
  ]);
  prismaMock.activity.create.mockResolvedValue({ id: "act-1" } as never);
  prismaMock.territoryPlan.update.mockResolvedValue({} as never);

  const req = new Request("http://test/api/territory-plans/plan-1/contacts/bulk-enrich", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ targetRole: "Superintendent", leaids: ["A"] }),
  });
  const res = await POST(req, { params: Promise.resolve({ id: "plan-1" }) });
  const body = await res.json();

  // Only district A should be queued (1), not B or C
  expect(body.queued).toBe(1);
  // contact.groupBy should have been called with { in: ["A"] } not ["A","B","C"]
  expect(prismaMock.contact.groupBy).toHaveBeenCalledWith(
    expect.objectContaining({ where: { leaid: { in: ["A"] } } })
  );
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run "src/app/api/territory-plans/\[id\]/contacts/bulk-enrich/__tests__/route.test.ts" 2>&1 | tail -20
```

- [ ] **Step 3: Implement leaids scoping in the route**

In `src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts`, after parsing `targetRole` and `schoolLevels` (around line 31), add:

```ts
// Parse optional leaids scope
const leaidsScope: string[] | null =
  Array.isArray(body.leaids) && body.leaids.length > 0
    ? (body.leaids as string[]).filter((l) => typeof l === "string")
    : null;
```

Then replace the line that builds `allLeaids` from the plan:

```ts
// BEFORE (line ~64):
const allLeaids = plan.districts.map((d) => d.districtLeaid);

// AFTER:
const planLeaids = plan.districts.map((d) => d.districtLeaid);
// When a leaids scope is provided, restrict to only those leaids that are
// actually in the plan (intersection, not blind trust of caller input).
const allLeaids = leaidsScope
  ? planLeaids.filter((l) => leaidsScope.includes(l))
  : planLeaids;
```

No other changes needed — both the Principal path and the non-Principal path use `allLeaids` for all subsequent filtering.

- [ ] **Step 4: Run test — expect PASS**

```bash
npx vitest run "src/app/api/territory-plans/\[id\]/contacts/bulk-enrich/__tests__/route.test.ts" 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/territory-plans/[id]/contacts/bulk-enrich/route.ts" \
        "src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts"
git commit -m "feat(api): scope bulk-enrich to optional leaids subset"
```

---

## Task 3: Backend — bulk remove districts

Add a `DELETE` handler to the existing `districts/route.ts` file (same file as the `POST` handler). Accept `{ leaids: string[] }` in the request body and delete all of them in one `deleteMany`.

**Files:**
- Modify: `src/app/api/territory-plans/[id]/districts/route.ts`
- Modify: `src/app/api/territory-plans/[id]/districts/__tests__/route.test.ts`
- Modify: `src/features/plans/lib/queries.ts`

- [ ] **Step 1: Write the failing test**

Add to `src/app/api/territory-plans/[id]/districts/__tests__/route.test.ts`:

```ts
// At the top, import the DELETE handler alongside POST:
// import { POST, DELETE } from "../route";

it("DELETE removes the given leaids and calls syncPlanRollups", async () => {
  prismaMock.territoryPlanDistrict.deleteMany.mockResolvedValue({ count: 3 });
  // syncClassificationTagsForDistrict is mocked at module level in the existing test file
  // syncPlanRollups is mocked at module level in the existing test file

  const req = new Request("http://test/api/territory-plans/plan-1/districts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leaids: ["A", "B", "C"] }),
  });
  const res = await DELETE(req, { params: Promise.resolve({ id: "plan-1" }) });
  expect(res.status).toBe(200);
  const body = await res.json();
  expect(body.removed).toBe(3);
  expect(prismaMock.territoryPlanDistrict.deleteMany).toHaveBeenCalledWith({
    where: { planId: "plan-1", districtLeaid: { in: ["A", "B", "C"] } },
  });
});

it("DELETE returns 400 when leaids is empty", async () => {
  const req = new Request("http://test/api/territory-plans/plan-1/districts", {
    method: "DELETE",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ leaids: [] }),
  });
  const res = await DELETE(req, { params: Promise.resolve({ id: "plan-1" }) });
  expect(res.status).toBe(400);
});
```

- [ ] **Step 2: Run test — expect FAIL (DELETE not exported)**

```bash
npx vitest run "src/app/api/territory-plans/\[id\]/districts/__tests__/route.test.ts" 2>&1 | tail -20
```

- [ ] **Step 3: Add DELETE handler to `districts/route.ts`**

Append at the end of `src/app/api/territory-plans/[id]/districts/route.ts`:

```ts
// DELETE /api/territory-plans/[id]/districts — bulk remove a list of districts
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const { id: planId } = await params;
    const body = await request.json();
    const { leaids } = body as { leaids?: unknown };

    if (!Array.isArray(leaids) || leaids.length === 0) {
      return NextResponse.json({ error: "leaids must be a non-empty array" }, { status: 400 });
    }

    const leaidStrings = leaids.filter((l): l is string => typeof l === "string");
    if (leaidStrings.length === 0) {
      return NextResponse.json({ error: "leaids must contain strings" }, { status: 400 });
    }

    const result = await prisma.territoryPlanDistrict.deleteMany({
      where: { planId, districtLeaid: { in: leaidStrings } },
    });

    // Sync classification tags in batches of 10 (same pattern as POST handler).
    const BATCH_SIZE = 10;
    for (let i = 0; i < leaidStrings.length; i += BATCH_SIZE) {
      await Promise.all(
        leaidStrings.slice(i, i + BATCH_SIZE).map((leaid) =>
          syncClassificationTagsForDistrict(leaid)
        )
      );
    }

    await syncPlanRollups(planId);

    return NextResponse.json({ removed: result.count });
  } catch (error) {
    console.error("Error bulk-removing districts from plan:", error);
    return NextResponse.json({ error: "Failed to bulk-remove districts" }, { status: 500 });
  }
}
```

- [ ] **Step 4: Add `useBulkRemoveDistrictsFromPlan` to `queries.ts`**

Append after `useRemoveDistrictFromPlan` (around line 210):

```ts
export function useBulkRemoveDistrictsFromPlan() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ planId, leaids }: { planId: string; leaids: string[] }) =>
      fetchJson<{ removed: number }>(
        `${API_BASE}/territory-plans/${planId}/districts`,
        {
          method: "DELETE",
          body: JSON.stringify({ leaids }),
        }
      ),
    onSuccess: (_, { planId }) => {
      queryClient.invalidateQueries({ queryKey: ["territoryPlans"] });
      queryClient.invalidateQueries({ queryKey: ["territoryPlan", planId] });
      queryClient.invalidateQueries({ queryKey: ["views", "data"] });
      queryClient.invalidateQueries({ queryKey: ["explore"] });
      queryClient.invalidateQueries({ queryKey: ["teamProgress"] });
      queryClient.invalidateQueries({ queryKey: ["leaderboard"] });
    },
  });
}
```

- [ ] **Step 5: Run tests — expect PASS**

```bash
npx vitest run "src/app/api/territory-plans/\[id\]/districts/__tests__/route.test.ts" 2>&1 | tail -20
```

- [ ] **Step 6: Commit**

```bash
git add "src/app/api/territory-plans/[id]/districts/route.ts" \
        "src/app/api/territory-plans/[id]/districts/__tests__/route.test.ts" \
        src/features/plans/lib/queries.ts
git commit -m "feat(api): bulk remove districts endpoint + useBulkRemoveDistrictsFromPlan"
```

---

## Task 4: Backend — district export endpoint

Create `GET /api/territory-plans/[id]/districts/export`. Returns all plan districts matching the GridView's active filters, without pagination cap. Used for all-filtered CSV export and leaid resolution.

**Files:**
- Create: `src/app/api/territory-plans/[id]/districts/export/route.ts`
- Create: `src/app/api/territory-plans/[id]/districts/export/__tests__/route.test.ts`

- [ ] **Step 1: Write the failing test**

```ts
// src/app/api/territory-plans/[id]/districts/export/__tests__/route.test.ts
import { describe, it, expect, vi, beforeEach } from "vitest";
import { GET } from "../route";

vi.mock("@/lib/supabase/server", () => ({
  getUser: vi.fn().mockResolvedValue({ id: "user-1" }),
}));
vi.mock("@/lib/prisma", () => ({
  default: {
    territoryPlan: {
      findUnique: vi.fn(),
    },
  },
}));
vi.mock("@/lib/db-readonly", () => ({
  readonlyPool: { query: vi.fn() },
}));

import prisma from "@/lib/prisma";
import { readonlyPool } from "@/lib/db-readonly";
const prismaMock = prisma as unknown as {
  territoryPlan: { findUnique: ReturnType<typeof vi.fn> };
};
const poolMock = readonlyPool as unknown as { query: ReturnType<typeof vi.fn> };

describe("GET /api/territory-plans/[id]/districts/export", () => {
  beforeEach(() => vi.clearAllMocks());

  it("returns 404 when plan not found", async () => {
    prismaMock.territoryPlan.findUnique.mockResolvedValue(null);
    const req = new Request("http://test/api/territory-plans/missing/districts/export");
    const res = await GET(req, { params: Promise.resolve({ id: "missing" }) });
    expect(res.status).toBe(404);
  });

  it("returns empty rows when plan has no districts", async () => {
    prismaMock.territoryPlan.findUnique.mockResolvedValue({ id: "p1", districts: [] });
    const req = new Request("http://test/api/territory-plans/p1/districts/export");
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toEqual([]);
    expect(body.total).toBe(0);
  });

  it("returns all matching rows from readonlyPool without a LIMIT clause", async () => {
    prismaMock.territoryPlan.findUnique.mockResolvedValue({
      id: "p1",
      districts: [{ districtLeaid: "A" }, { districtLeaid: "B" }],
    });
    poolMock.query.mockResolvedValue({
      rows: [
        { leaid: "A", name: "Alpha SD", state_abbrev: "CA", enrollment: 1000, renewal_target: null, winback_target: null, expansion_target: null, new_business_target: null },
        { leaid: "B", name: "Beta SD", state_abbrev: "CA", enrollment: 500, renewal_target: 50000, winback_target: null, expansion_target: null, new_business_target: null },
      ],
    });

    const req = new Request("http://test/api/territory-plans/p1/districts/export");
    const res = await GET(req, { params: Promise.resolve({ id: "p1" }) });
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows).toHaveLength(2);
    expect(body.total).toBe(2);

    // Verify no LIMIT clause in emitted SQL
    const sql: string = poolMock.query.mock.calls[0][0];
    expect(sql).not.toMatch(/LIMIT/i);
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run "src/app/api/territory-plans/\[id\]/districts/export/__tests__/route.test.ts" 2>&1 | tail -20
```

- [ ] **Step 3: Create the export route**

```ts
// src/app/api/territory-plans/[id]/districts/export/route.ts
import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";
import { readonlyPool } from "@/lib/db-readonly";
import { filterNodeSchema } from "@/lib/saved-views/schema";
import { compileFilterTree } from "@/lib/saved-views/sql-compiler";
import type { FilterNode } from "@/lib/saved-views/filter-tree";

export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const user = await getUser();
  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { id: planId } = await params;
  const { searchParams } = req.nextUrl;

  // Parse optional GridView filter JSON.
  let requestFilter: FilterNode = { kind: "and", children: [] };
  const filtersRaw = searchParams.get("filters");
  if (filtersRaw) {
    try {
      const parsed = JSON.parse(filtersRaw);
      const result = filterNodeSchema.safeParse(parsed);
      if (!result.success) {
        return NextResponse.json({ error: "Invalid filter tree" }, { status: 400 });
      }
      requestFilter = result.data;
    } catch {
      return NextResponse.json({ error: "Invalid filters JSON" }, { status: 400 });
    }
  }

  // Get plan with its district leaids.
  const plan = await prisma.territoryPlan.findUnique({
    where: { id: planId },
    include: { districts: { select: { districtLeaid: true } } },
  });
  if (!plan) {
    return NextResponse.json({ error: "Plan not found" }, { status: 404 });
  }

  const planLeaids = plan.districts.map((d) => d.districtLeaid);
  if (planLeaids.length === 0) {
    return NextResponse.json({ rows: [], total: 0 });
  }

  // Compile the filter tree against the districts source.
  const compileResult = compileFilterTree("districts", requestFilter, "t", 0, { planId });
  if (!compileResult.ok) {
    return NextResponse.json({ error: `Filter compile error: ${compileResult.error}` }, { status: 400 });
  }

  // Build params: compiled filter params first, then planLeaids, then planId for the JOIN.
  const queryParams: unknown[] = [...compileResult.params];
  queryParams.push(planLeaids);
  const leaidsParamIdx = queryParams.length; // $N for plan leaids scope
  queryParams.push(planId);
  const planParamIdx = queryParams.length;  // $N for tpd JOIN

  // Compose WHERE: compiled filters AND leaid scope.
  const whereClause = compileResult.whereSql
    ? `(${compileResult.whereSql}) AND t.leaid = ANY($${leaidsParamIdx})`
    : `t.leaid = ANY($${leaidsParamIdx})`;

  // No LIMIT/OFFSET — return all matching rows.
  const sql = `
    SELECT
      t.leaid,
      t.name,
      t.state_abbrev,
      t.enrollment,
      tpd.renewal_target::float     AS renewal_target,
      tpd.winback_target::float     AS winback_target,
      tpd.expansion_target::float   AS expansion_target,
      tpd.new_business_target::float AS new_business_target
    FROM districts t
    LEFT JOIN territory_plan_districts tpd
      ON tpd.district_leaid = t.leaid AND tpd.plan_id = $${planParamIdx}
    WHERE ${whereClause}
    ORDER BY t.name ASC
  `;

  const result = await readonlyPool.query(sql, queryParams);

  return NextResponse.json({
    rows: result.rows,
    total: result.rows.length,
  });
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run "src/app/api/territory-plans/\[id\]/districts/export/__tests__/route.test.ts" 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add "src/app/api/territory-plans/[id]/districts/export/route.ts" \
        "src/app/api/territory-plans/[id]/districts/export/__tests__/route.test.ts"
git commit -m "feat(api): district export endpoint (no pagination cap)"
```

---

## Task 5: Frontend — `BulkActionsMenu` component

The dropdown triggered by "Bulk Actions ▾". Handles all three actions. For `all-filtered` mode, fetches all leaids from the export endpoint before calling bulk-remove or find-contacts.

**Files:**
- Create: `src/features/views/components/grid/actions/BulkActionsMenu.tsx`
- Create: `src/features/views/components/grid/actions/__tests__/BulkActionsMenu.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/views/components/grid/actions/__tests__/BulkActionsMenu.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BulkActionsMenu } from "../BulkActionsMenu";
import React from "react";

vi.mock("@/features/plans/lib/queries", () => ({
  useBulkRemoveDistrictsFromPlan: () => ({
    mutateAsync: vi.fn().mockResolvedValue({ removed: 2 }),
    isPending: false,
  }),
}));
vi.mock("@/features/plans/lib/enrich-flow", () => ({
  useBulkEnrichFlow: () => ({
    isEnriching: false, toast: null, setToast: vi.fn(), modalState: null, setModalState: vi.fn(),
    progressPercent: 0, progress: undefined, handleStartEnrichment: vi.fn(),
    bulkEnrich: { isPending: false }, expandRollup: { isPending: false },
  }),
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const explicitProps = {
  planId: "plan-1",
  planLeaids: ["A", "B"],
  selection: { mode: "explicit" as const, leaids: new Set(["A"]) },
  layout: { filters: { kind: "and" as const, children: [] }, sort: [], columns: [] },
  onSelectionCleared: vi.fn(),
};

describe("BulkActionsMenu", () => {
  beforeEach(() => vi.clearAllMocks());

  it("renders the trigger button", () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    expect(screen.getByRole("button", { name: /bulk actions/i })).toBeInTheDocument();
  });

  it("shows three menu items when open", async () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /bulk actions/i }));
    expect(await screen.findByRole("menuitem", { name: /find contacts/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /export.*csv/i })).toBeInTheDocument();
    expect(screen.getByRole("menuitem", { name: /remove from plan/i })).toBeInTheDocument();
  });

  it("shows remove confirm dialog after clicking Remove from plan", async () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /bulk actions/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove from plan/i }));
    expect(await screen.findByText(/remove 1 district/i)).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /confirm remove/i })).toBeInTheDocument();
  });

  it("closes the confirm on Cancel", async () => {
    render(<BulkActionsMenu {...explicitProps} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /bulk actions/i }));
    fireEvent.click(await screen.findByRole("menuitem", { name: /remove from plan/i }));
    fireEvent.click(await screen.findByRole("button", { name: /^cancel$/i }));
    await waitFor(() => expect(screen.queryByText(/remove 1 district/i)).not.toBeInTheDocument());
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run "src/features/views/components/grid/actions/__tests__/BulkActionsMenu.test.tsx" 2>&1 | tail -20
```

- [ ] **Step 3: Create `BulkActionsMenu.tsx`**

```tsx
// src/features/views/components/grid/actions/BulkActionsMenu.tsx
"use client";
import { useRef, useState, useCallback } from "react";
import { ChevronDown, Search, Download, Trash2, Loader2 } from "lucide-react";
import { AnchoredPopover } from "../AnchoredPopover";
import { useBulkRemoveDistrictsFromPlan } from "@/features/plans/lib/queries";
import { FindContactsPopover } from "./FindContactsPopover";
import { API_BASE } from "@/features/shared/lib/api-client";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";

export type SelectionState =
  | { mode: "none" }
  | { mode: "explicit"; leaids: Set<string> }
  | { mode: "all-filtered"; total: number };

interface BulkActionsMenuProps {
  planId: string;
  /** All leaids in the plan — used to scope the export endpoint. */
  planLeaids: string[];
  selection: Exclude<SelectionState, { mode: "none" }>;
  layout: GridViewLayout;
  onSelectionCleared: () => void;
}

type Surface = null | "remove" | "find-contacts";

/** Fetch all leaids matching current filters via the export endpoint. */
async function resolveAllLeaids(
  planId: string,
  layout: GridViewLayout
): Promise<string[]> {
  const params = new URLSearchParams();
  if (layout.filters.children.length > 0) {
    params.set("filters", JSON.stringify(layout.filters));
  }
  const url = `${API_BASE}/territory-plans/${planId}/districts/export?${params.toString()}`;
  const res = await fetch(url);
  if (!res.ok) throw new Error("Failed to fetch districts for bulk action");
  const data = await res.json() as { rows: { leaid: string }[] };
  return data.rows.map((r) => r.leaid);
}

export function BulkActionsMenu({
  planId,
  planLeaids,
  selection,
  layout,
  onSelectionCleared,
}: BulkActionsMenuProps) {
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState<Surface>(null);
  const [resolving, setResolving] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const removeMutation = useBulkRemoveDistrictsFromPlan();

  const selectionCount =
    selection.mode === "explicit" ? selection.leaids.size : selection.total;

  /** Resolve leaids from selection state (explicit → use Set, all-filtered → fetch). */
  const getLeaids = useCallback(async (): Promise<string[]> => {
    if (selection.mode === "explicit") {
      return Array.from(selection.leaids);
    }
    setResolving(true);
    try {
      return await resolveAllLeaids(planId, layout);
    } finally {
      setResolving(false);
    }
  }, [selection, planId, layout]);

  const handleExportCsv = useCallback(async () => {
    setOpen(false);
    setResolving(true);
    try {
      let rows: Record<string, unknown>[];
      if (selection.mode === "explicit") {
        // Data for explicit selection is already available; use export endpoint
        // to get a consistent format (targets included).
        const params = new URLSearchParams();
        const res = await fetch(
          `${API_BASE}/territory-plans/${planId}/districts/export?${params.toString()}`
        );
        const data = await res.json() as { rows: Record<string, unknown>[] };
        const selectedLeaids = selection.leaids;
        rows = data.rows.filter((r) => selectedLeaids.has(r.leaid as string));
      } else {
        const params = new URLSearchParams();
        if (layout.filters.children.length > 0) {
          params.set("filters", JSON.stringify(layout.filters));
        }
        const res = await fetch(
          `${API_BASE}/territory-plans/${planId}/districts/export?${params.toString()}`
        );
        const data = await res.json() as { rows: Record<string, unknown>[] };
        rows = data.rows;
      }

      const headers = [
        "District Name", "State", "LEAID", "Enrollment",
        "Renewal Target", "Winback Target", "Expansion Target", "New Business Target",
      ];
      const csvRows = rows.map((r) => [
        String(r.name ?? ""),
        String(r.state_abbrev ?? ""),
        String(r.leaid ?? ""),
        String(r.enrollment ?? ""),
        String(r.renewal_target ?? ""),
        String(r.winback_target ?? ""),
        String(r.expansion_target ?? ""),
        String(r.new_business_target ?? ""),
      ]);
      const csv = [headers, ...csvRows]
        .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
        .join("\n");
      const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `districts-export-${new Date().toISOString().split("T")[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } finally {
      setResolving(false);
    }
  }, [selection, planId, layout]);

  const handleConfirmRemove = useCallback(async () => {
    const leaids = await getLeaids();
    await removeMutation.mutateAsync({ planId, leaids });
    setSurface(null);
    onSelectionCleared();
  }, [getLeaids, removeMutation, planId, onSelectionCleared]);

  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#403770] hover:bg-[#F7F5FA] whitespace-nowrap";

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-haspopup="menu"
        aria-expanded={open}
        disabled={resolving}
        onClick={() => setOpen((o) => !o)}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[12px] font-semibold text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
      >
        {resolving ? (
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
        ) : (
          <>
            Bulk Actions
            <ChevronDown className="h-3 w-3" />
          </>
        )}
      </button>

      <AnchoredPopover anchorRef={btnRef} open={open} onDismiss={() => setOpen(false)}>
        <div
          role="menu"
          aria-label="Bulk actions"
          style={{ width: 200 }}
          className="rounded-xl border border-[#E2DEEC] bg-white p-1.5 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
        >
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => { setOpen(false); setSurface("find-contacts"); }}
          >
            <Search className="h-3.5 w-3.5 opacity-70 shrink-0" />
            Find Contacts
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={handleExportCsv}
          >
            <Download className="h-3.5 w-3.5 opacity-70 shrink-0" />
            Export to CSV
          </button>
          <div className="my-1 h-px bg-[#EFEDF5]" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#c25a52] hover:bg-[#fef1f0] whitespace-nowrap"
            onClick={() => { setOpen(false); setSurface("remove"); }}
          >
            <Trash2 className="h-3.5 w-3.5 opacity-80 shrink-0" />
            Remove from plan
          </button>
        </div>
      </AnchoredPopover>

      {/* Remove confirm popover */}
      {surface === "remove" && (
        <AnchoredPopover anchorRef={btnRef} open onDismiss={() => setSurface(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm bulk removal"
            style={{ width: 256 }}
            className="rounded-xl border border-[#E2DEEC] bg-white p-4 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
          >
            <p className="m-0 mb-3 text-[13px] leading-snug text-[#403770]">
              Remove{" "}
              <b>
                {selectionCount} district{selectionCount !== 1 ? "s" : ""}
              </b>{" "}
              from this plan? This cannot be undone.
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-[#E2DEEC] px-3 py-1.5 text-[12px] text-[#544A78]"
                onClick={() => setSurface(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                aria-label="Confirm remove"
                disabled={removeMutation.isPending || resolving}
                className="rounded-md bg-[#c25a52] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                onClick={handleConfirmRemove}
              >
                {removeMutation.isPending || resolving
                  ? "Removing…"
                  : `Remove ${selectionCount}`}
              </button>
            </div>
          </div>
        </AnchoredPopover>
      )}

      {/* Find Contacts popover */}
      {surface === "find-contacts" && (
        <FindContactsPopover
          planId={planId}
          selection={selection}
          layout={layout}
          anchorRef={btnRef}
          open
          onClose={() => setSurface(null)}
        />
      )}
    </>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run "src/features/views/components/grid/actions/__tests__/BulkActionsMenu.test.tsx" 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/BulkActionsMenu.tsx \
        "src/features/views/components/grid/actions/__tests__/BulkActionsMenu.test.tsx"
git commit -m "feat(views): BulkActionsMenu component"
```

---

## Task 6: Frontend — `FindContactsPopover` component

Role selector popover that scopes enrichment to the selection. Reuses `useBulkEnrichFlow`.

**Files:**
- Create: `src/features/views/components/grid/actions/FindContactsPopover.tsx`
- Create: `src/features/views/components/grid/actions/__tests__/FindContactsPopover.test.tsx`

- [ ] **Step 1: Write the failing test**

```tsx
// src/features/views/components/grid/actions/__tests__/FindContactsPopover.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@testing-library/react";
import { FindContactsPopover } from "../FindContactsPopover";
import React from "react";

const mockHandleStart = vi.fn();

vi.mock("@/features/plans/lib/enrich-flow", () => ({
  useBulkEnrichFlow: () => ({
    isEnriching: false, toast: null, setToast: vi.fn(), modalState: null, setModalState: vi.fn(),
    progressPercent: 0, progress: undefined,
    handleStartEnrichment: mockHandleStart,
    bulkEnrich: { isPending: false }, expandRollup: { isPending: false },
  }),
}));
vi.mock("@/features/plans/components/ExistingContactsModal", () => ({ default: () => null }));

// Stub AnchoredPopover to render children inline.
vi.mock("../AnchoredPopover", () => ({
  AnchoredPopover: ({ children, open }: { children: React.ReactNode; open: boolean }) =>
    open ? React.createElement("div", null, children) : null,
}));

function wrapper({ children }: { children: React.ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return React.createElement(QueryClientProvider, { client: qc }, children);
}

const baseProps = {
  planId: "plan-1",
  selection: { mode: "explicit" as const, leaids: new Set(["A", "B"]) },
  layout: { filters: { kind: "and" as const, children: [] }, sort: [], columns: [] },
  anchorRef: { current: null },
  open: true,
  onClose: vi.fn(),
};

describe("FindContactsPopover", () => {
  beforeEach(() => vi.clearAllMocks());

  it("shows the role dropdown and a scope badge", () => {
    render(<FindContactsPopover {...baseProps} />, { wrapper });
    expect(screen.getByRole("combobox")).toBeInTheDocument();
    expect(screen.getByText(/2 districts/i)).toBeInTheDocument();
  });

  it("calls handleStartEnrichment with explicit leaids on Start", async () => {
    mockHandleStart.mockResolvedValue(undefined);
    render(<FindContactsPopover {...baseProps} />, { wrapper });
    fireEvent.click(screen.getByRole("button", { name: /start enrichment/i }));
    expect(mockHandleStart).toHaveBeenCalledWith(
      expect.objectContaining({ leaids: ["A", "B"] })
    );
  });

  it("shows school level checkboxes when Principal is selected", () => {
    render(<FindContactsPopover {...baseProps} />, { wrapper });
    fireEvent.change(screen.getByRole("combobox"), { target: { value: "Principal" } });
    expect(screen.getByLabelText(/primary/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run test — expect FAIL**

```bash
npx vitest run "src/features/views/components/grid/actions/__tests__/FindContactsPopover.test.tsx" 2>&1 | tail -20
```

- [ ] **Step 3: Create `FindContactsPopover.tsx`**

```tsx
// src/features/views/components/grid/actions/FindContactsPopover.tsx
"use client";
import { useState, useCallback, type RefObject } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { TARGET_ROLES, type TargetRole } from "@/features/shared/types/contact-types";
import { AnchoredPopover } from "../AnchoredPopover";
import { useBulkEnrichFlow } from "@/features/plans/lib/enrich-flow";
import ExistingContactsModal from "@/features/plans/components/ExistingContactsModal";
import { API_BASE } from "@/features/shared/lib/api-client";
import type { GridViewLayout } from "@/lib/saved-views/grid-layout-schema";
import type { SelectionState } from "./BulkActionsMenu";

interface FindContactsPopoverProps {
  planId: string;
  selection: Exclude<SelectionState, { mode: "none" }>;
  layout: GridViewLayout;
  anchorRef: RefObject<HTMLButtonElement | null>;
  open: boolean;
  onClose: () => void;
}

export function FindContactsPopover({
  planId,
  selection,
  layout,
  anchorRef,
  open,
  onClose,
}: FindContactsPopoverProps) {
  const [selectedRole, setSelectedRole] = useState<TargetRole>("Superintendent");
  const [schoolLevels, setSchoolLevels] = useState<Set<number>>(new Set([1, 2, 3]));
  const [resolving, setResolving] = useState(false);

  const {
    isEnriching,
    toast,
    setToast,
    modalState,
    setModalState,
    progressPercent,
    progress,
    handleStartEnrichment,
    bulkEnrich,
    expandRollup,
  } = useBulkEnrichFlow({ planId });

  const selectionCount =
    selection.mode === "explicit" ? selection.leaids.size : selection.total;

  const getLeaids = useCallback(async (): Promise<string[]> => {
    if (selection.mode === "explicit") return Array.from(selection.leaids);
    setResolving(true);
    try {
      const params = new URLSearchParams();
      if (layout.filters.children.length > 0) {
        params.set("filters", JSON.stringify(layout.filters));
      }
      const res = await fetch(
        `${API_BASE}/territory-plans/${planId}/districts/export?${params.toString()}`
      );
      if (!res.ok) throw new Error("Failed to resolve leaids");
      const data = await res.json() as { rows: { leaid: string }[] };
      return data.rows.map((r) => r.leaid);
    } finally {
      setResolving(false);
    }
  }, [selection, planId, layout]);

  const handleStart = useCallback(async () => {
    const leaids = await getLeaids();
    await handleStartEnrichment({ targetRole: selectedRole, schoolLevels, leaids });
    onClose();
  }, [getLeaids, handleStartEnrichment, selectedRole, schoolLevels, onClose]);

  const isDisabled =
    bulkEnrich.isPending ||
    resolving ||
    isEnriching ||
    (selectedRole === "Principal" && schoolLevels.size === 0);

  return (
    <>
      <AnchoredPopover anchorRef={anchorRef} open={open} onDismiss={onClose}>
        <div
          style={{ width: 230 }}
          className="rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
        >
          {/* Header with scope badge */}
          <div className="flex items-center justify-between mb-3">
            <span className="text-[12px] font-semibold text-[#403770]">Find Contacts</span>
            <span className="rounded px-1.5 py-0.5 text-[10px] font-bold text-white bg-[#F37167]">
              {selectionCount} district{selectionCount !== 1 ? "s" : ""}
            </span>
          </div>

          {/* Role dropdown */}
          <label className="block text-[10px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
            Target Role
          </label>
          <div className="relative mb-3">
            <select
              value={selectedRole}
              onChange={(e) => setSelectedRole(e.target.value as TargetRole)}
              className="w-full appearance-none px-3 py-2 pr-8 text-[13px] text-[#403770] bg-[#F7F5FA] border border-[#EFEDF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
            >
              {TARGET_ROLES.map((role) => (
                <option key={role} value={role}>{role}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#403770]/40 pointer-events-none" />
          </div>

          {/* School level checkboxes (Principal only) */}
          {selectedRole === "Principal" && (
            <div className="mb-3">
              <label className="block text-[10px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
                School Level
              </label>
              <div className="flex flex-col gap-1.5">
                {[{ value: 1, label: "Primary" }, { value: 2, label: "Middle" }, { value: 3, label: "High" }].map(
                  ({ value, label }) => (
                    <label key={value} className="flex items-center gap-2 text-[13px] text-[#403770] cursor-pointer">
                      <input
                        type="checkbox"
                        aria-label={label}
                        checked={schoolLevels.has(value)}
                        onChange={(e) =>
                          setSchoolLevels((prev) => {
                            const next = new Set(prev);
                            e.target.checked ? next.add(value) : next.delete(value);
                            return next;
                          })
                        }
                        className="w-3.5 h-3.5 accent-[#403770]"
                      />
                      {label}
                    </label>
                  )
                )}
              </div>
            </div>
          )}

          {/* Progress bar when enriching */}
          {isEnriching && progress && progress.queued > 0 && (
            <div className="flex items-center gap-2 mb-3">
              <div className="flex-1 h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
                <div className="h-full bg-[#8AA891] rounded-full transition-all duration-500" style={{ width: `${progressPercent}%` }} />
              </div>
              <span className="text-[11px] text-[#403770]/60 whitespace-nowrap">{progress.enriched}/{progress.queued}</span>
            </div>
          )}

          <button
            type="button"
            aria-label="Start enrichment"
            disabled={isDisabled}
            onClick={handleStart}
            className="w-full flex items-center justify-center gap-2 px-3 py-2 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
          >
            {(bulkEnrich.isPending || resolving) && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
            {bulkEnrich.isPending || resolving ? "Starting…" : "Start enrichment"}
          </button>
        </div>
      </AnchoredPopover>

      {modalState && (
        <ExistingContactsModal
          planId={planId}
          variant={modalState.variant}
          districtCount={modalState.districtCount}
          newCount={modalState.newCount}
          onClose={() => setModalState(null)}
        />
      )}

      {/* Toast */}
      {toast && (
        <div
          role="status"
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium flex items-center gap-3 ${
            toast.type === "success" ? "bg-[#8AA891] text-white"
              : toast.type === "warning" ? "bg-amber-500 text-white"
              : toast.type === "error" ? "bg-red-500 text-white"
              : "bg-[#403770] text-white"
          }`}
        >
          <span>{toast.message}</span>
          {toast.action && (
            <button
              type="button"
              onClick={toast.action.onClick}
              disabled={expandRollup.isPending}
              className="inline-flex items-center px-2.5 py-1 text-[12px] font-semibold text-white bg-white/20 hover:bg-white/30 disabled:opacity-50 rounded-md whitespace-nowrap"
            >
              {expandRollup.isPending ? "Expanding…" : toast.action.label}
            </button>
          )}
        </div>
      )}
    </>
  );
}
```

- [ ] **Step 4: Run tests — expect PASS**

```bash
npx vitest run "src/features/views/components/grid/actions/__tests__/FindContactsPopover.test.tsx" 2>&1 | tail -20
```

- [ ] **Step 5: Commit**

```bash
git add src/features/views/components/grid/actions/FindContactsPopover.tsx \
        "src/features/views/components/grid/actions/__tests__/FindContactsPopover.test.tsx"
git commit -m "feat(views): FindContactsPopover for bulk enrichment"
```

---

## Task 7: Frontend — GridView selection state, checkboxes, selection bar

Wire selection into `GridView`. The checkbox column is rendered manually (not as a TanStack column) so it is immune to column visibility settings. The selection bar appears between the filter strip and the table.

**Files:**
- Modify: `src/features/views/components/grid/GridView.tsx`
- Modify: `src/features/views/components/grid/__tests__/GridView.test.tsx`

- [ ] **Step 1: Add selection tests to the existing GridView test file**

Open `src/features/views/components/grid/__tests__/GridView.test.tsx` and add:

```tsx
// Add these imports at the top if not already present:
// import { fireEvent } from "@testing-library/react";

describe("GridView — bulk selection (plan/districts context)", () => {
  it("renders a checkbox column when showRowActions is enabled", () => {
    // Render with parentKind='plan', source='districts', mock q.data with 2 rows
    // Assert: checkboxes are in the document
  });

  it("header checkbox selects all page rows", () => {
    // Click header checkbox → all row checkboxes become checked
    // Selection bar appears with correct count
  });

  it("'Select all N' promote link switches to all-filtered mode", () => {
    // After all-page selected, click promote link
    // Assert: plum banner shows "All N filtered districts selected"
  });

  it("clear button resets to no selection", () => {
    // After all-filtered, click clear
    // Assert: selection bar gone
  });

  it("querySig change resets selection to none", () => {
    // Select some rows, then change filters prop
    // Assert: selection bar disappears
  });
});
```

> **Note:** These tests depend on the existing GridView test harness setup. Look at the existing tests in this file for the correct mock and wrapper pattern. The test bodies above are outlines — fill them in following the same render + assertion style used for existing GridView tests.

- [ ] **Step 2: Run existing GridView tests to confirm baseline passes**

```bash
npx vitest run "src/features/views/components/grid/__tests__/GridView.test.tsx" 2>&1 | tail -20
```

Expected: all existing tests pass (new tests may be skipped if they have empty bodies — that is fine, flesh them out as you go).

- [ ] **Step 3: Add `SelectionState` type and state to GridView**

At the top of `GridView.tsx`, after the existing imports, add:

```tsx
import { BulkActionsMenu, type SelectionState } from "./actions/BulkActionsMenu";
```

Inside `GridView` (after `const [collapsedGroups, ...]`), add:

```tsx
const [selection, setSelection] = useState<SelectionState>({ mode: "none" });
const [prevPageForSel, setPrevPageForSel] = useState(effectivePage);
```

Inside the `querySig` change block, add the selection reset:

```tsx
if (prevQuerySig !== querySig) {
  setPrevQuerySig(querySig);
  setPage(1);
  effectivePage = 1;
  setSelection({ mode: "none" }); // ← add this line
}
```

After that block, add page-change explicit selection reset:

```tsx
if (prevPageForSel !== effectivePage) {
  setPrevPageForSel(effectivePage);
  if (selection.mode === "explicit") {
    setSelection({ mode: "none" });
  }
}
```

- [ ] **Step 4: Add checkbox column to the table header**

In the `<tr className="bg-[#F7F5FA]">` header row (inside `<thead>`), prepend a `<th>` before the existing headers map:

```tsx
{showRowActions && (
  <th
    style={{ width: 36 }}
    className="py-2.5 px-2.5 border-b border-[#D4CFE2] bg-[#F7F5FA]"
  >
    {rows.length > 0 && (
      <input
        type="checkbox"
        aria-label="Select all on page"
        className="h-3.5 w-3.5 rounded accent-[#403770] cursor-pointer"
        checked={
          selection.mode === "all-filtered" ||
          (selection.mode === "explicit" &&
            rows.every(
              (r) =>
                typeof r.leaid === "string" &&
                selection.leaids.has(r.leaid)
            ))
        }
        ref={(el) => {
          // Indeterminate when some (not all) page rows are selected.
          if (el) {
            el.indeterminate =
              selection.mode === "explicit" &&
              selection.leaids.size > 0 &&
              !rows.every(
                (r) =>
                  typeof r.leaid === "string" &&
                  selection.leaids.has(r.leaid)
              );
          }
        }}
        onChange={(e) => {
          if (e.target.checked) {
            const pageLeaids = new Set(
              rows
                .map((r) => r.leaid)
                .filter((l): l is string => typeof l === "string")
            );
            setSelection({ mode: "explicit", leaids: pageLeaids });
          } else {
            setSelection({ mode: "none" });
          }
        }}
      />
    )}
  </th>
)}
```

Also add the corresponding spacer `<th>` to the grouped header row when `hasGroups` is true — append `{showRowActions && <th aria-hidden className="border-b border-[#EFEDF5]" />}` as the first cell.

- [ ] **Step 5: Add checkbox cell to each body row**

In `renderBody()`, in both the non-grouped and grouped row renderers, prepend a `<td>` before `row.getVisibleCells().map(...)`:

```tsx
{showRowActions && (
  <td
    className="py-2.5 px-2.5 border-b border-[#EFEDF5]"
    onClick={(e) => {
      e.stopPropagation(); // prevent row click from firing
      const leaid =
        typeof row.original.leaid === "string" ? row.original.leaid : null;
      if (!leaid) return;
      setSelection((prev) => {
        if (prev.mode === "all-filtered") {
          // Clicking a row while in all-filtered deselects that row
          // and moves to explicit mode with all-but-one.
          const allPageLeaids = new Set(
            rows
              .map((r) => r.leaid)
              .filter((l): l is string => typeof l === "string" && l !== leaid)
          );
          return { mode: "explicit", leaids: allPageLeaids };
        }
        const next = new Set(prev.mode === "explicit" ? prev.leaids : []);
        next.has(leaid) ? next.delete(leaid) : next.add(leaid);
        return next.size === 0
          ? { mode: "none" }
          : { mode: "explicit", leaids: next };
      });
    }}
  >
    <input
      type="checkbox"
      aria-label={`Select ${typeof row.original.name === "string" ? row.original.name : "district"}`}
      className="h-3.5 w-3.5 rounded accent-[#403770] cursor-pointer"
      readOnly
      checked={
        selection.mode === "all-filtered" ||
        (selection.mode === "explicit" &&
          typeof row.original.leaid === "string" &&
          selection.leaids.has(row.original.leaid))
      }
    />
  </td>
)}
```

- [ ] **Step 6: Add the selection bar between filter strip and table**

In the `return (...)` of GridView, between the filter-chips `<div>` and `{truncated && <TruncatedBanner />}`, add:

```tsx
{/* Selection bar — only when selection is active in plan/districts context */}
{showRowActions && selection.mode !== "none" && (
  <div
    className={`shrink-0 flex items-center gap-2 px-3 py-2 text-[12px] border-b ${
      selection.mode === "all-filtered"
        ? "bg-[#403770] border-[#322a5a] text-white"
        : "bg-[#EFEDF5] border-[#D4CFE2] text-[#403770]"
    }`}
  >
    {selection.mode === "all-filtered" ? (
      <>
        <svg className="h-3.5 w-3.5 shrink-0" fill="none" stroke="currentColor" strokeWidth={2.5} viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" d="M20 6L9 17l-5-5" />
        </svg>
        <span className="font-semibold whitespace-nowrap">
          All {selection.total} filtered districts selected
        </span>
        <button
          type="button"
          onClick={() => setSelection({ mode: "none" })}
          className="ml-auto text-white/70 hover:text-white transition-colors whitespace-nowrap"
          aria-label="Clear selection"
        >
          ✕ Clear
        </button>
      </>
    ) : (
      <>
        <span className="font-semibold whitespace-nowrap">
          {selection.leaids.size} of {rows.length} on this page selected
        </span>
        {/* Promote to all-filtered when all page rows are selected */}
        {rows.every(
          (r) =>
            typeof r.leaid === "string" && selection.leaids.has(r.leaid)
        ) && total > rows.length && (
          <>
            <span className="text-[#A69DC0]">·</span>
            <button
              type="button"
              onClick={() =>
                setSelection({ mode: "all-filtered", total })
              }
              className="font-semibold text-[#403770] underline underline-offset-2 whitespace-nowrap"
            >
              Select all {total}
            </button>
          </>
        )}
        <button
          type="button"
          onClick={() => setSelection({ mode: "none" })}
          className="ml-2 text-[#A69DC0] hover:text-[#403770] transition-colors"
          aria-label="Clear selection"
        >
          ✕
        </button>
      </>
    )}

    {/* Bulk Actions button — always right-aligned */}
    <div className={selection.mode === "all-filtered" ? "ml-0" : "ml-auto"}>
      <BulkActionsMenu
        planId={planId!}
        planLeaids={leaids ?? []}
        selection={selection as Exclude<SelectionState, { mode: "none" }>}
        layout={layout}
        onSelectionCleared={() => setSelection({ mode: "none" })}
      />
    </div>
  </div>
)}
```

- [ ] **Step 7: Run all affected tests**

```bash
npx vitest run \
  "src/features/views/components/grid/__tests__/GridView.test.tsx" \
  "src/features/views/components/grid/__tests__/GridView.rowactions.test.tsx" \
  "src/features/views/components/grid/__tests__/GridView.pagination.test.tsx" \
  2>&1 | tail -30
```

Expected: all existing tests pass. Fix any type errors surfaced by the new import.

- [ ] **Step 8: Smoke test in browser**

```bash
npm run dev -- --port 3005
```

1. Open a plan Table view: `http://localhost:3005/views/plans/<planId>/table`
2. Apply a State filter — verify checkbox column appears
3. Check 2–3 rows — verify selection bar shows count
4. Click header checkbox — verify all 50 page rows check and "Select all N" promote link appears
5. Click "Select all N" — verify purple banner appears
6. Open Bulk Actions — verify 3 menu items
7. Click "Remove from plan" → confirm → rows disappear and selection resets
8. Try Export CSV — verify file downloads with correct columns
9. Clear selection — bar disappears

- [ ] **Step 9: Run full test suite**

```bash
npx vitest run 2>&1 | tail -20
```

Expected: no regressions. If the flaky tile test fires, note it as pre-existing.

- [ ] **Step 10: Commit**

```bash
git add src/features/views/components/grid/GridView.tsx \
        "src/features/views/components/grid/__tests__/GridView.test.tsx"
git commit -m "feat(views): bulk selection + checkboxes + BulkActionsMenu wiring in GridView"
```

---

## Final commit — branch ready for PR

```bash
git log --oneline -8
```

Expected log (newest first):
```
feat(views): bulk selection + checkboxes + BulkActionsMenu wiring in GridView
feat(views): FindContactsPopover for bulk enrichment
feat(views): BulkActionsMenu component
feat(api): district export endpoint (no pagination cap)
feat(api): bulk remove districts endpoint + useBulkRemoveDistrictsFromPlan
feat(api): scope bulk-enrich to optional leaids subset
refactor(plans): extract useBulkEnrichFlow; add leaids param to useBulkEnrich
```
