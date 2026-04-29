# Implementation Plan: Existing-Contacts Options Modal

**Spec:** `Docs/superpowers/specs/2026-04-22-find-contacts-existing-options-spec.md`
**Backend context:** `Docs/superpowers/specs/2026-04-22-find-contacts-existing-options-backend-context.md`
**Branch:** `worktree-find-contacts-existing-options`

## Ordering & Parallelism

Two parallel tracks — backend (B) and frontend (F) — coordinated by the endpoint contract already locked in the spec. Final integration commit merges both.

```
B1: /contact-sources route ─┐
B2: /contact-sources tests ─┤
                            ├─► Merge & verify ► Stage 7 review
F1: useContactSources hook ─┤
F2: ExistingContactsModal ──┤
F3: ContactsActionBar wire ─┤
F4: Modal tests ────────────┤
F5: ActionBar tests ────────┘
```

B and F tracks run in parallel. Within F, order is F1 → F2 → F3 (F3 imports F2; F2 consumes F1). Tests co-located at end of each track.

---

## Track B — Backend

### B1. New route: `GET /api/territory-plans/[id]/contact-sources`

**File:** `src/app/api/territory-plans/[id]/contact-sources/route.ts`

**Steps:**
1. Scaffold Next.js 16 App Router route (`export const dynamic = "force-dynamic"`), import `NextRequest, NextResponse`, `prisma`, `getUser`.
2. Extract `id` from `params` (Next 16 promise pattern: `const { id } = await params`).
3. `getUser()` → 401 if unauthenticated.
4. Fetch current plan:
   ```ts
   const plan = await prisma.territoryPlan.findUnique({
     where: { id },
     include: { districts: { select: { districtLeaid: true } } },
   });
   if (!plan) return 404;
   const leaids = plan.districts.map(d => d.districtLeaid);
   if (leaids.length === 0) return NextResponse.json({ plans: [] });
   ```
5. Find candidate other plans sharing ≥1 leaid:
   ```ts
   const candidates = await prisma.territoryPlan.findMany({
     where: {
       id: { not: id },
       districts: { some: { districtLeaid: { in: leaids } } },
     },
     include: {
       districts: {
         where: { districtLeaid: { in: leaids } },
         select: { districtLeaid: true },
       },
     },
   });
   ```
6. Fetch contact counts + last-enriched per leaid in a single groupBy:
   ```ts
   const contactAgg = await prisma.contact.groupBy({
     by: ["leaid"],
     where: { leaid: { in: leaids } },
     _count: { _all: true },
     _max: { lastEnrichedAt: true },
   });
   const byLeaid = new Map(contactAgg.map(a => [a.leaid, { count: a._count._all, lastEnriched: a._max.lastEnrichedAt }]));
   ```
7. Fetch owner display names (single `profile.findMany` keyed by distinct `ownerId`s).
8. For each candidate, compute:
   - `sharedDistrictCount = plan.districts.length` (the includes-filter returned only shared ones)
   - `contactCount = sum of byLeaid[leaid].count for each shared leaid`
   - `lastEnrichedAt = max of byLeaid[leaid].lastEnriched across shared leaids`
9. **Filter out candidates where `contactCount === 0`** (only return plans that actually have contacts on shared districts).
10. Rank: `contactCount DESC, lastEnrichedAt DESC NULLS LAST, name ASC`.
11. Limit 10.
12. Serialize:
    ```ts
    return NextResponse.json({
      plans: ranked.map(p => ({
        id: p.id,
        name: p.name,
        ownerName: p.ownerName ?? null,
        sharedDistrictCount: p.sharedDistrictCount,
        contactCount: p.contactCount,
        lastEnrichedAt: p.lastEnrichedAt?.toISOString() ?? null,
      })),
    });
    ```
13. Wrap in try/catch → 500 on error with console.error.

**Auth scope:** team-wide (no `userId`/`ownerId` filter) — matches `/api/territory-plans` list endpoint precedent per backend-context doc.

**Profile join:** check existing plan-list endpoint for the profile lookup pattern (likely `prisma.profile.findMany({ where: { id: { in: ownerIds } } })` with a `name` or `displayName` field).

### B2. Route tests

**File:** `src/app/api/territory-plans/[id]/contact-sources/__tests__/route.test.ts`

Mirror the structure of `src/app/api/territory-plans/[id]/contacts/bulk-enrich/__tests__/route.test.ts`:
- Mock `@/lib/supabase/server.getUser` and `@/lib/prisma`
- Pass `params` as `Promise.resolve({ id })`

**Cases:**
1. 401 when `getUser` returns null
2. 404 when plan not found
3. Returns `{ plans: [] }` when current plan has no districts
4. Returns `{ plans: [] }` when no other plan shares any district
5. Returns `{ plans: [] }` when overlapping plans exist but NONE have contacts on the shared districts
6. Single-overlap happy path: one other plan, one shared district, 5 contacts → returns 1 row with correct shape
7. Ranking: 3 overlapping plans with (12, 5, 5) contacts — returns (12, 5, 5), breaks tie on `lastEnrichedAt`
8. Limit: 15 overlapping plans → returns top 10
9. Owner name join: plan without an owner → `ownerName: null`

---

## Track F — Frontend

### F1. `useContactSources(planId)` hook

**File:** `src/features/plans/lib/queries.ts` (add near `usePlanContacts` at line 245)

```ts
export interface ContactSourcePlan {
  id: string;
  name: string;
  ownerName: string | null;
  sharedDistrictCount: number;
  contactCount: number;
  lastEnrichedAt: string | null;
}

export function useContactSources(planId: string | null) {
  return useQuery({
    queryKey: ["planContactSources", planId],
    queryFn: () =>
      fetchJson<{ plans: ContactSourcePlan[] }>(
        `${API_BASE}/territory-plans/${planId}/contact-sources`
      ),
    enabled: !!planId,
    staleTime: 2 * 60 * 1000,
  });
}
```

- Query key uses stable primitive (`planId` string) per CLAUDE.md perf rules.
- `staleTime` matches `usePlanContacts` precedent.

### F2. `ExistingContactsModal` component

**File:** `src/features/plans/components/ExistingContactsModal.tsx`

**Props:**
```ts
interface ExistingContactsModalProps {
  planId: string;
  variant: "queued-zero" | "partial";
  districtCount: number;        // queued-zero: count of skipped districts; partial: count of skipped
  newCount?: number;            // partial only: enriched count
  onClose: () => void;
}
```

**Structure:**
- Backdrop `<div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />`
- Modal `<div className="fixed inset-0 z-50 flex items-center justify-center">`
  - Content: `bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col`
- Header: title + `×` close button (follow `Documentation/UI Framework/Components/Containers/modal.md` → `_foundations.md`)
  - Variant "queued-zero" title: `Contacts already exist`
  - Variant "partial" title: `Enrichment complete`
- Subline (below title, inside body):
  - queued-zero: `Contacts for {districtCount} district{pluralize} in this plan are already in the system. They may not be showing on this tab yet.`
  - partial: green-dot status line `Found {newCount} new contact{s} for {newCount} district{s}.` + `{districtCount} district{s} already had contacts.`
- Body two-column grid: `grid grid-cols-1 md:grid-cols-2 gap-6 p-6`

**Left column:**
```tsx
<div>
  <h3 className="text-base font-semibold text-[#403770] mb-2">Show them here</h3>
  <p className="text-sm text-[#6E6390] mb-4">
    Refresh the Contacts tab to reveal existing contacts for this plan's districts.
  </p>
  <button
    onClick={handleShowHere}
    disabled={isRefreshing}
    className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50"
  >
    {isRefreshing ? "Refreshing…" : "Show them here"}
  </button>
</div>
```

`handleShowHere`:
```ts
const handleShowHere = async () => {
  setIsRefreshing(true);
  try {
    await queryClient.invalidateQueries({ queryKey: ["planContacts", planId] });
    onClose();
    // Optional: scroll into view — stretch goal
  } finally {
    setIsRefreshing(false);
  }
};
```

**Right column:**
- Consume `useContactSources(planId)`
- States:
  - Loading: render 3 skeleton rows (`animate-pulse bg-[#EFEDF5] h-14 rounded-lg`)
  - Error: `<p className="text-sm text-[#F37167]">Couldn't load other plans. <button onClick={refetch} className="underline">Retry</button></p>`
  - Empty: `<p className="text-sm text-[#6E6390]">No other plans contain these districts yet.</p>`
  - Success: list of plan rows
- Plan row (`<a href={/plans/${plan.id}}>` — no JS nav, use native `<a>` to preserve middle-click/new-tab):
  ```tsx
  <a
    href={`/plans/${plan.id}`}
    className="block p-3 rounded-lg hover:bg-[#F7F5FA] transition-colors border border-[#E2DEEC]"
  >
    <div className="flex items-center justify-between">
      <span className="text-sm font-medium text-[#403770]">{plan.name}</span>
      <span className="text-xs text-[#6E6390]">{plan.ownerName ?? "Unassigned"}</span>
    </div>
    <div className="mt-1 text-xs text-[#6E6390]">
      {pluralize(plan.sharedDistrictCount, "district")} · {pluralize(plan.contactCount, "contact")}
      {plan.lastEnrichedAt && ` · Last enriched ${relativeDate(plan.lastEnrichedAt)}`}
    </div>
  </a>
  ```
- Collapsed/expanded behavior:
  - Default: show first 3 rows
  - If `plans.length > 3`: show "See all {N}" toggle → reveals remaining rows inline
  - State: `const [showAll, setShowAll] = useState(false)`

**Helpers:**
- `pluralize(n, word)` — local helper or check for existing in `src/features/shared/lib/format.ts`
- `relativeDate(iso)` — check `src/features/shared/lib/format.ts`; use existing if available, else write inline

**Keyboard & dismiss:**
- `useEffect` Esc-to-close listener
- Focus "Show them here" button on mount (`useEffect` + ref)
- Focus trap: use existing pattern from codebase (check `src/features/plans/components/PlanFormModal.tsx` for reference). If no shared util, write a minimal trap inline

**Icon:** Lucide `CheckCircle2` (green) for partial-variant status row; `X` for close button.

### F3. Wire into `ContactsActionBar.tsx`

**File:** `src/features/plans/components/ContactsActionBar.tsx`

**Changes:**

1. Add state at top of component:
```ts
const [modalState, setModalState] = useState<
  { variant: "queued-zero" | "partial"; districtCount: number; newCount?: number } | null
>(null);
```

2. In `handleStartEnrichment` (around line 130), replace:
```ts
if (result.queued === 0) {
  setToast({ message: "Nothing to enrich — all targets already have contacts", type: "info" });
  return;
}
```
with:
```ts
if (result.queued === 0) {
  setModalState({ variant: "queued-zero", districtCount: result.skipped });
  return;
}

// Stash partial info so completion effect can trigger modal
if (result.skipped > 0) {
  pendingPartialRef.current = { newCount: result.queued, skippedCount: result.skipped };
}
```

3. Add ref at component top: `const pendingPartialRef = useRef<{ newCount: number; skippedCount: number } | null>(null);`

4. In the completion-detection effect (lines 88-97), after `setToast({ message: "Contact enrichment complete — ..." })`, add:
```ts
if (pendingPartialRef.current) {
  setModalState({
    variant: "partial",
    districtCount: pendingPartialRef.current.skippedCount,
    newCount: pendingPartialRef.current.newCount,
  });
  pendingPartialRef.current = null;
}
```

5. At bottom of JSX, before closing wrapper, render the modal conditionally:
```tsx
{modalState && (
  <ExistingContactsModal
    planId={planId}
    variant={modalState.variant}
    districtCount={modalState.districtCount}
    newCount={modalState.newCount}
    onClose={() => setModalState(null)}
  />
)}
```

6. Import `ExistingContactsModal` at top of file.

**Not touched:**
- Find Contacts popover
- Toast rendering
- CSV export
- Enrichment progress polling

### F4. Modal tests

**File:** `src/features/plans/components/__tests__/ExistingContactsModal.test.tsx`

Cases:
1. Renders `queued-zero` variant with correct title and subline
2. Renders `partial` variant with status line + skipped message
3. Renders 3 skeleton rows in loading state
4. Renders empty state when `plans: []`
5. Renders error state + retry button when hook errors
6. Renders first 3 plan rows by default; "See all" toggles remaining
7. "Show them here" button invalidates `["planContacts", planId]` and calls `onClose`
8. Escape key calls `onClose`
9. Backdrop click calls `onClose`
10. Plan row is a native `<a href="/plans/...">` (preserves middle-click)

Use MSW or direct hook mock for `useContactSources`. Reference `src/features/plans/components/__tests__/ContactsActionBar.test.tsx` for mock patterns.

### F5. ActionBar test extension

**File:** `src/features/plans/components/__tests__/ContactsActionBar.test.tsx`

Add cases:
1. `queued: 0, skipped: 1` response → modal opens in `queued-zero` variant, NOT the "Nothing to enrich" toast
2. `queued: 2, skipped: 1` response → no modal on submit, but when `useEnrichProgress` reports completion, modal opens in `partial` variant
3. `queued: 2, skipped: 0` response → no modal; behavior unchanged (existing tests)

---

## Cross-track integration

After both tracks land:

1. Run `npx vitest run` → all tests pass
2. Run `npm run build` → type-checks, no errors
3. Manual smoke (dev server): click Find Contacts on a plan whose districts all have contacts → modal appears with correct content and working actions

## Commit strategy

One commit per track logical unit:
- `feat(api): GET /api/territory-plans/[id]/contact-sources` (B1 + B2)
- `feat(plans): ExistingContactsModal replaces dead-end toast on Find Contacts` (F1 + F2 + F3)
- `test(plans): coverage for ExistingContactsModal + ContactsActionBar modal triggers` (F4 + F5)

All on the worktree branch, rebased if needed before merge.

## Risks & mitigations

| Risk | Mitigation |
|---|---|
| `profile` schema field names differ from assumption | B1 step 7: grep existing plan-list endpoint before committing to field name |
| `usePlanContacts` queryKey drifts from `["planContacts", planId]` | F2 `handleShowHere` imports the exact key constant or reuses the hook's invalidation helper if one exists |
| Focus trap implementation diverges from existing modals | F2: copy the pattern from `PlanFormModal.tsx` exactly; don't invent |
| `/plans/{id}` route not the right URL for the workspace | F2: verify via `grep href.*plans/` — already confirmed via `PlanCard.tsx:78` |
| Partial-completion trigger fires twice on re-render | F3: gate on `pendingPartialRef.current` being non-null; clear immediately after use |
