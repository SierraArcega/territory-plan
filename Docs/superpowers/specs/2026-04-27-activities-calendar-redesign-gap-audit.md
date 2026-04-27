# Gap Audit: Activities + Calendar Redesign

**Source:** Discovery subagent run on 2026-04-27 against scaffold commit `8b0c9371` and design handoff at `design_handoff_activities_calendar/`.
**Tokens parity:** `reference/colors_and_type.css` ↔ `Documentation/UI Framework/tokens.md` are 1:1 identical. Scaffold uses correct tokens via raw hex (no Tailwind grays).

**Severity legend:** 🔴 MAJOR (whole feature missing or broken) · 🟡 MEDIUM (visible regression / wrong tokens / missing state) · 🟢 MINOR (polish / micro-interactions / copy)

---

## Page shell & route

- 🔴 **No `/activities` route exists.** No `src/app/activities/page.tsx`. **Architectural pivot (locked):** replace body of `src/features/shared/components/views/ActivitiesView.tsx` to render `<ActivitiesPageShell />`. App is SPA at `src/app/page.tsx` with `?tab=activities` mounting ActivitiesView.
- 🔴 **No host shell composing header + filter rail + view + upcoming rail + drawer.** Need `ActivitiesPageShell` resolving `useActivities` query, wiring `selectedActivityId` state, mounting ViewToggle-conditional view, piping `onActivityClick` everywhere.
- 🟡 **Header missing date range selector.** `ActivitiesPageHeader.tsx:8-43` shows title/count/sync/view toggle but doesn't include `<ActivitiesDateRange />`. Reference (`CalendarChrome.jsx:150-234`) puts the unified selector inline.
- 🟡 **Date range visual mismatch.** Reference wraps Today + nav + label + grain into one bordered pill (`CalendarChrome.jsx:158-234`); scaffold (`ActivitiesDateRange.tsx:62-109`) renders 3 disconnected blocks.
- 🟢 **ViewToggle order differs.** Reference: Month / Week / Schedule / Map; scaffold: Schedule / Month / Week / Map (Schedule is default — keep scaffold order).
- 🟢 **"New" button location.** Spec puts it in BOTH header (`ActivitiesPageHeader.tsx:32-39`) AND Upcoming rail (`ActivitiesInbox.jsx:73-83`). UpcomingRail currently has no log button.
- 🟢 **Title typography.** Scaffold `text-xl font-bold` (20px); reference is `22px/700` — use `fm-display` class or `text-2xl`.
- 🟡 **Scope toggle missing.** Reference `ScopeToggle` (`CalendarChrome.jsx:38-72`) "My activities | All of Fullmind" pill — scaffold has none. Critical because scope drives inbox copy, owner default, team avatars, dashed-team-chip styling.

## Filter system

- 🔴 **Bar variant missing entirely.** Spec calls for 3 variants. `FilterVariants.jsx:1-934` provides chip-rail; reference `CalendarChrome.jsx:370-505` defines segmented "FilterBar" (group label + count badge + colored chips). Scaffold has only `ActivitiesFilterRail.tsx`.
- 🔴 **Chips variant missing entirely.** No removable-chips-with-`+ Filter`-button component.
- 🔴 **VariantSwitcher missing.** Reference `FilterVariants.jsx:897-926` provides fixed bottom-left switcher. Store has `filterVariant: FilterVariant` and `setFilterVariant` ready (`filters-store.ts:8`); UI to toggle missing.
- 🟡 **Saved view tabs preset list mismatched.** Scaffold IDs: `all / my_week / meetings / events / campaigns`. Spec/reference IDs: `all / my-week / ct-meetings / renewals / conferences`.
- 🟡 **Saved view tabs missing leading icon.** Reference (`FilterVariants.jsx:114`) has small glyph (◷ ◉ ◧ ↻ ✦); scaffold (`SavedViewTabs.tsx:144-156`) is text-only.
- 🟡 **Active tab indicator wrong color.** Reference draws absolute 2px coral underline `bottom: -1, left/right: 8` (inset). Scaffold (`SavedViewTabs.tsx:147-149`) uses plum, full-width — wrong per tokens (coral = active marker).
- 🟡 **No `count`/`total` partial badge on filter groups.** Reference `FilterGroup` (`CalendarChrome.jsx:312-368`) shows partial badge; scaffold (`ActivitiesFilterRail.tsx:140`) shows only generic summary.
- 🟡 **Category dot UI uses wrong shape.** Reference (`CalendarChrome.jsx:74-108`) renders rounded pills with 2px-radius colored square dot; scaffold (`ActivitiesFilterRail.tsx:56-62`) renders circular dot icon-buttons only — loses category names.
- 🟡 **Double-click to solo missing.** Spec (`README:108`) says "click to toggle, double-click to solo" — no handler in `ActivitiesFilterRail.tsx`.
- 🟡 **Deal-kind filter chips missing.** Reference (`CalendarChrome.jsx:251-256, 420-431`) has Deals group with 4 glyph chips (↗ ↘ + →); scaffold filter rail has no Deals dimension despite store containing `dealKinds`.
- 🟡 **State / Territory / Tags filters missing from rail.** Store defines them (`filters-store.ts:23-26`); scaffold rail only renders Type/Status/Owner.
- 🟡 **`⌘K` command bar missing.** Reference `CommandBar` (`FilterVariants.jsx:146-270`) is full-screen overlay with text/suggestions/kbd ESC. Scaffold has plain `<input type="search">` only.
- 🟡 **Default owner not seeded.** Spec says default `owners=['<currentUserId>']`. Store `EMPTY_FILTERS` (`filters-store.ts:30-43`) has `owners: []`. No mount-time ref guard. Same problem for "My week" preset.
- 🟢 **Reset/Clear button missing on rail.** Reference (`CalendarChrome.jsx:486-502`) renders a "Reset filters" pill when `anyPartial`. Scaffold has Clear inside each menu only.
- 🟢 **Save-view button styling.** Reference floats it at right edge of tabs row.

## View 1: Schedule

- 🟡 **Missing "Pipeline events" section per day.** Reference (`WeekView.jsx:503-515`) shows uppercase "Pipeline events" with `DealChip density="row"`. Scaffold lists activities only.
- 🟡 **Day-tile week strip lacks deal dots & oppTotal.** Reference (`WeekView.jsx:392-446`) has category dots + 1px×8 separator + deal-kind colored squares + opp total under dashed border. Scaffold `WeekStrip.tsx:51-57` has only up to 4 deal dots.
- 🟡 **Selected day card missing.** Reference (`WeekView.jsx:448-489`) renders large bordered "selected day" card with day-of-week eyebrow + Today coral pill. Scaffold lists all 7 days as separate sections (`ScheduleView.tsx:90-169`). **Locked design:** click-day-to-focus per reference.
- 🟡 **Today pill on day header is wrong size.** Scaffold uppercase pill; reference is lowercase plum/coral pill.
- 🟢 **Activity row layout.** Reference (`WeekView.jsx:528-595`) is 3-col grid `110px 1fr auto` (time | title+meta | duration). Scaffold has flex with no duration column, no end-time arrow.
- 🟢 **Activity type pill missing in row.** Reference shows small bg-tinted type pill above title; scaffold shows status pill only.
- 🟢 **Empty state missing.** Reference shows centered ActivitiesIcon + message; scaffold has one-line "Nothing scheduled".
- 🟢 **District/attendee icons.** Reference uses 📍 / 👤 emoji; scaffold uses Lucide. **Keep scaffold's choice** — Lucide per CLAUDE.md.

## View 2: Month

- 🟡 **Day cells use wrong "today" indicator.** Reference (`MonthView.jsx:107-122`) draws 24x24 rounded-4 plum/coral block with white day number + separate "Today" eyebrow pill. Scaffold draws 12x12 coral corner triangle.
- 🟡 **No category-fill chips.** Reference (`MonthView.jsx:140-170`) chips have category bg color + ink text via `CATEGORY_STYLE`. Scaffold uses plain truncated text + tiny dot.
- 🟡 **Time prefix missing on chips.** Reference shows `{time}` (e.g., `9a`) in tabular-nums.
- 🟡 **Weekend / out-of-month tinting.** Reference tints weekends `#FFFCFA` distinct from `#fff` weekdays.
- 🔴 **No deal overlay (`OppDayBar`).** Reference (`MonthView.jsx:124-127`) renders per-day mini deal-summary bar above chips.
- 🔴 **No `OppSummaryStrip` header.** Reference (`MonthView.jsx:48-56`) shows 4-stat strip (Won/Lost/New/Progressed) at top.
- 🔴 **No deals-as-objects support.** Reference (`MonthView.jsx:131-133`) renders `DealChip` for each deal in `dealsByDay`.
- 🟡 **No legend strip.** Reference (`MonthView.jsx:194-214`) appends "Key" row with category swatches + team avatars.
- 🟡 **Weekday header copy.** Reference uses full names (`Sunday/Monday/…`); scaffold uses abbreviations.
- 🟡 **Border treatment.** Reference uses 1px subtle internal grid borders; scaffold uses gap-1 separated cards.
- 🟢 **+N more overflow.** Both have it; reference also stacks team avatars under +N when scope=all.

## View 3: Week grid

- 🟡 **Hour range mismatch.** Reference: 7am–9pm @ 52px/hr. Scaffold: 6am–10pm @ 44px/hr.
- 🟡 **Column header missing day-count line.** Reference (`WeekView.jsx:81-83`) shows `2 items` / `No activity`; scaffold shows abbreviation + day number only.
- 🟡 **Today date pill is round 30px.** Reference (`WeekView.jsx:73-79`) renders 30x30 50%-radius coral circle with white number; scaffold tints column header bg `#FEF2F1`.
- 🔴 **Now line is too plain.** Reference (`WeekView.jsx:213-228`) draws 2px coral line + 10x10 coral circle bullet on left edge; scaffold draws 1px line, no bullet.
- 🔴 **Missing pinned "Pipeline" deal-objects strip.** Reference (`WeekView.jsx:137-165`) renders separate column-grid row above time grid with `DealChip`s per day.
- 🔴 **Missing "Deals" overlay summary row.** Reference (`WeekView.jsx:89-134`) — uppercase "Deals" eyebrow + per-day icons + total.
- 🟡 **Activity block category styling wrong.** Reference (`WeekView.jsx:240-254`) uses `style.bg` (full category fill) + `borderLeft 3px solid style.dot` + small box-shadow. Scaffold uses `bg-white` + `border-l-4` only.
- 🟡 **Block content missing time + district.** Reference (`WeekView.jsx:261-275`) renders time eyebrow + clamped title + district when block height > 55. Scaffold shows title + time only.
- 🟡 **Today column tint.** Reference tints today column `rgba(196, 231, 230, 0.15)` (Robin's egg). Scaffold uses `bg-[#FEF2F1]` on header only.
- 🟢 **Team avatar in block.** Reference shows TeammateAvatar top-right when `!a.mine && a.owner`.

## View 4: Map over time

- 🔴 **No actual map.** **Locked decision:** real MapLibre embed, reusing `src/features/map/lib/layers.ts` patterns. Pin clustering by district lat/lng.
- 🟡 **Time-ruler structure.** Reference (`MapTimeView.jsx:9-27`) horizontal time ruler respects grain; scaffold renders flat vertical list.
- 🔴 **No off-map / virtual side panel.** Reference (`MapTimeView.jsx:316-383`) has 300px collapsible right panel with `Off-region | Virtual` tabs + category-breakdown footer.
- 🟡 **No cluster pins, hover tooltips, team-avatar stacks under pin.** Reference (`MapTimeView.jsx:195-267`) renders sized circle pins with count + nested hover popup.
- 🟡 **Empty state missing for map.**
- 🟢 **Header counts line.** Reference (`MapTimeView.jsx:108-148`) shows `N on map / N total in {range} / N not on map` summary bar.

## Upcoming rail

- 🟡 **Bucket structure mismatched.** **Locked design:** day-by-day groups with sticky "Today / DAY · Apr 18" headers (per `ActivitiesInbox.jsx:13-23`). Scaffold uses Today/Tomorrow/This week/Next week buckets.
- 🔴 **No "Log activity" coral button.** Reference (`ActivitiesInbox.jsx:73-83`) — full-width coral button with Plus icon.
- 🟡 **Counts subtitle missing.** Reference shows `30 activities · through Apr 25` or `N yours · N team`; scaffold subtitle is "Your day"/"Team day" only.
- 🟡 **Activity row visual.** Reference (`ActivitiesInbox.jsx:108-156`) is button with `borderLeft: 3px solid {category.dot}`, type-eyebrow+time, bold title (2-line clamp), district + teammate chip. Scaffold is flat list with 1.5px dot + single-line text.
- 🟡 **Sticky day header missing.** Reference uses `position: sticky; top: 0`; scaffold's group label scrolls.
- 🟢 **Collapsed strip width.** Scaffold 40px; reference 36px.
- 🟢 **Collapsed strip rotated label transform.** Reference uses `writing-mode: vertical-rl; transform: rotate(180deg)`. Scaffold reads bottom-to-top — add `rotate-180` to read top-to-bottom.
- 🟢 **"View all" link.** Reference has it; scaffold lacks.

## Activity detail drawer

- 🟢 **Header plum strip + close button correct.** Scaffold matches.
- 🟡 **Header type pill not editable.** Reference (`ActivityDetail.jsx:134-150`) wraps type label in `EditableSelect`; scaffold (`ActivityDetailDrawer.tsx:133-135`) is static.
- 🟡 **Title not editable.** Reference uses `EditableText size=20 weight=700`; scaffold is static `<h2>`.
- 🟡 **Header summary row missing icons-with-data inline.** Reference (`ActivityDetail.jsx:182-208`) shows clock+time, map-pin+district, avatar+owner inline.
- 🟡 **Tab underline color: plum vs coral.** Reference uses coral (`ActivityDetailBits.jsx:185`); scaffold uses plum.
- 🟡 **Tab counts missing.** Reference shows count badges per tab.
- 🟡 **No "More" button in header.** Reference (`ActivityDetail.jsx:170-172`).
- 🟡 **Read-only badge missing.** Reference (`ActivityDetail.jsx:152-157`) shows "Read-only · team activity" pill when `readOnly`.
- 🔴 **No "Save" / "Save & log outcome" footer buttons.** **Locked design: auto-save per field**, no Save buttons. Keep dirty/saved indicator briefly during in-flight save.
- 🟡 **No dirty indicator.** Add transient "Saving…" indicator during in-flight PATCH.

### Overview tab
- 🟡 **Status pill design.** Reference (`ActivityDetail.jsx:325-348`) renders status as small chip with dot when inactive, plum-bg + white when active.
- 🟡 **When uses 1 input + duration.** Reference (`ActivityDetail.jsx:353-386`) has `datetime-local` (start) + `number` (durationMin); scaffold has Start + End datetime fields. Reference UX is significantly better for sales reps.
- 🟡 **Where is read-only summary.** Reference uses `EditableText` (free-text); scaffold shows existing district pills only.
- 🟡 **Attendees not editable.** Reference uses `EditableText`; scaffold shows existing attendees as static pills.
- 🟡 **Description field uses `defaultValue` + onBlur.** Doesn't reset when activity changes; key by `activity.updatedAt` or use controlled `value`.
- 🟢 **Mini stats strip 3-col.** Both render correctly.
- 🟢 **Source footnote.** Both render.

### Outcome tab
- 🔴 **Outcome cards 2x2 grid missing.** Reference (`ActivityDetailBits.jsx:230-256`) renders 4 cards Completed/No-show/Rescheduled/Cancelled. Scaffold (`OutcomePanel.tsx:36-46`) delegates to legacy OutcomesTab — completely different surface.
- 🔴 **Sentiment buttons missing.** Reference has 3 large buttons Positive 👍 / Neutral — / Negative 👎.
- 🔴 **Next step + Follow-up by + Deal impact missing.** Reference (`ActivityDetailBits.jsx:287-330`) has nextStep multiline, followUp date, dealImpact select. Scaffold's `OutcomePanel.tsx:9` only patches `outcomeType` and `outcome`.
- 🟡 **Read-only mode shows just text summary.** Reference reads as fully-rendered cards with `readOnly={true}`.

### Notes tab
- 🟢 **Composer + log structure correct.**
- 🟡 **Composer styling.** Reference (`ActivityDetailPanels.jsx:36-86`) wraps textarea + button row in one rounded-10 border that switches to plum on focus; scaffold has separate textarea + flex button row.
- 🟡 **Composer position.** Reference puts composer above notes; scaffold puts it below.
- 🟡 **Note card styling.** Reference wraps each note in bordered card with `bg-surf-raised`; scaffold uses `flex items-start gap-2.5` with no card.
- 🟢 **⌘↵ submit hint.** Reference renders always; scaffold has it in placeholder only.

### Expenses tab
- 🟡 **Total strip missing receipt-warning pill.** Reference (`ActivityDetailPanels.jsx:158-187`) shows golden `{N} missing receipt` pill.
- 🔴 **Category pills missing.** Reference has 5 categories: Travel sky / Meals gold / Lodging mint / Swag coral / Other neutral. Scaffold has no category. **Wave 1 backend adds the column.**
- 🔴 **Date + receipt fields missing on expenses.** Reference (`ActivityDetailPanels.jsx:191-238`) shows category | description+date+receipt | amount | trash; scaffold shows description + amount + trash only.
- 🔴 **Expense add editor missing.** Reference (`ActivityDetailPanels.jsx:264-352`) is 2-col panel with category select + amount + description + date + receipt file pick + Save/Cancel; scaffold has inline desc + amount + Add button.
- 🟡 **Add button vs add row.** Reference toggles between dashed-border "Add expense" button and editor; scaffold has perma-row.

### Files tab
- 🟢 **Drop zone + Browse + Take photo correct.**
- 🟢 **Photo grid 3-col + gradient overlay correct.**
- 🟡 **File list row icon size.** Reference (`ActivityDetailPanels.jsx:521-526`) uses 32x32 plum-bg-hover container; scaffold uses 32x32 with `bg-[#EEEAF5]` — close but not exact.
- 🟡 **Download button missing.** Reference (`ActivityDetailPanels.jsx:537`) has `<DownloadIcon />`.
- 🟡 **No "uploadedAt" relative time displayed.** Reference shows `{size} · {uploader} · {fmtRelative(uploadedAt)}`.

## Sync badge

- 🟢 **3-state styling correct.**
- 🟢 **Pulse on connected correct.**
- 🟡 **Popover content match closely** but reference has explicit "two-way sync status" line + Disconnect action; scaffold has Sync now + Connect/Reconnect, no Disconnect.
- 🟡 **No polling for `stale` state.** **Locked design:** derive via shared `useCalendarSyncState` hook (Wave 2) — `stale` if `lastSyncAt > 30min ago` OR `pendingCount > 0`.
- 🟢 **Mouse-leave close.** Acceptable but reference uses click-outside.

## Deal overlays + deal objects

- 🔴 **No DealChip component.** Reference (`OppSignals.jsx:177-294`) defines `DealChip` with `density={pip|compact|row}`.
- 🔴 **No OppDayBar** (`OppSignals.jsx:332-368`).
- 🔴 **No OppSummaryStrip** (`OppSignals.jsx:411-642`).
- 🔴 **No OppDrawer** (`OppSignals.jsx:647-815`) — slide-over for clicking a deal-stat.
- 🔴 **No OPP_EVENTS / OPEN_DEALS / TOP_DISTRICTS data layer.** Wave 1 adds `/api/deals/events` + `/api/deals/open` routes.
- 🔴 **No `dealDisplay` toggle UI.** Store has `dealDisplay: 'overlay' | 'objects' | 'both'` (`filters-store.ts:11-16`); no UI changes it.
- 🟡 **Past-due / cold districts callouts missing.** Reference (`OppSignals.jsx:506-619`) shows two pulsing badges (overdue / cold).

## Tokens & primitives

- 🟢 **Tokens parity verified.** All 35+ values in `colors_and_type.css` reproduced in `tokens.md`.
- 🔴 **No shared `EditableText` primitive.** Wave 2 adds `src/features/shared/components/EditableText.tsx`.
- 🔴 **No shared `EditableSelect` primitive.** Wave 2 adds.
- 🟡 **No shared `TabBar` primitive.** Wave 2 adds.
- 🟡 **No shared `FieldLabel` primitive.** Wave 2 adds.
- 🟢 **Animation tokens.** Scaffold drawer uses correct `cubic-bezier(0.16, 1, 0.3, 1)` 250ms slide and 200ms fade.
- 🟡 **Reference uses inline-style heavily; scaffold uses Tailwind.** Keep scaffold's approach.

## Animations

- 🟢 **Drawer slide & fade match.**
- 🟡 **Saved flash custom keyframes missing.** Reference (`ActivityDetail.jsx:116`) defines `flashIn` (opacity 0→1→1→0, translateY -4→0) over 1400ms; scaffold uses plain `transition-opacity`.
- 🟡 **Sync-pulse 1.8s ease-out infinite missing on stale/disconnected.** Scaffold uses Tailwind default `animate-pulse` (2s).
- 🟡 **Hover transitions 120ms not enforced everywhere.** Some scaffold buttons use 150ms default.
- 🟡 **Tab underline color transition.** Reference animates `color 120ms, border-color 120ms`; scaffold uses `transition-colors` only.

## A11y

- 🟢 **Focus trap on drawer** (`ActivityDetailDrawer.tsx:79`).
- 🟢 **Esc to close drawer** (`ActivityDetailDrawer.tsx:51-58`).
- 🟢 **`role=tablist/tab/tabpanel`** on drawer + ViewToggle.
- 🟢 **Live region for "Saved"** uses `aria-live=polite`.
- 🟡 **Notes panel live region** fires only on save success — should also fire on delete.
- 🟡 **Drawer aria-modal on backdrop missing inert siblings.** No `aria-hidden` propagation to background page.
- 🟡 **Filter rail menu missing roving tab index.**
- 🟡 **Sync badge popover** uses `role=dialog` but not focused on open and not `aria-modal`.
- 🟡 **`.fm-focus-ring` utility not applied** anywhere. Token utility defines `outline 2px solid coral, offset 2px`.

## Mobile

- 🟢 **Drawer becomes full-width on mobile** (`w-full md:w-[520px]`).
- 🟡 **Camera capture works** (`FilesPanel.tsx:99-104` has `capture="environment"`).
- 🟡 **Backdrop should slide drawer up as bottom-sheet on mobile.** Currently right-anchored full-width — close, but not true bottom-sheet animation.
- 🟡 **No mobile filter UX.** Filter rail wraps with `flex-wrap` but doesn't collapse to "Filter" toggle drawer on mobile.
- 🟡 **Upcoming rail behavior on mobile undefined.** At 320px+ eats half viewport; no breakpoint-based hide/collapse.

---

## Wave-to-gap mapping

| Wave | Gaps addressed (severity) |
|---|---|
| **Wave 1** Backend foundations | Outcome panel data backing, Expense category/date/receipt schema, deal data routes, query-key bug, state filter bug |
| **Wave 2** Shell + primitives + sync hook | Page route (via ActivitiesView replacement), date range pill, scope toggle, header, EditableText/Select/TabBar/FieldLabel, sync stale derivation |
| **Wave 3** Filter system | Bar variant, Chips variant, VariantSwitcher, Rail extensions (Deals, States, Tags, ⌘K, Reset, double-click solo, partial counts, category pills), Saved view tabs preset list + coral underline + leading icons, default-owner hydration |
| **Wave 4** Views (4 parallel) | Schedule rewrite (click-day card, Pipeline events, type pill, duration), Month rewrite (today indicator, category fills, weekend tinting, OppDayBar slot, legend), Week rewrite (7-9pm @ 52px/hr, round 30px today, 2px coral now-line, full category fills, today tint, pinned Pipeline+Deals rows), Map (real MapLibre, time ruler, OffMapPanel, pin clusters) |
| **Wave 5** Drawer panels (5 parallel) | Drawer shell (editable header, More button, read-only badge, coral tabs+counts, no-Save buttons, flashIn keyframes), Overview (duration input, EditableText/Select for type/title/where/attendees), Outcome rewrite (2x2 cards, sentiment, nextStep, followUp, dealImpact), Notes+Files (composer above, bordered cards, Download, uploadedAt), Expenses (categories, missing-receipt pill, ExpenseEditor, per-line date+receipt) |
| **Wave 6** Deal layer | DealChip, OppDayBar, OppSummaryStrip, OppDrawer, OverdueDealRow, ColdDistrictRow, OppRibbon, DealDisplayToggle; thread through views |
| **Wave 7** Polish | UpcomingRail rich rows (border-left, eyebrow+time, sticky day headers, coral Log button, "View all"), `.fm-focus-ring` utility, focus-trap menu items, aria-hidden on drawer open, live regions on note delete, mobile filter collapse, mobile bottom-sheet, animations 120ms/flashIn/sync-pulse |

## Anchor file paths (absolute)

```
/Users/sierraarcega/territory-plan/.claude/worktrees/activities-calendar-redesign/
├── src/features/activities/components/page/   ← all scaffold targets
│   ├── ActivitiesPageHeader.tsx
│   ├── ActivitiesDateRange.tsx
│   ├── ActivitiesFilterRail.tsx
│   ├── SavedViewTabs.tsx
│   ├── ScheduleView.tsx
│   ├── MonthView.tsx
│   ├── WeekGridView.tsx
│   ├── WeekStrip.tsx
│   ├── MapTimeView.tsx
│   ├── UpcomingRail.tsx
│   ├── ViewToggle.tsx
│   ├── ActivityDetailDrawer.tsx
│   ├── CalendarSyncBadge.tsx
│   └── drawer/{OverviewPanel,OutcomePanel,NotesPanel,ExpensesPanel,FilesPanel,AttachmentThumb}.tsx
├── src/features/activities/lib/
│   ├── filters-store.ts                ← FilterVariant, dealDisplay already wired
│   ├── saved-views.ts                  ← preset IDs need updating
│   └── queries.ts                      ← query-key bug, state bug, multi-value
├── src/features/calendar/
│   ├── components/CalendarSyncBadge.tsx ← second sync badge
│   ├── lib/queries.ts                   ← useCalendarConnection
│   └── lib/{push,sync,google}.ts
├── src/features/shared/
│   ├── components/views/ActivitiesView.tsx ← REPLACE BODY
│   ├── components/                          ← new EditableText/Select/TabBar/FieldLabel here
│   └── lib/queries.ts                       ← useProfile
├── src/lib/{prisma.ts,supabase/server.ts,supabase-storage.ts}
├── src/app/api/activities/                  ← extend route + add expenses + add deals
├── prisma/schema.prisma                     ← Activity@576, ActivityExpense@705, ActivityNote@794, ActivityAttachment@811
├── prisma/migrations/                       ← add 2 new migrations
├── supabase/storage-activity-attachments.sql ← run manually before file uploads
└── design_handoff_activities_calendar/       ← all reference JSX + colors_and_type.css
```
