# Feature Spec: Leads — BDR Lead Management & Pipeline

**Date:** 2026-06-10
**Slug:** leads
**Branch:** worktree-leads

## Source of Truth

- **Design handoff:** `/Users/sierraarcega/territory-plan/Docs/design_handoff_leads/README.md` — high-fidelity; colors, type, spacing, copy, easings, and interactions are final as documented there. Prototype files in `Docs/design_handoff_leads/design_files/` are working references (in-browser Babel React), **not** code to copy.
- **Backend context:** `docs/superpowers/specs/2026-06-10-leads-backend-context.md`
- This spec resolves everything the handoff left open and records the approved decisions.

## Requirements

A lead-management surface for BDRs: accept marketing-qualified leads under a 2-business-day SLA, work them through a pipeline (New → Working → Meeting Scheduled → Sales Qualified | Unqualified), log engagement outcomes, link opportunities, and bulk-import leads + activity.

**Core data invariant:** engagement activity is never owned by a lead — it lives on durable records (contact, school, district) so history survives disqualification/deletion. Only lifecycle events live on the lead.

**Approved decisions (Stage 1–3 gates):**
1. **Full build in one pass** — board (3 layouts) + table + detail panel + record panels + all 5 modals + bulk import + schema.
2. **Full schema as specced** — but discovery found `School` already exists (`prisma/schema.prisma`, `ncessch` 12-char PK, leaid FK; ETL `--all-schools` loads ~100K). Net-new: `leads`, `lead_events`, `activity_schools` junction, `contacts.school_ncessch` nullable FK.
3. **Lead sources: manual form + bulk CSV only.** No external feed.
4. **New top-level "Leads" tab**; BDRs are existing `user_profiles` users.
5. **Direction C** — pixel-faithful to handoff; generic new primitives go to `src/features/shared/`; leads-specific UI stays in `src/features/leads/`.
6. **Native opportunity rows** — lifecycle creates real `opportunities` rows (uuid id, source-tagged); safe because the LMS sync is upsert-only (verified in backend context doc). Duplicate-on-LMS-entry caveat accepted; reconciliation out of scope.

## Visual Design

Recreate the handoff pixel-faithfully using Tailwind 4 + lucide-react + Plus Jakarta Sans. All tokens (colors, radii, shadows, type tiers, easings, timings) are in the handoff README §Design System Foundations and §Design Tokens. Honor `Documentation/UI Framework/tokens.md`; the handoff hexes are Fullmind-system-derived. Numerics use `tabular-nums`. Hover = palette tint, never opacity. Four radii only (8/12/16/full, plus 10 for row buttons).

Regions (handoff §Screens/Views has exact specs):
1. Header + 5-tile stat strip (counts follow active scope)
2. Toolbar: search (240px), FilterBuilder pills, Clear all, Sort dropdown, My leads/Team + Board/Table segmented controls, filtered-count line
3. Pipeline board — `columns` (default, drag-to-restage) / `swimlanes` (BDR × stage, sticky header + first col) / `grouped` layouts; LeadCard per handoff §3
4. Table — 8 columns on shared DataGrid; header sort = same shared sort state as toolbar
5. Lead detail panel — right slide-in `min(640px, …)`, 250ms ease-out-expo, plum/28% backdrop; status-aware action zone; contact/school/district rows; qualification fields; merged timeline
6. Record panels (Contact/School/District) — 480px, stack above lead panel, breadcrumbs (`Lead › District › School › Contact`), Esc pops one level
7. Modals — Add MQL, Bulk upload (Leads vs Activity datasets; drop step → resolution preview), Log outcome, Disqualify, Link opportunity

## Component Plan

### New shared primitives (`src/features/shared/components/`)
| Component | Notes | Doc reference |
|---|---|---|
| `Toast` (+ provider/`useToast`) | bottom-center, auto-dismiss ~3.2s, success/info/alert tones | `Documentation/UI Framework/` Display docs |
| `InfoTip` | plum tooltip card 240px, 150ms tipFade, edge-aware `align`, hover+focus | `Components/Display/tooltips.md` |
| `SegmentedControl` | labeled pill group (ViewToggle is icon-only; keep both) | `Components/Forms/toggle.md` |
| `FilterBuilder` | column→operator→value 3-step picker, robin's-egg pills, multi-column sort dropdown; driven by a typed column-config (text/number/date/enum/boolean operators per handoff §Filtering) | `Patterns/filter-and-facets.md` |

### Existing components to reuse
- `src/features/shared/components/Modal.tsx` — all 5 modals
- `src/features/shared/components/DataGrid/DataGrid.tsx` — table view (sortable headers, row click, fixed layout)
- `src/features/shared/components/UserAvatar.tsx` — BDR avatars
- `src/features/shared/lib/format.ts`, `date-utils.ts` — add `fmtDate`/`fmtRel` helpers here (shared, not leads-local)
- `useProfile()` (`src/features/shared/lib/queries.ts`) — default assigned BDR to current user; filter scope defaults to "My leads" (ref-guarded, per CLAUDE.md UX rules)
- ToplineStatStrip grid pattern (`grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-3`) for stat strip responsiveness
- Tasks `KanbanBoard.tsx` HTML5 DnD pattern (pattern reference, not import); dnd-kit (already in package.json) only if swimlanes needs it
- Nav registration: `src/app/page.tsx` (`VALID_TABS` + switch case) and `src/features/shared/components/navigation/Sidebar.tsx` (`MAIN_TABS`)

### New leads components (`src/features/leads/components/`)
- `LeadsView.tsx` — composition, all UI state, URL (`?tab=leads`, `#lead=<id>` deep link restored on load)
- `board/LeadsBoard.tsx`, `board/LeadCard.tsx`, `board/SwimlaneGrid.tsx`, `board/GroupedList.tsx`
- `LeadsTable.tsx`
- `panels/LeadDetailPanel.tsx`, `panels/RecordPanelShell.tsx` (breadcrumb stack), `panels/ContactRecordPanel.tsx`, `panels/SchoolRecordPanel.tsx`, `panels/DistrictRecordPanel.tsx`
- `modals/AddLeadModal.tsx`, `modals/BulkUploadModal.tsx`, `modals/OutcomeModal.tsx`, `modals/DisqualifyModal.tsx`, `modals/LinkOpportunityModal.tsx`
- `bits/` — `StatusBadge`, `LeadTypeBadge`, `SlaBadge`, `ScorePill`, `LinkageChip`, `StatTile`, `MicroLabel`
- `LeadActivityTimeline.tsx` — merged feed; extends activities timeline patterns with linkage chips (District-wide = SchoolIcon/steel tint; other contact = UsersIcon/purple tint; own contact unlabeled)
- `lib/` — `queries.ts` (TanStack hooks, serialized-primitive keys), `types.ts`, `sla.ts` (business-day SLA: ok → due-soon <6h → overdue), `status-config.ts` (STATUS_CONFIG + OPP_STAGES definitions, copy verbatim from `design_files/leadsData.js`), `filter-columns.ts` (FilterBuilder config for leads)

## Backend Design

See backend context doc for conventions (getUser() Supabase SSR auth, service-layer mutations with ServiceError, `prisma migrate dev`, snake_case mapping).

### New models (Prisma + migration)
- **`leads`** — `id` uuid PK; `contact_id` FK→contacts; `school_ncessch` nullable FK→School; `leaid` FK→districts; `status` enum (`new|working|meeting_scheduled|sales_qualified|unqualified`); `lead_type`; `sequence`; `score` int default 0; `marketing_owner` text; `assigned_bdr_id` FK→user_profiles; `assigned_at`, `accepted_at` nullable; `unqualified_reason` nullable; `opportunity_id` nullable; `created_at`/`updated_at`. Indexes: `(assigned_bdr_id, status)`, `(leaid)`, `(contact_id)`.
- **`lead_events`** — `id`, `lead_id` FK cascade-delete, `kind` (created/accepted/restaged/opp_created/opp_advanced/disqualified/note), `payload` jsonb, `actor_id`, `created_at`. Lifecycle only — never engagement.
- **`activity_schools`** — junction (`activity_id`, `ncessch`), mirroring `activity_districts`/`activity_contacts` write patterns.
- **`contacts.school_ncessch`** — nullable FK→School (null = district office). Chosen over the existing `school_contacts` junction: the handoff models one workplace per contact.

### Lifecycle side-effects (server-side, in the lead service)
- Accept → status working, `accepted_at` set, lead_event.
- → Meeting Scheduled → create native `opportunities` row: uuid id, stage `"0 - Meeting Booked"` (exact existing string), district `leaid`, source-tagged so lead-created opps are identifiable; store id on `lead.opportunity_id`; lead_event `opp_created`.
- → Sales Qualified → advance that opp to `"1 - Discovery"` (do NOT mark won); lead_event `opp_advanced` with copy "Opportunity advanced to Stage 1 · Discovery"; lead leaves the BDR board (filtered out of board scope, still visible in table/records).
- Disqualify → status unqualified + reason; system note "N activities preserved on contact + district"; engagement untouched.
- Engagement logging (Outcome modal) → real `activities` row + junctions (contact, district, school when present) + lead `score` increment + status transition per chosen outcome.

### API routes
- `GET/POST /api/leads` — list (scope: `?ownerId=` defaulting current user, `all` for team — clone activities owner-scoping pattern; filters/sort serialized in query), create (ensure/create contact, backfill records)
- `PATCH/DELETE /api/leads/[id]` — field edits + lifecycle transitions (transition validated server-side)
- `GET /api/leads/[id]/timeline` — merged lifecycle + engagement (activities touching the lead's contact, school, or district), with linkage attribution
- `POST /api/leads/import` — leads CSV rows (client-parsed JSON, ≤500/batch, `{succeeded, failed[]}` like activities/bulk)
- `POST /api/leads/import/activities` — match contact by email (**no unique email constraint exists — on duplicates pick most recent, report in `failed[]`/warnings**); resolve school by NCES → district from school's leaid (create district stub if missing, as the schools ETL does); rows with active lead add points; others retained on records. Response feeds the toast: "N events imported · X to active leads · Y retained on records".
- Record panels read existing `/api/schools`, contacts, districts routes; add thin aggregate endpoints only if composing client-side is too chatty (implementer's call, document it).

### Bulk upload (client)
No CSV lib exists — parse client-side (hand-rolled or tiny parser in shared lib), POST JSON. Two-step modal: drop/parse → resolution preview (Contact · School · District chips, NEW badges for to-be-created records, "via NCES" tag when district resolved from school NCES) → import. Preview resolution computed by a dry-run mode on the import endpoints (`?dryRun=1`) so client preview and server behavior cannot drift.

## States

- **Loading:** skeleton stat tiles + board columns (no layout shift); disabled placeholder filters (never disappear); panel content skeleton.
- **Empty:** dashed "No leads" drop zone per empty column; zero-lead workspace → centered empty state with Add lead / Bulk upload CTAs; filtered-to-zero → "No leads match — Clear filters."
- **Error:** mutations → alert toast + rollback (lifecycle/drag mutations optimistic); list failure → inline retry card.
- **Conflict:** restaging an already-changed lead re-syncs and toasts.

## Mobile (< 640px)

- Stat strip 2-col grid; toolbar wraps, search full-width.
- Board: horizontally scrollable column rail (`touch-action: pan-x` on the scroller; never overflow:hidden on html/body); drag disabled on touch — restage via detail panel.
- Table: DataGrid horizontal scroll.
- Panels: full-width sheets, breadcrumbs retained.
- All flex/grid text spans get `whitespace-nowrap` + planned overflow per CLAUDE.md Narrow-Width Resilience.
- Verify in Safari Responsive Design Mode + real device before ship.

## Out of Scope

- Lead↔LMS opportunity reconciliation tooling (caveat documented above)
- External lead feeds (Clay/HubSpot/webhooks)
- Notifications/watchers on leads
- Sequence management (sequence is a labeled field only)
- Backfilling the School table via ETL (run `--all-schools` separately if school rows are missing in an environment; the UI must degrade gracefully when a school NCES doesn't resolve)
