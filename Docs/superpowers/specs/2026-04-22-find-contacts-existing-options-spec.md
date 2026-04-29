# Feature Spec: Existing-Contacts Options Modal (Find Contacts)

**Date:** 2026-04-22
**Slug:** find-contacts-existing-options
**Branch:** worktree-find-contacts-existing-options
**Trigger screenshot:** plan had NYC DOE; "Find Contacts" returned queued=0; UI dead-ended with a toast while contacts actually existed in the DB.

## Problem

When a user clicks **Find Contacts** on a territory plan and all target districts already have contacts in the `contacts` table, the bulk-enrich endpoint returns `{ queued: 0 }` and the UI shows a dismissive info toast: *"Nothing to enrich — all targets already have contacts."* The user is left with no path forward — they don't know where those contacts are, why this plan's Contacts tab may show zero, or how to reach the enriched data.

The same dead-end occurs in the **partial case**: when some districts are enriched on this run and others are skipped because they already had contacts, the user gets a generic "N found" toast with no acknowledgment of the pre-existing data.

## Requirements

- Replace the dismissive toast with a **modal** that gives the user two concrete paths forward.
- Two actions, side-by-side, presented together so the user can choose without navigation:
  1. **Show them here** — refresh the Contacts tab so existing contacts become visible on the current plan.
  2. **Open another plan** — pick from a list of other plans that share districts with this one and already have contacts on those districts.
- Handle partial overlap: when enrichment completes and some districts were skipped because they already had contacts, surface the same modal (with a completion-variant header) after the success toast.
- No data-model changes. Contacts remain leaid-keyed; "pull in" means refresh the current plan's query, not create new associations.
- Other-plans list is discovered via **district overlap** (not contact→plan lineage), since `Contact` has no direct `planId` linkage. Team-wide visibility, ranked by contact count then recency, capped at 10.

## Visual Design

**Chosen direction:** Split-action modal (Direction A from Stage 2).

### Container
- `max-w-2xl`, `rounded-2xl shadow-xl`, `bg-white`
- Backdrop: `bg-black/40`, click-to-dismiss
- Keyboard: `Esc` closes; `Tab` cycles inside; focus trap on open
- On open: focus the "Show them here" primary button
- Per `Documentation/UI Framework/Components/Containers/modal.md`

### Header
- Variant A title: **"Contacts already exist"**
- Variant B title: **"Enrichment complete"**
- Close `×` button (per `_foundations.md`)

### Variant A — queued=0 (dead-end replacement)
- Subline: *"Contacts for {N} district{s} in this plan are already in the system. They may not be showing on this tab yet."*

### Variant B — partial completion (post-enrichment)
- Status row (green check): *"Found {queued} new contact{s} for {newCount} district{s}."*
- Subline: *"{skippedCount} district{s} already had contacts."*

### Body — two columns (stacks vertically below `md:`)

**Left column — "Show them here"**
- h3: "Show them here"
- Description: "Refresh the Contacts tab to reveal existing contacts for this plan's districts."
- Primary button: "Show them here" (`bg-[#403770] text-white rounded-lg px-4 py-2 text-sm font-medium`)
- Loading state: button spinner while refetch is pending
- Action: invalidate the plan-contacts query for `planId`, then close modal, then scroll first populated district group into view

**Right column — "Open another plan"**
- h3: "Open another plan"
- Description: "These plans share districts and already have contacts."
- Plan rows (up to 3 visible by default), each clickable → navigates to that plan
- Row content: plan name · owner display name · `{sharedDistrictCount} district{s} · {contactCount} contacts · Last enriched {relativeDate}`
- Hover: `bg-[#F7F5FA]`, cursor pointer
- "See all {N}" link shown if `plans.length > 3`; expands list inline (no new view)
- Loading state: 3 skeleton rows while `useContactSources` fetches
- Empty state: "No other plans contain these districts yet." — column becomes informational only
- Error state: "Couldn't load other plans. [Retry]" (retries the query)

## Component Plan

### New components
- `src/features/plans/components/ExistingContactsModal.tsx`
  - Props: `{ planId: string; planName: string; variant: "queued-zero" | "partial"; districtCount: number; newCount?: number; skippedCount?: number; onClose: () => void }`
  - Follows modal doc: `rounded-2xl`, `bg-black/40`, close button in header
  - Renders both columns; internally consumes `useContactSources(planId)`

### Existing components to reuse
- Modal structure pattern from `Documentation/UI Framework/Components/Containers/modal.md`
- Existing modal references (note: existing modals use `rounded-xl`; new work uses canonical `rounded-2xl`):
  - `src/features/plans/components/PlanFormModal.tsx`
  - `src/features/activities/components/ActivityFormModal.tsx`
- Button patterns from `Documentation/UI Framework/Components/Navigation/buttons.md`
- Relative-date formatting from `src/features/shared/lib/format.ts`

### Components to modify
- `src/features/plans/components/ContactsActionBar.tsx`
  - Replace line 131 `setToast({ message: "Nothing to enrich — all targets already have contacts", ... })` with modal-open
  - Add state: `const [existingContactsModal, setExistingContactsModal] = useState<ModalState | null>(null)`
  - In the completion-detection effect (currently lines 88-109), when `progress.enriched >= progress.queued` AND the response had `skipped > 0`, open the modal in `"partial"` variant after the success toast fires

## Backend Design

See: `docs/superpowers/specs/2026-04-22-find-contacts-existing-options-backend-context.md`

### New API route
`GET /api/territory-plans/[id]/contact-sources`

**File:** `src/app/api/territory-plans/[id]/contact-sources/route.ts`

**Behavior:**
1. `getUser()` — return 401 if unauthenticated
2. Fetch current plan's district leaids (via `TerritoryPlan.districts`)
3. If 0 districts → return `{ plans: [] }`
4. Query other plans (≠ current plan) where at least one district leaid overlaps AND at least one contact exists for a shared leaid
5. For each candidate plan, compute:
   - `sharedDistrictCount` — count of leaids in plan ∩ current plan's leaids
   - `contactCount` — distinct `Contact.id` count across shared leaids
   - `lastEnrichedAt` — max of `Contact.lastEnrichedAt` across shared leaids (nullable)
6. Rank by `contactCount DESC, lastEnrichedAt DESC NULLS LAST`
7. Limit to top 10
8. Include `ownerName` via `profile` join on `TerritoryPlan.ownerId`

**Response shape:**
```ts
{
  plans: Array<{
    id: string;
    name: string;
    ownerName: string | null;
    sharedDistrictCount: number;
    contactCount: number;
    lastEnrichedAt: string | null; // ISO
  }>
}
```

**Auth scope:** team-wide (mirrors `/api/territory-plans` list endpoint precedent — both plan list and `/contacts` GET use empty `whereClause` with "team shares visibility across plans" comment).

### New TanStack hook
`useContactSources(planId)` in `src/features/plans/lib/queries.ts`

- Query key: `['plan-contact-sources', planId]` (stable primitive — per CLAUDE.md performance rules)
- Enabled when `planId` is truthy
- Standard fetcher, no polling

### Query-cache invalidation
`"Show them here"` handler calls:
```ts
queryClient.invalidateQueries({ queryKey: ['plan-contacts', planId] });
```
(Confirm exact key in impl — check `usePlanContacts` definition in `src/lib/api.ts` or `src/features/plans/lib/queries.ts`.)

## States

| State | Element | Approach |
|---|---|---|
| Loading | Right column | 3 skeleton rows |
| Loading | "Show them here" button | Inline spinner, button disabled |
| Empty | Right column | "No other plans contain these districts yet." |
| Error | Right column | "Couldn't load other plans. [Retry]" |
| Keyboard dismiss | Modal | Esc key closes |
| Backdrop dismiss | Modal | Click-outside closes |
| Responsive | Body | Two columns on `md:` and above; stacked single column below |

## Trigger Logic Summary

```
onSubmit bulkEnrich -> response { total, skipped, queued }

if queued === 0:
  open modal (variant: "queued-zero", districtCount: skipped)

elif queued > 0 && skipped > 0:
  setIsEnriching(true)
  show existing "Looking for N contacts" toast (unchanged)
  ... on completion (progress.enriched >= progress.queued):
    show success toast (unchanged)
    open modal (variant: "partial", newCount: queued, skippedCount: skipped)

elif queued > 0 && skipped === 0:
  existing flow unchanged (no modal)
```

## Test Strategy

- **Modal component:** `src/features/plans/components/__tests__/ExistingContactsModal.test.tsx` — both variants, loading / empty / error states, keyboard + backdrop dismiss, button actions
- **API route:** `src/app/api/territory-plans/[id]/contact-sources/__tests__/route.test.ts` — auth 401, empty districts, no overlap, ranking, limit 10, ownerName join
- **Integration:** extend `src/features/plans/components/__tests__/ContactsActionBar.test.tsx` — modal opens on queued=0, opens on partial completion, does not open on queued>0 skipped=0
- **Vitest + Testing Library + jsdom** per CLAUDE.md testing conventions

## Out of Scope

- Root-cause investigation of why the plan's Contacts tab showed 0 in the screenshot despite contacts existing in DB. `"Show them here"` sidesteps it via query invalidation; the actual rendering bug (if any) is a separate follow-up.
- Any change to how contacts are stored or associated (no new join tables, no copying).
- Re-enriching districts that already have contacts.
- Role-specific messaging (copy is role-agnostic). Principal-vs-Superintendent nuance is handled silently — the modal just says "contacts already exist."
- Changes to `Find Contacts` popover (role picker, school-level filters) itself.
- Activity-feed integration for "user opened another plan from the modal" — no audit trail change.
