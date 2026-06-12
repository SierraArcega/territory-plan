# Implementation Plan: Leads — BDR Lead Management & Pipeline

**Date:** 2026-06-10 · **Slug:** leads · **Branch:** worktree-leads
**Spec:** `docs/superpowers/specs/2026-06-10-leads-spec.md`
**Backend context:** `docs/superpowers/specs/2026-06-10-leads-backend-context.md`
**Design reference:** `/Users/sierraarcega/territory-plan/Docs/design_handoff_leads/` (README + `design_files/`)

Commit after each task (small focused commits, plain messages, no model trailers).

## Tracks & Ordering

```
Track B (backend):      B1 → B2 → B3 → B4
Track F (shared UI):    F1, F2, F3 (independent of B; parallel with Track B)
Track L (leads UI):     L1 (needs B1 types) → L2 → {L3, L4} → L5 → {L6, L7, L8} → L9 (needs B4) → L10
```

Tracks B and F run in parallel. Track L starts after B1 + F1; queries wire up as B3/B4 land.

---

## Track B — Backend

### B1. Schema migration + Prisma models
- Add `leads`, `lead_events`, `activity_schools` models and `contacts.school_ncessch` nullable FK per spec §Backend Design. Follow existing snake_case `@@map`/`@map` conventions; mirror `activity_districts` junction shape for `activity_schools`.
- Migration via `prisma migrate dev` (SQL file, no TODOs in migration files).
- Status as string enum matching existing enum conventions in schema.
- **Tests:** `npx prisma validate`; migration applies cleanly on shadow DB.

### B2. Lead service layer
- `src/features/leads/lib/server/lead-service.ts` (mirror existing service-layer + `ServiceError` pattern found in backend context).
- Functions: `createLead` (ensure/create contact w/ school+district links; backfill records; lead_event `created`), `transitionLead` (server-side transition validation table; side-effects: accept sets `accepted_at`; meeting_scheduled creates native opp `"0 - Meeting Booked"` w/ uuid id + source tag + stores `opportunity_id` + event `opp_created`; sales_qualified advances opp to `"1 - Discovery"` + event `opp_advanced`; disqualify requires reason + preserved-count system note), `logEngagement` (activity row + contact/district/school junctions + score increment + optional transition), `linkOpportunity` (link existing open opp or create Stage 0).
- **Tests:** unit tests with mocked Prisma — every legal/illegal transition, each side-effect, score math, disqualify preserves activities (asserts no activity deletes issued).

### B3. Core API routes
- `GET/POST /api/leads` — scope param cloning activities owner-scoping (`?ownerId=` default current user, `all` = team); filter/sort params as serialized primitives; pagination (50/page) per CLAUDE.md.
- `PATCH/DELETE /api/leads/[id]`, `GET /api/leads/[id]/timeline` (merged lifecycle events + engagement activities touching contact/school/district, each engagement item attributed: `own_contact` | `other_contact` (+name) | `district_wide`).
- Auth via `getUser()` Supabase SSR; `NextResponse.json` shapes per repo convention.
- **Tests:** route tests with mocked prisma/auth — scoping default, team scope, transition rejection (409/422), timeline attribution.

### B4. Import endpoints
- `POST /api/leads/import` (leads CSV rows as JSON, ≤500/batch, `{succeeded, failed[]}` like activities/bulk).
- `POST /api/leads/import/activities` — per-row: contact by email (duplicates → most recent + warning), school by NCES (graceful when unresolved), district from school leaid (create stub like schools ETL), active-lead check → score increment vs retained-on-records. `?dryRun=1` returns the full resolution plan (NEW flags, via-NCES tags, to-leads vs retained counts) without writing.
- **Tests:** resolution unit tests — email duplicate, new contact + school NCES → district resolution, missing school, district stub creation, dry-run = wet-run parity on the same fixture.

---

## Track F — Shared primitives (`src/features/shared/components/`)

### F1. Toast + InfoTip + SegmentedControl
- `Toast`: provider + `useToast()`; bottom-center, auto-dismiss ~3.2s, success/info/alert tones; tokens per handoff. Mount provider once in app shell.
- `InfoTip`: 240px plum card, `tipFade` 150ms ease-out-expo, edge-aware `align` (left/center/right), hover + focus, shadow `0 10px 28px -8px rgba(64,55,112,0.5)`.
- `SegmentedControl`: labeled pill group, controlled value.
- **Tests:** component tests — toast auto-dismiss (fake timers), InfoTip shows on focus, SegmentedControl onChange.

### F2. FilterBuilder (+ multi-column Sort dropdown)
- Typed column-config: `{ key, label, type: text|number|date|enum|boolean, options? }`; operators per type per handoff §Filtering; 3-step popover (Column → Operator → Value); robin's-egg pills (click to edit, × remove); filters AND.
- Sort dropdown: add column, per-column asc/desc, drag to reorder priority (dnd-kit), count badge. Exposes `sorts[]` so table headers can write the same state.
- **Tests:** operator sets per type, pill edit/remove, predicate-building helper (`buildFilterPredicate`) unit-tested for every operator.

### F3. Date helpers
- `fmtDate` ("Feb 12") + `fmtRel` ("2h ago") added to `src/features/shared/lib/` (search first — extend `format.ts`/`date-utils.ts`, don't duplicate).
- **Tests:** unit tests incl. year boundary + relative thresholds.

---

## Track L — Leads feature (`src/features/leads/`)

### L1. Feature lib (after B1)
- `lib/types.ts`, `lib/status-config.ts` (STATUS_CONFIG + LEAD_TYPES + OPP_STAGES + definitions — copy text **verbatim** from `design_files/leadsData.js`), `lib/sla.ts` (2-business-day SLA: remaining/overdue, ok → due-soon <6h → overdue; port `slaState()` logic), `lib/filter-columns.ts`, `lib/queries.ts` (TanStack hooks; serialized-primitive keys; optimistic lifecycle mutations w/ rollback).
- **Tests:** `sla.ts` heavily — weekend spans, due-soon boundary, overdue; query-key stability.

### L2. Shell: nav + LeadsView + header + stat strip + toolbar
- Register tab: `src/app/page.tsx` (`VALID_TABS`, switch) + `Sidebar.tsx` (`MAIN_TABS`).
- `LeadsView`: UI state (view/search/scope/filters/sorts/selected/recordStack/modal), `#lead=<id>` deep link, scope default = current user (ref-guarded).
- Header (title/subtitle/Bulk upload/Add lead), 5 stat tiles (`StatTile` bit; responsive grid), toolbar (search 240px, FilterBuilder, Clear all, Sort, two SegmentedControls, count line), loading skeletons + disabled filter placeholders.
- **Tests:** scope default + deep-link restore.

### L3. Board (columns → swimlanes → grouped)
- `LeadsBoard` with layout switch; `LeadCard` per handoff §3 (ScorePill, LeadTypeBadge, SLA/meeting/SQL footer signals, selected ring, overdue border); column header w/ status dot, InfoTip definition, count pill, overdue pill; HTML5 DnD drag-to-restage (drop zone tint), optimistic; swimlanes (BDR × stage, sticky header + first column); grouped stacked list.
- **Tests:** stage-change handler fires with correct status; overdue pill logic.

### L4. Table view
- `LeadsTable` on shared DataGrid: 8 columns, fixed layout, header sort writes the shared `sorts[]` (click = sole sort, toggle direction), row click opens detail, hover/selected tints, inline SLA badge for New.
- **Tests:** header click → sort state; row render snapshot for status/SLA cells.

### L5. Lead detail panel
- Right slide-in `min(640px,…)` 250ms ease-out-expo, plum/28% backdrop, Esc close; status-aware action zone (Accept+SLA banner / Log outcome / Schedule meeting / Link opp / Sales-qualify / assignment; Disqualify text button for new|working|meeting); contact block w/ School + District rows ("District · NCES …", "District office" fallback); qualification fields (lead type select, created, NCES, BDR, sequence, marketing owner).
- **Tests:** action zone renders correct actions per status.

### L6. Activity timeline
- `LeadActivityTimeline`: merged lead_events + engagement; linkage chips (District-wide steel / other-contact purple / own unlabeled); "Log activity" affordance; shared-with caption. Reuse activities timeline date-grouping patterns.
- **Tests:** attribution → chip mapping.

### L7. Record panels + breadcrumb stack
- `RecordPanelShell` (480px, stacks above lead panel, breadcrumbs current-level-not-clickable, Back/Close, Esc pops); Contact / District / School panels per handoff §6 (stat cells, retention notes, schools/contacts/leads lists, timelines).
- **Tests:** stack push/pop, Esc pops one level.

### L8. Modals: Add MQL, Outcome, Disqualify, Link opportunity
- All on shared Modal; Outcome writes engagement via B2 path + sets resulting status; Disqualify names preserved counts + requires reason; LinkOpp create-Stage-0 or link-existing-open-opp.
- **Tests:** disqualify requires reason; outcome → correct mutation payload.

### L9. Bulk upload modal (after B4)
- Segmented Leads/Activity datasets; drop step (file input + drag) → client CSV parse (shared `parseCsv` added next to `csv.ts`) → dry-run call → resolution preview (chips, NEW badges, via-NCES tags, summary counts) → import → toast "N events imported · X to active leads · Y retained on records".
- **Tests:** `parseCsv` (quotes/commas/CRLF); preview rendering from a dry-run fixture.

### L10. States, mobile pass, polish
- Empty states (column / workspace / filtered-zero), error toasts + retry card, conflict re-sync; mobile per spec §Mobile (board pan-x rail, full-width sheets, 2-col stats, narrow-width resilience audit); Safari Responsive Design Mode check; smoke-test map tab (AppShell touched).

---

## Test strategy summary
- Heavy unit coverage where logic is dense: `sla.ts`, transition table, import resolution (incl. dry/wet parity), FilterBuilder predicates, timeline attribution, `parseCsv`.
- Route tests for auth/scoping/validation.
- Component tests for interactive primitives (Toast, InfoTip, SegmentedControl) and per-status rendering (action zone, LeadCard footer).
- Gate: `npx vitest run` + `npm run build` clean (Stage 8).
