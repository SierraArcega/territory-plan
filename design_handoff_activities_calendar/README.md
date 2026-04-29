# Handoff: Activities + Calendar Redesign

## Overview

This is a **full redesign of the Activities page** in Mapomatic / Fullmind Sales — combining the activity log, calendar, pipeline deals, and field-trip planning into a single unified surface. Reps can see their work across four pivot views (Month, Week grid, Schedule, Map-over-time), filter and save views, get a contextual "Upcoming" rail, and drill into any activity in a rich editable drawer.

The shipped prototype lives at `reference/Activities + Calendar.html`. Open it locally to see the full flow.

## About the Design Files

The files in `reference/` are **design references created as inline React (Babel-transpiled JSX) with a plain CSS-variable token sheet**. They are prototypes showing intended look and behavior — **not production code to copy directly**.

The task is to **recreate this design in the target codebase** at `territory-plan/` (Next.js 14 App Router, TypeScript, Tailwind, Prisma, Supabase). Use the project's established patterns — server/client components, Tailwind classes bound to the token CSS variables, the `fm-*` utility classes, existing shadcn-style primitives — and the tokens documented in `Documentation/UI Framework/tokens.md`. The CSS variables in `reference/colors_and_type.css` map 1:1 to those tokens.

Do not paste the inline JSX verbatim. Split each reference file into proper TSX components in an appropriate feature folder (e.g. `src/features/activities/`), replace inline style objects with Tailwind classes, and wire to real data via Prisma + server actions / route handlers.

## Fidelity

**High-fidelity.** Pixel-perfect mockups with final colors, typography, spacing, interactions, and motion. Match the prototype exactly using the codebase's existing libraries.

---

## Page structure

```
┌─ Sidebar (existing) ──┬─ Main ─────────────────────────────────────────────┐
│                       │ ┌─ Page header ──────────────────────────────┐   │
│                       │ │ Title + count · Sync badge · View toggle   │   │
│                       │ │ Date range selector (grain: day/week/mo/Q) │   │
│                       │ └────────────────────────────────────────────┘   │
│                       │ ┌─ Filter rail (3 variants behind tweak) ────┐   │
│                       │ │ Saved view tabs · chips · search · state   │   │
│                       │ └────────────────────────────────────────────┘   │
│                       │ ┌─ View body ─────────────┬─ Upcoming rail ─┐    │
│                       │ │ Month / Week / Sched /  │ (collapsible)   │    │
│                       │ │ Map pivots              │                 │    │
│                       │ └─────────────────────────┴─────────────────┘    │
└───────────────────────┴─────────────────────────────────────────────────────┘
          ↑ ActivityDetail drawer slides in from right over this
```

### Top-level pieces

1. **Page header** — title with shown-count subtitle, Google Calendar sync badge (live/stale/disconnected states, expands to sync detail popover), view toggle (Month / Week / Schedule / Map)
2. **Date range selector** — grain picker (Day · Week · Month · Quarter) + prev/next/today, label updates with grain
3. **Filter system** — unified filter state across categories, types, deal kinds, deal stages, deal amount, statuses, owners (reps), states, territories, tags, and free-text. Three UI variants (Rail / Bar / Chips) behind a tweak. Saved-view tabs on top (All activities · My week · CT · Meetings · Renewals · Conferences · Save view).
4. **Scope** — derived from owner filter: only "Alex Rivera" = `mine`, else `all`. Drives inbox copy, map density, team badges.
5. **Four view pivots** — see below
6. **Upcoming rail** — right-side 320px context panel with today + next 7 days, collapsible to a thin strip
7. **Activity detail drawer** — 520px right-side overlay with 5 tabs, fully editable (detailed further down)

---

## View 1 — Month

File: `reference/components/MonthView.jsx`

- Full-month grid, week-starts-on-Sunday, shows current month + leading/trailing days
- Each day cell shows up to 3 activity chips + "+N more" overflow
- Chips colored by category (Meetings · Events · Campaigns · Fun) with category dot
- Today highlighted with coral corner accent
- Click day → switches to Schedule view for that day
- Click activity chip → opens detail drawer
- Opp/deal signals overlay: small colored dots in the corner of days with won/lost/created/progressed deals; or as first-class chips when `dealDisplay=objects|both`
- Team scope shows an avatar cluster instead of individual chips on busy days

## View 2 — Week (grid)

File: `reference/components/WeekView.jsx`

- 7-day grid with a scrollable time axis (6am–10pm)
- Hour rows, thin separators, activities as time blocks
- Current time indicator: 1px coral line across current day
- Activity blocks: category-colored left border, title + time in block; stacked side-by-side for overlaps
- Team events: avatar pile in block corner
- Deals render as dashed-outline blocks when displayed as objects

## View 3 — Schedule

File: `reference/components/CalendarData.jsx` (`ScheduleView` also there) and the header strip in `components/MonthView.jsx` reuses the strip renderer.

- Week strip at top: 7 date tiles with day counts + deal dots
- Agenda body: one card per day with "today" pill for today, all that day's activities listed in time order
- Pipeline events section per day with deal chips and amounts
- Default view for most reps

## View 4 — Map over time

File: `reference/components/MapTimeView.jsx`

- Left pane: horizontal time ruler showing activities as pins along the current range (respects grain — day/week/month)
- Right pane: map with pinned activities by state/territory
- Hover on ruler pin highlights pin on map; click opens drawer
- Territory heat overlays optional

---

## Filter system

File: `reference/components/FilterVariants.jsx`

Three UI variants, same state shape. User can swap live via the floating variant switcher (bottom-left) or the Tweaks panel.

### Variant 1: Rail

Horizontal row under the saved-view tabs. Multi-selects:
- Category dot cluster (colored dots for meetings/events/campaigns/fun — click to toggle, double-click to solo)
- Type (all types dropdown, checkbox list)
- Rep/owner (avatar stack dropdown)
- State (dropdown with search)
- Territory / Tags / Status (overflow menu)
- Free-text search box with `⌘K` hint

### Variant 2: Bar

Same filters but inline as a single bar with segmented pills.

### Variant 3: Chips

Active filters show as removable chips; inactive are hidden behind "+ Filter" button.

### Saved-view tabs

Horizontal tabs above the filter: All activities / My week / CT · Meetings / Renewals / Conferences / + Save view. Clicking a tab applies a preset filter state. "Save view" prompts to save the current filters.

### State shape

```ts
type Filters = {
  categories: Set<'meeting'|'event'|'campaign'|'fun'>;
  types: Set<string>;              // e.g. 'demo'|'school_visit'|'lunch'|'dinner'|'conference'...
  dealKinds: Set<'won'|'lost'|'created'|'progressed'>;
  dealStages: Set<string>;
  dealMin: number;
  dealMax: number | null;
  statuses: Set<'planned'|'tentative'|'in_progress'|'completed'|'cancelled'>;
  owners: Set<string>;             // rep names
  states: Set<string>;             // US state codes
  territories: Set<string>;
  tags: Set<string>;
  text: string;
};
```

Default: all dimensions fully selected (i.e. no filter); owner defaults to `['Alex Rivera']` to mirror old "Mine" scope.

---

## Upcoming rail

File: `reference/components/ActivitiesInbox.jsx`

- 320px right column, collapsible to a 40px strip with rotated "UPCOMING" label
- Sections: Today · Tomorrow · This week · Next week
- Each item: time + category dot + title, district as secondary line
- Scope-aware copy: "Your day" vs "Team day"
- Click → opens drawer

---

## Activity detail drawer (click any activity)

File: `reference/components/ActivityDetail.jsx` + `ActivityDetailBits.jsx` + `ActivityDetailPanels.jsx`

520px wide, slides in from right over backdrop. Five tabs:

### Header
- Plum category strip (4px left)
- Inline-editable activity type pill + title
- Summary row: clock + time range, map-pin + district, avatar + owner

### Tab 1: Overview
- **Status pills** (Planned / Tentative / In progress / Completed / Cancelled — each with colored dot; active = plum bg)
- **When** — `datetime-local` + duration-minutes (120px col)
- **Where** — inline editable
- **Attendees** — inline editable
- **Description** — inline editable multiline
- **Mini stats strip** — Notes count · Expenses total · Files count
- **Source footnote** — "Your activity · changes sync to Google Calendar" or "Team activity · read-only"

### Tab 2: Outcome
- **Outcome cards** (2×2 grid) — Completed · No-show · Rescheduled · Cancelled, each with colored dot + subtitle; selected = plum border + raised bg
- **Sentiment** — 3 buttons: Positive 👍 · Neutral — · Negative 👎
- **Next step** — optional multiline
- **Follow-up by** — date picker
- **Deal impact** — No change · Progressed · New opp · Won · Lost

### Tab 3: Notes
- **Composer** — expanding textarea, ⌘↵ submit, Clear/Add note buttons
- **Threaded log** — 22px plum avatar, author + relative time, `pre-wrap` body, delete on own notes

### Tab 4: Expenses
- **Total strip** — raised card with total dollar value + missing-receipt warning pill
- **Line items** — 4-col grid: category pill (tint+ink per category) · description+meta · amount · trash
- **Categories:** Travel (sky) · Meals (gold) · Lodging (mint) · Swag (coral) · Other (neutral)
- **Add-expense editor** — inline panel with 2-col form, file-pick receipt

### Tab 5: Files
- **Drop zone** — dashed border, drag+drop, Browse / Take photo buttons. Camera button uses `<input capture="environment">` for mobile
- **Photos** — 3-col grid, aspect-1, gradient filename overlay, remove button
- **Files** — 32×32 plum file tile, filename + meta (size · uploader · relative time), download + remove

### Read-only mode

Engages when `activity.mine === false`. Hides save/delete/add-note composer/add-expense/drop-zone/per-item remove. EditableText/Select render as plain text.

### Footer

Sticky. Left: delete (coral hover), dirty/saved indicator. Right: Close · Save · Save & log outcome (primary).

---

## Sync badge

Inline component in `reference/Activities + Calendar.html` (`CalendarSyncBadge`).

States — `connected` (mint, pulses), `stale` (gold), `disconnected` (coral). Click opens 300px popover with account / calendars / two-way sync status + Sync now / Reconnect / Disconnect actions.

---

## Primitives

File: `reference/components/Primitives.jsx`

Already-tokenized atoms used throughout:
- `Button` — variants: primary (plum) · coral · secondary · ghost · danger; sizes sm/md/lg; icon slot
- `Input` — with prefix slot, error state, coral focus ring
- `Badge` — kind `signal` (growing/stable/at_risk/declining) or `status` (active/planning/stale/closed)
- `Card` — with `interactive` hover state
- `Stat` — eyebrow + 20px/700 value + delta line
- `ProgressBar` — color ramps by pct

## Icon system

File: `reference/components/IconSystem.jsx`

Lucide-style set (2px stroke, round caps, currentColor, 24×24). Already exported on `window` in prototype. Map 1:1 to Lucide React names:

| Prototype | Lucide React |
|---|---|
| `HomeIcon` | `Home` |
| `MapIcon` | `Map` |
| `PlansIcon` | `ClipboardCheck` |
| `ActivitiesIcon` | `Calendar` |
| `TasksIcon` | `ListChecks` |
| `SearchIcon` | `Search` |
| `FilterIcon` | `Filter` |
| `PlusIcon` | `Plus` |
| `XIcon` | `X` |
| `PencilIcon` | `Pencil` |
| `ChevronDownIcon` | `ChevronDown` |
| `ChevronLeftIcon` | `ChevronLeft` |
| `ChevronRightIcon` | `ChevronRight` |
| `MapPinIcon` | `MapPin` |
| `ClockIcon` | `Clock` |
| `CheckIcon` | `Check` |
| `CheckCircleIcon` | `CheckCircle2` |
| `TrashIcon` | `Trash2` |
| `PaperclipIcon` | `Paperclip` |
| `CameraIcon` | `Camera` |
| `FileIcon` | `File` |
| `FileEditIcon` | `FileEdit` |
| `DownloadIcon` | `Download` |
| `DollarIcon` | `DollarSign` |
| `MoreIcon` | `MoreHorizontal` |
| `UsersIcon` | `Users` |
| `LinkIcon` | `Link` |
| `SparkleIcon` | `Sparkles` |
| `SchoolIcon` | `School` |
| `LayersIcon` | `Layers` |
| `SettingsIcon` | `Settings` |
| `ListPlusIcon` | `ListPlus` |

---

## Data model (Prisma — additions/changes)

Inspect `prisma/schema.prisma` for the current `Activity` model. Changes/additions needed:

```prisma
enum ActivityStatus { planned tentative in_progress completed cancelled }
enum ActivityOutcome { completed no_show rescheduled cancelled }
enum ActivitySentiment { positive neutral negative }
enum DealImpact { none progressed created won lost }
enum ExpenseCategory { travel meals lodging swag other }
enum AttachmentKind { photo file }

model Activity {
  // ... existing fields
  status          ActivityStatus
  outcome         ActivityOutcome?
  sentiment       ActivitySentiment?
  nextStep        String?
  followUpDate    DateTime?
  dealImpact      DealImpact @default(none)

  notes           ActivityNote[]
  expenses        ActivityExpense[]
  attachments     ActivityAttachment[]
}

model ActivityNote {
  id          String   @id @default(cuid())
  activityId  String
  activity    Activity @relation(fields: [activityId], references: [id], onDelete: Cascade)
  authorId    String
  body        String
  createdAt   DateTime @default(now())
}

model ActivityExpense {
  id            String            @id @default(cuid())
  activityId    String
  activity      Activity          @relation(fields: [activityId], references: [id], onDelete: Cascade)
  category      ExpenseCategory
  amountCents   Int
  description   String
  incurredOn    DateTime
  receiptUrl    String?
  createdAt     DateTime          @default(now())
}

model ActivityAttachment {
  id            String         @id @default(cuid())
  activityId    String
  activity      Activity       @relation(fields: [activityId], references: [id], onDelete: Cascade)
  kind          AttachmentKind
  name          String
  sizeBytes     Int
  mime          String
  url           String
  uploadedById  String
  uploadedAt    DateTime       @default(now())
}
```

Route handlers (`app/api/activities/[id]/...`):
- `PATCH /` — core fields + outcome payload
- `POST /notes` · `DELETE /notes/:noteId`
- `POST /expenses` · `DELETE /expenses/:expenseId`
- `POST /attachments` (multipart, writes to Supabase Storage) · `DELETE /attachments/:attachmentId`

File uploads → Supabase Storage bucket `activity-attachments` with RLS matching `supabase/rls-policies.sql`.

---

## Design tokens

All tokens are in `reference/colors_and_type.css` (mirrors `Documentation/UI Framework/tokens.md`).

### Brand palette
- `--color-plum` `#403770` — primary
- `--color-plum-dark` `#322a5a`
- `--color-coral` `#F37167` — accent, destructive hover, focus ring
- `--color-steel-blue` `#6EA3BE`
- `--color-robins-egg` `#C4E7E6`
- `--color-golden` `#FFCF70`
- `--color-mint` `#EDFFE3`
- `--color-sage` `#8AA891`
- `--color-off-white` `#FFFCFA`

### Surfaces (plum-derived — do not use Tailwind gray)
- `--surface` `#FFFCFA` · `--surface-raised` `#F7F5FA` · `--surface-hover` `#EFEDF5` · `--surface-white` `#FFFFFF`

### Borders
- `--border-subtle` `#E2DEEC` · `--border-default` `#D4CFE2` · `--border-strong` `#C2BBD4` · `--border-brand` `#403770`

### Foreground ladder
- `--fg-muted` `#A69DC0` · `--fg-secondary` `#8A80A8` · `--fg-body` `#6E6390` · `--fg-strong` `#544A78` · `--fg-primary` `#403770` · `--fg-pressed` `#322a5a` · `--fg-inverse` `#FFFFFF`

### Semantic families
- Error: bg `#fef1f0` · fg `#c25a52` · border `#f58d85` · strong `#F37167`
- Warning: bg `#fffaf1` · fg `#997c43` · border `#ffd98d` · strong `#FFCF70`
- Success: bg `#F7FFF2` · fg `#5f665b` · border `#8AC670` · strong `#69B34A`
- Info: bg `#e8f1f5` · fg `#4d7285` · border `#8bb5cb` · strong `#6EA3BE`

### Radius / shadow / spacing / type
See `reference/colors_and_type.css` — fully documented. Key reminders:
- Eyebrows (`10px/700`, uppercase, `0.08em` letter-spacing) must have `white-space: nowrap`
- Buttons with short labels that could wrap should have `white-space: nowrap`
- Datetime-local inputs: never feed `.toISOString()` — format local wall-clock time (`YYYY-MM-DDTHH:mm` using `Date` getters, not `getUTC*`)

---

## Animations

- Drawer backdrop fade — 200ms linear
- Drawer slide — 250ms `cubic-bezier(0.16, 1, 0.3, 1)` (token `--ease-out-expo`)
- Hover transitions — 120ms
- Tab underline color — 120ms
- Saved flash — custom `flashIn` keyframes over 1400ms (opacity 0→1→1→0, translateY -4→0)
- Sync-badge dot pulse — 1.8s ease-out infinite (connected only)

---

## Persistence (localStorage keys)

The prototype persists several UI preferences; production should mirror into user preferences table or keep localStorage:

- `cal.view` — active pivot
- `cal.grain` — active grain
- `cal.scope` — derived mine/all
- `cal.filterVariant` — rail/bar/chips
- `cal.savedView` — active saved view id
- `cal.rail.collapsed` — inbox rail state
- `cal.dealDisplay` — overlay/objects/both
- `cal.sync` — sync badge state (connected/stale/disconnected)

---

## Accessibility

- Drawer: backdrop click closes; add `Esc` listener in real impl; focus trap via `Documentation/UI Framework/Utilities/focus-trap.md`; tabs get `role=tablist/tab/tabpanel`
- Icon-only buttons need `aria-label` or `title`
- Use `.fm-focus-ring` for focus-visible states (coral 2px outline, 2px offset)
- All EditableText/EditableSelect should be reachable via Tab and activated via Enter/Space
- Live regions: "Saved" flash should announce via `aria-live=polite`

---

## Files in this handoff

```
reference/
  Activities + Calendar.html           ← full working prototype; open in browser
  colors_and_type.css                  ← design tokens (mirrors Documentation/UI Framework/tokens.md)
  components/
    Sidebar.jsx                        ← left rail
    IconSystem.jsx                     ← Lucide-style icon set
    Primitives.jsx                     ← Button, Input, Badge, Card, Stat, ProgressBar
    CalendarData.jsx                   ← mock activity data + helpers (seed + formatters)
    CalendarChrome.jsx                 ← ViewToggle, DateRangeSelector, CollapsedRail
    FilterVariants.jsx                 ← FilterBar / VariantFilters / VariantSwitcher (3 variants)
    MonthView.jsx                      ← month grid
    WeekView.jsx                       ← time-grid week
    MapTimeView.jsx                    ← map + time ruler
    ActivitiesInbox.jsx                ← Upcoming rail
    OppSignals.jsx                     ← deal overlay + deal chip objects
    ActivityDetail.jsx                 ← drawer shell + Overview tab + footer
    ActivityDetailBits.jsx             ← FieldLabel, EditableText, EditableSelect, TabBar, OutcomePanel
    ActivityDetailPanels.jsx           ← NotesPanel, ExpensesPanel, AttachmentsPanel
```

Start with `reference/Activities + Calendar.html` — it's the entry point that wires everything together.

---

## Suggested implementation order

1. **Tokens & primitives** — verify `tokens.md` matches `colors_and_type.css`; add any missing primitives (EditableText, EditableSelect, TabBar) to the shared UI kit
2. **Prisma schema** — add ActivityNote, ActivityExpense, ActivityAttachment, outcome fields; migrate
3. **Route handlers** — PATCH activity, notes CRUD, expenses CRUD, attachments CRUD with Supabase Storage
4. **Page scaffold** — `/activities` route with sidebar, header, sync badge, view toggle (Schedule default)
5. **Schedule view** — simplest pivot, ship first
6. **Filter state & Rail variant** — unified filter store; defer Bar/Chips variants to a later phase
7. **Saved views** — preset tabs; persist to user-prefs
8. **Upcoming rail** — with collapsible strip
9. **Activity detail drawer** — shell, then tab by tab (Overview → Outcome → Notes → Expenses → Files)
10. **Month view**, then **Week grid**, then **Map-over-time**
11. **Deal overlays + deal objects** — layered on all four views
12. **Sync badge** — wire to real Google Calendar connection status
13. **A11y pass** — focus trap, Esc, ARIA tabs, live regions
14. **Mobile polish** — drawer becomes full-sheet, camera capture tested on iOS/Android
