# Feature Spec: Activities + Calendar Redesign

**Date:** 2026-04-27
**Slug:** activities-calendar-redesign
**Branch:** `worktree-activities-calendar-redesign`
**Scope:** Full implementation per `design_handoff_activities_calendar/README.md`, building on commit `8b0c9371` scaffold.

## Requirements

Full redesign of the Activities page in territory-plan, combining activity log + calendar + pipeline deals + field-trip planning into one unified surface. Reps see their work across four pivots (Month, Week grid, Schedule, Map-over-time), filter and save views, get a contextual Upcoming rail, and drill into any activity in a 5-tab editable drawer.

**Source of truth:** `design_handoff_activities_calendar/README.md` + `reference/components/*.jsx`.

**Audience:** Sales reps (daily-use). Performance + UX defaults from `CLAUDE.md` apply: pagination at 50, stable query keys, batched store mutations, narrow store subscriptions, default owner = current user, default rep filter = current user.

## Locked decisions

| Decision | Choice | Rationale |
|---|---|---|
| Map-over-time fidelity | Real MapLibre embed | Reuse `src/features/map/lib/layers.ts`. Pin clustering by district. |
| Drawer save model | Auto-save per field + "Saved" flash | Modern editor UX; fewer unsaved-loss bugs; matches existing scaffold direction. |
| Schedule view layout | Click-day-to-focus (per reference JSX) | Agenda-app feel; better drill-down than 4 relative-time sections. |
| Filter API multi-value | Extend GET to CSV-parsed multi-value | Correct + scales; avoids silent 500-row truncation. |
| Status set | Keep 7 in DB; render only 5 handoff statuses in drawer | Backwards compat; legacy values display read-only when present. |
| `Activity.outcome` overload | Keep `outcome` as free-text "outcome notes"; add new `outcome_disposition VARCHAR(20)` | Avoids data loss; matches handoff's enum semantics. |
| Expense amount type | Keep `Decimal(10,2)`; expose `amountCents` in API response | Already in production; safer for money. |
| Prisma enums vs constants | String columns + constant arrays validated at route boundary | Project convention — only `UserRole` is a true Prisma enum. |
| Icons | Lucide React (not emoji) | Per CLAUDE.md. Replace any emoji from reference JSX. |
| Inline-style JSX → Tailwind | Tailwind classes bound to tokens | Per handoff README:13–15 and project convention. |
| New activity button | In header AND Upcoming rail | Per handoff README:42, 155. |

## Visual design

Lifted from `design_handoff_activities_calendar/README.md` and `reference/components/*.jsx`. Pixel-perfect adherence to:
- Tokens in `Documentation/UI Framework/tokens.md` (1:1 with `reference/colors_and_type.css`).
- Drawer slide 250ms `cubic-bezier(0.16, 1, 0.3, 1)`, backdrop fade 200ms, hover transitions 120ms.
- Coral as the active marker (tab underlines, focus rings, "today" pill, now-line).
- Plum-derived neutrals only — no Tailwind grays.

### Page structure

```
┌─ Sidebar (existing) ──┬─ Main ─────────────────────────────────────────────┐
│                       │ ┌─ Page header ──────────────────────────────┐    │
│                       │ │ Title · count · sync badge · scope toggle  │    │
│                       │ │ View toggle · DateRange (one bordered pill) │   │
│                       │ └────────────────────────────────────────────┘    │
│                       │ ┌─ Saved view tabs ──────────────────────────┐    │
│                       │ │ All / My week / CT·Meetings / Renewals /…  │    │
│                       │ ├─ Filter rail | bar | chips (variant) ──────┤    │
│                       │ │ Categories · Types · Deals · States · …    │    │
│                       │ ├─ View body ─────────────┬─ Upcoming rail ──┤    │
│                       │ │ Schedule(default) /     │ 320px / 36px     │    │
│                       │ │ Month / Week / Map      │ collapsible      │    │
│                       │ └─────────────────────────┴──────────────────┘    │
└───────────────────────┴────────────────────────────────────────────────────┘
                                ↑ ActivityDetail drawer slides over right side
```

### Top-level pieces (locked)

1. **Page route** — `src/app/activities/page.tsx` mounting the shell. Reuses authenticated layout that other pages use.
2. **Page header** — title with shown-count subtitle, scope toggle ("My activities" / "All of Fullmind"), sync badge with popover, view toggle (Schedule first), bordered DateRange pill (Today | nav | label | grain segmented).
3. **Saved view tabs** — `All / My week / CT · Meetings / Renewals / Conferences / + Save view`. Coral 2px underline on active, leading glyph icon, partial-count badges per filter group.
4. **Filter shell with 3 variants** — Rail (default), Bar (segmented pills), Chips (removable + "+Filter" button). VariantSwitcher floating bottom-left toggles between them. Same state shape across all three.
5. **View body** — one of {Schedule, Month, Week grid, Map-over-time}. Schedule is default.
6. **Upcoming rail** — 320px right column, collapsible to 36px strip with rotated label. Rich activity rows. Coral "Log activity" button at top.
7. **Activity detail drawer** — 520px right slide-over with 5 tabs. Auto-saves per field. Read-only when `activity.mine === false`.
8. **Deal layer** — overlays (corner dots) and objects (chips/blocks). `dealDisplay` toggle in tweaks.

## Component plan

### Existing components to reuse (no rewrite, may need light fixes)

| Component | Path | Notes |
|---|---|---|
| `useFocusTrap` | `src/features/shared/hooks/` | Drawer focus trap |
| `useProfile` | `src/features/shared/lib/queries.ts:169` | Default owner seeding |
| `Lucide React` | `lucide-react` | Icon set per CLAUDE.md |
| Date helpers | `src/features/shared/lib/format.ts` | Date formatting |
| `cn()` | `src/features/shared/lib/cn.ts` | Tailwind merge |
| `useActivities` family | `src/features/activities/lib/queries.ts` | TanStack hooks (fix bugs) |
| `useActivityNotes`/`-Attachments` mutations | `src/features/activities/lib/queries.ts` | Already implemented |
| Existing scaffold components | `src/features/activities/components/page/*` | All need refinement; none thrown away |

### New shared primitives

| Component | Path | Source |
|---|---|---|
| `EditableText` | `src/features/shared/components/EditableText.tsx` | `reference/components/ActivityDetailBits.jsx:41-108` |
| `EditableSelect` | `src/features/shared/components/EditableSelect.tsx` | `reference/components/ActivityDetailBits.jsx:113-164` |
| `TabBar` | `src/features/shared/components/TabBar.tsx` | `reference/components/ActivityDetailBits.jsx:169-205` |
| `FieldLabel` | `src/features/shared/components/FieldLabel.tsx` | `reference/components/ActivityDetailBits.jsx:22-36` |
| `useCalendarSyncState` | `src/features/calendar/lib/useCalendarSyncState.ts` | New shared hook for both sync badges |

### New feature components

| Component | Path | Purpose |
|---|---|---|
| `ActivitiesPageShell` | `src/app/activities/page.tsx` | Top-level route page |
| `ScopeToggle` | `src/features/activities/components/page/ScopeToggle.tsx` | "My / All of Fullmind" pill |
| `ActivitiesFilterBar` | `.../page/ActivitiesFilterBar.tsx` | Variant 2 |
| `ActivitiesFilterChips` | `.../page/ActivitiesFilterChips.tsx` | Variant 3 |
| `FilterVariantSwitcher` | `.../page/FilterVariantSwitcher.tsx` | Floating bottom-left |
| `CommandBar` | `.../page/CommandBar.tsx` | ⌘K text-search overlay |
| `DealChip` | `.../page/deals/DealChip.tsx` | Pip / compact / row densities |
| `OppDayBar` | `.../page/deals/OppDayBar.tsx` | Per-day deal summary in Month |
| `OppSummaryStrip` | `.../page/deals/OppSummaryStrip.tsx` | Won/Lost/New/Progressed top strip |
| `OppDrawer` | `.../page/deals/OppDrawer.tsx` | Slide-over for stat clicks |
| `OffMapPanel` | `.../page/MapTimeView/OffMapPanel.tsx` | Off-region / Virtual sidebar |
| `MissingReceiptPill` | `.../page/drawer/MissingReceiptPill.tsx` | Golden warning chip in expenses total |
| `ExpenseEditor` | `.../page/drawer/ExpenseEditor.tsx` | Inline 2-col editor with file pick |

### Components to extend (refinement, not rewrite)

| Component | What changes |
|---|---|
| `ActivitiesPageHeader.tsx` | Embed `<ActivitiesDateRange/>` inline; add `<ScopeToggle/>`; title typography to `text-2xl font-bold` (per `fm-display`) |
| `ActivitiesDateRange.tsx` | Refactor into one bordered pill with internal dividers |
| `ActivitiesFilterRail.tsx` | Add Deals group; add States/Territories/Tags dropdowns; partial-count badges; double-click-solo; ⌘K hint; Reset button |
| `SavedViewTabs.tsx` | Update preset list to (`all`/`my-week`/`ct-meetings`/`renewals`/`conferences`); add leading icons; switch active underline to coral |
| `ScheduleView.tsx` | Click-day-to-focus week strip; bordered selected-day card; Pipeline events section per day; type pill above title; duration column; empty state with icon |
| `MonthView.tsx` | Black/coral squared "today" + Today eyebrow; full weekday names; weekend tinting; bordered grid (no gaps); category-filled chips with time prefix; OppDayBar; legend strip |
| `WeekGridView.tsx` | 7am–9pm @ 52px/hr; round 30px today date pill; 2px coral now-line + bullet; category-filled blocks with district when tall; today-column robins-egg tint; pinned Pipeline + Deals overlay rows |
| `MapTimeView.tsx` | Real MapLibre embed (clustering by district lat/lng); horizontal time ruler responding to grain; OffMapPanel sidebar with tabs; pin hover popups; team-avatar stacks |
| `UpcomingRail.tsx` | Coral "Log activity" button; sticky day headers; rich activity rows (3px border-left, eyebrow+time, title, district+teammate); fix collapsed strip rotation |
| `ActivityDetailDrawer.tsx` | Editable type/title in header; "More" button; "Read-only · team activity" pill; coral tab underlines + counts; auto-save model with `flashIn` keyframes; remove explicit Save buttons (footer keeps Close + Delete) |
| `OverviewPanel.tsx` | Switch end-time to duration-min; EditableText/Select for type/title/where/attendees; key textarea by `updatedAt` |
| `OutcomePanel.tsx` | Replace legacy wrap with 2x2 outcome cards + sentiment buttons + nextStep + followUp + dealImpact (per handoff) |
| `NotesPanel.tsx` | Composer above notes wrapped in single rounded border; render notes as bordered cards |
| `ExpensesPanel.tsx` | Category pill column + missing-receipt warning + new ExpenseEditor + per-line date + receipt picker |
| `FilesPanel.tsx` | Add Download button + uploadedAt relative-time + 32x32 hover-bg file tile |
| `CalendarSyncBadge.tsx` (page version) | Use shared `useCalendarSyncState` hook to derive `stale` from `lastSyncAt + pendingCount` |

## Backend design

See `docs/superpowers/specs/2026-04-27-activities-calendar-redesign-backend-context.md` for full inventory.

### New migrations

1. `20260427_add_activity_outcome_fields/migration.sql` — sentiment, next_step, follow_up_date, deal_impact, outcome_disposition + index on follow_up_date
2. `20260427_add_activity_expense_fields/migration.sql` — category, incurred_on (backfilled), receipt_storage_path, created_by_id + index on category

### New API routes

| Route | Verb | Purpose |
|---|---|---|
| `/api/activities/[id]/expenses` | POST | Create expense — body `{category, description, amount, incurredOn, receiptStoragePath?}` |
| `/api/activities/[id]/expenses/[expenseId]` | DELETE | Delete expense — owner+admin only |
| `/api/activities/[id]/expenses/[expenseId]/receipt` | POST | Optional multipart receipt upload to Supabase Storage |
| `/api/deals/events` | GET | OPP_EVENTS shape — won/lost/created/progressed within date range |
| `/api/deals/open` | GET | OPEN_DEALS shape — open opportunities filtered by owner/scope |

### Existing routes to extend

| Route | Change |
|---|---|
| `/api/activities` GET | Accept CSV multi-value for `category`, `type`, `status`, `owner`, `state`, `territory`, `tags`, `dealKinds`. Fix `stateCode`/`stateAbbrev` mismatch. |
| `/api/activities/[id]` PATCH | Add new outcome fields to accepted payload |

### Calendar sync — shared hook

`useCalendarSyncState()` derives:
- `connected` if connected && `(now - lastSyncAt) < STALE_MS` (30 min) && `pendingCount === 0`
- `stale` if connected but past threshold OR pending > 0
- `disconnected` otherwise

### Filter store changes

`src/features/activities/lib/filters-store.ts`:
- Default `owners` seeded from `useProfile().id` via mount-time ref guard hook (per CLAUDE.md UX rule)
- `EMPTY_FILTERS` keeps `owners: []`; the seeding hook fills it
- `partialize` excludes server-derived `syncState`

### Saved views

`src/features/activities/lib/saved-views.ts` preset IDs to: `all`, `my-week`, `ct-meetings`, `renewals`, `conferences`. Each maps to a typed filter snapshot.

## States

| State | Approach |
|---|---|
| Loading | Each view renders its own skeleton; shared `<ViewSkeleton />` for chrome consistency. Filter rail dropdowns render disabled placeholder during loading (per CLAUDE.md). |
| Empty | Per-view empty illustration: Lucide icon + "No activities…" + CTA "Log activity" → opens form in drawer. |
| Error | Toast + inline retry banner; no view crash. |
| Read-only | Drawer hides Save/Delete/composer/upload affordances; renders title/type/where as plain text via `readOnly` prop on Editable* primitives. |
| Filter result > limit | "Showing 500 of N — narrow your filters" banner per CLAUDE.md. |

## Animations

- Drawer backdrop: `200ms linear` fade
- Drawer slide: `250ms cubic-bezier(0.16, 1, 0.3, 1)` (`--ease-out-expo`)
- Hover transitions: `120ms`
- Tab underline color: `120ms`
- Saved flash: custom `flashIn` keyframes (opacity 0→1→1→0, translateY -4→0) over `1400ms`
- Sync-badge pulse: `1.8s ease-out infinite` (connected only)
- Saved-view active underline: `120ms color, 120ms border-color`

## Persistence

LocalStorage keys (kept consistent with prototype):
- `cal.view`, `cal.grain`, `cal.scope`, `cal.filterVariant`, `cal.savedView`, `cal.rail.collapsed`, `cal.dealDisplay`, `cal.sync` (excluded from `partialize`)

## A11y

- Drawer: focus trap, Esc to close, `role=dialog aria-modal=true`, `aria-hidden="true"` on background
- Tabs: `role=tablist/tab/tabpanel`, arrow-key navigation
- `.fm-focus-ring` utility (`outline 2px solid coral, offset 2px`) applied via Tailwind `focus-visible:` modifier
- Filter menus: roving tab index, Esc to close
- Live regions: "Saved" flash on field save AND note save AND note delete (`aria-live=polite`)
- Sync badge popover: `role=dialog`, focused on open

## Mobile

- Drawer: full-width on `<md`; slides from bottom as a sheet (translateY)
- Filter rail collapses to `<Filter/>` button → opens dropdown on `<md`
- Upcoming rail hidden on `<md` (drawer-pattern instead via the saved view tab)
- Camera capture: `<input capture="environment">` on Files tab (already wired)
- Touch targets ≥ 44px

## Out of scope (this PR)

- Audit log trigger extension to activities (deferred — drawer dirty/saved state is form-driven)
- Tweaks panel beyond filter variant + dealDisplay toggles
- Two-way Google Calendar conflict resolution UI
- Real OPP_EVENTS feed if `Opportunity` model lacks state-change history (Wave 6 will use latest snapshot via `OpportunitySnapshot` table)
- Audit/export of pipeline events to CSV
- Variant 3 (Chips) editor mode for free-text dimensions — only filters with finite values get chips

## Bugs fixed in this PR (in-scope)

1. `useActivities` query key uses raw object → serialize to primitives (CLAUDE.md violation)
2. `ActivitiesParams.stateCode` vs route's `stateAbbrev` → unify on `state`
3. `CalendarSyncBadge` page version never derives `stale` → use shared `useCalendarSyncState`

## Test strategy

- Vitest + Testing Library + jsdom; co-located `__tests__/`
- Backend: extend `src/app/api/activities/__tests__/route.test.ts` for new outcome PATCH cases; new `src/app/api/activities/[id]/expenses/__tests__/route.test.ts` for POST/DELETE; new `src/app/api/deals/events/__tests__/route.test.ts`
- Frontend: extend `src/features/activities/lib/__tests__/filters-store.test.ts` for default-owner hydration + variant + dealDisplay; new tests for `EditableText`, `EditableSelect`, `useCalendarSyncState`
- Manual: dev server on port 3005, click through each view, drill-down drawer, filter scenarios, mobile sheet
