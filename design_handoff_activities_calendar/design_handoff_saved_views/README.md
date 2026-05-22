# Handoff: Saved Views — Plans & Lists Sidebar

## Overview

This handoff covers a redesign of Mapomatic's left sidebar into a unified **Plans & Lists** model — replacing the separate "Plans" navigation with a single **My views** section that houses both targeted territory plans and ad-hoc saved lists. Each plan/list can render its data through multiple **views** (Map, Table, Kanban, Contacts, Opportunities, Vacancies, News, RFPs), and clicking any row opens a contextual right-side detail panel.

The feature includes a **list builder modal** with an AI-first creation flow that translates natural-language requests ("Vacancies at Tier A districts in NY or NJ posted in the last 14 days") into a structured list spec.

## About the Design Files

The files in this bundle are **design references created in HTML/JSX with React via Babel-in-browser**. They are prototypes that demonstrate the intended look, layout, and interaction patterns — they are **not production code to copy directly**.

Your task is to **recreate these designs in Mapomatic's existing codebase** using its established React patterns, component library, state management, and styling approach. The design tokens (colors, spacing, typography) match Mapomatic's existing design system as defined in `design-system/colors_and_type.css` — use the codebase's equivalents.

If you encounter ambiguity, fall back to the prototype's behavior as the source of truth.

## Fidelity

**High-fidelity.** Colors, typography, spacing, border radii, shadows, and hover/active states are all final. The prototype uses Mapomatic's existing design tokens (plum #403770, coral #F37167, robin's-egg #C4E7E6, etc.) and the Plus Jakarta Sans font family.

Match pixel-level details from the prototype:
- Sidebar width: 252px (compact density) / 268px (comfortable density)
- Right-side detail panel: 380px
- Modal max-width: 880px
- Group accent bars: 3px wide
- Border radius: 6–8px on most elements, 12–16px on modals
- Card shadows: `0 1px 2px rgba(64,55,112,0.05)` resting, `0 4px 6px -1px rgba(64,55,112,0.08)` hover

---

## Information Architecture

### Sidebar — three tiers

1. **Top nav**: Home, Map, Activities, Tasks, Leaderboard (existing)
2. **My views** section (new):
   - "All plans" portfolio link (opens FY portfolio dashboard)
   - **Plans** subsection (🎯) — targeted groups with fiscal periods, revenue targets, owners
   - **Lists** subsection (📋) — saved filter-based queries
3. **Footer**: profile + pod info; hidden/archived recovery links

### Plan vs. List — the data model distinction

| | Plan 🎯 | List 📋 |
|---|---|---|
| Purpose | Committed territory, comp-relevant | Saved query / working set |
| Membership | Durable — assigning a district is a real CRM action | Filter-derived (live) or reference-derived |
| Carries | Fiscal period, revenue target, owner, progress | Filter chips, scope reference |
| Surfaces | Portfolio dashboard, leaderboard, comp rollups | Sidebar only |
| Examples | "FY26 · Northeast Pod" ($1.2M target) | "High-priority prospects", "Lapsed customers" |

Both render through the same view-type system (Map / Table / Kanban / Contacts / Opps / Vacancies / News / RFPs). What changes is the canvas chrome — plans show progress stats, lists show filter chips.

---

## Screens / Views

### 1. Main Application Shell

**File**: `app-unified.jsx` → `UnifiedApp` component

- Two-pane layout: sidebar (252px) + main canvas (flex)
- Background: `#FFFCFA` (off-white)
- Sidebar border-right: `1px solid #D4CFE2`
- Active nav item: coral pill (`#F37167` text + `#FEF2F1` background) with left accent bar
- Density tweak: 'compact' (default) or 'comfortable' — affects padding on nav items and group rows

### 2. Sidebar — My Views Section

**Section header**: bookmark icon + "My views" eyebrow (uppercase, letterspacing 0.06em, color `#403770`).

**"All plans" row**: Grid icon + label + count badge → opens portfolio dashboard.

**Plans subsection**:
- Header: 🎯 emoji + "Plans" label + "FY26" right-aligned
- Each plan row:
  - Caret (chevron-down, rotates -90deg when collapsed) — toggle open
  - 3px-wide accent bar (color from plan's accent — coral/steel-blue/sage)
  - Plan label
  - Mini progress ring on the right (circular SVG, 14px, stroke colored by progress: green ≥75%, blue ≥50%, coral below)
- When expanded:
  - Meta line: `{pct}%` (plum) + "of {target}" + "·" + fiscal label (10px, color `#8A80A8`)
  - List of views, indented 30px from left, with view-type icons
  - "+ New view" affordance at bottom (dashed, muted)

**Lists subsection**:
- Header: 📋 emoji + "Lists" + + button (calls `openBuilder()`)
- Each list row: list-icon (lines) + label + caret
- When expanded: same indented view list

**Hover menu (⋯)**: appears top-right of any plan/list row on hover. Opens popover with:
- Pin to top
- Rename
- Share
- *(divider)*
- **Hide from sidebar** — sets `hidden: true` on the group; "Only affects you" hint
- **Archive plan** (plans only) — sets `archived: true`; "Keeps history; removes from sidebar" hint
- **Delete list** (lists only, danger color `#c25a52`)

**Footer affordances** (only shown when applicable):
- "Show hidden (N)" toggle — when on, hidden items appear dashed-out with an "Unhide" link
- "Archived plans · N" — navigates to portfolio with Archived tab selected

**Sidebar bottom strip**: + dashed "New list" button → `openBuilder()`. Below that: 28px circular avatar (robin's-egg bg, initials in plum) + name + pod.

### 3. Group Canvas (when a plan or list is active)

**File**: `app-unified.jsx` → `GroupCanvas` component

Header area (white bg, border-bottom):
- **Eyebrow** (plan): `▪ FY26 Plan · {fiscal}` + Shared pill (if shared) — 10px uppercase plum
- **Eyebrow** (list): `📋 List`
- **Title row**: H1 (20px, 700, plum, -0.01em letterspacing) + ` / ` separator + view-type icon (coral) + view label (16px, 600, `#544A78`) + pencil-edit icon button
- **Stat grid** (plans only): responsive grid `repeat(auto-fit, minmax(110px, 1fr))`:
  - Target, Progress, Pipeline, Contacts, Open opps, Owner (avatar)
  - Each stat: 10px uppercase label (color `#8A80A8`) + 14px tabular-nums value (700, plum)
- **Filter chips** (lists only): pill-shaped, white bg, 1px `#E2DEEC` border, filter icon prefix
- **Right-side actions**: filter icon button · search icon button · vertical divider · "Share" secondary button · "Save as list" primary button (plum bg, white text)

Below the header:
- **Progress bar** (plans only): 4px tall, `#EFEDF5` track, fill in success/info/error color based on progress%
- **View tabs strip**: horizontal scrollable tabs, 8px×12px padding, active tab has 2px plum bottom border + 600 weight, inactive tabs are `#8A80A8`. "+ View" affordance at end.

Body: renders the active view component.

### 4. Views

All views fill the canvas body area (flex 1, min-height 0, position relative). The CanvasBody wrapper handles click-to-open detail panels via event delegation.

#### 4a. Map view
**File**: `app-shared.jsx` → `CanvasMapView`
- Background: gradient from `#D8EDEC` to `#A8D4D3` with a subtle 64px grid pattern (`rgba(110,163,190,0.18)`)
- Choropleth blobs: 4 colored regions (declining/growing/at-risk/stable)
- District pins: 22×28 colored pin SVGs with white center dot
- Top-left: filter chip strip
- Bottom-left: opportunity legend card (4 color swatches)
- Top-right: floating title + count badge

#### 4b. Table view
**File**: `app-shared.jsx` → `CanvasTableView`
- Headers: 10px uppercase `#8A80A8`, sticky top, `#F7F5FA` bg, 1px bottom border
- Rows: 10px×14px cell padding, `#EFEDF5` row dividers
- Signal dot (6px circle) before district name
- Tier badge: A=coral on `#FEF2F1`, B=steel on `#e8f1f5`, C=muted on `#F7F5FA`
- Stage pill: filled with semi-transparent stage color + tiny dot prefix
- Numeric columns: tabular-nums, right-aligned

#### 4c. Kanban view
**File**: `app-shared.jsx` → `CanvasKanbanView`
- 240px-wide columns, 12px gaps
- Column header: stage dot + name + count, with + button
- Cards: 1px `#D4CFE2` border, 8px radius, white bg, signal dot + district name + meta + ARR/pipeline pills
- "+ Add district" dashed button at column end

#### 4d. Contacts view
**File**: `app-unified.jsx` → `CanvasContactsView` (sample data inline)
- Table: 26px circular avatars (robin's-egg bg, plum initials), Stage pill (Champion green / Engaged blue / Cold red), Tier letter

#### 4e. Opportunities view
**File**: `app-unified.jsx` → `CanvasOppsView`
- Table: title + district + Stage pill + ARR (bold tabular) + Close date + owner avatar

#### 4f. Vacancies / News / RFPs
**File**: `district-feeds.jsx`
- **Vacancies table**: District, Role, Signal pill (High/Med/Low), Posted, Status pill, Note
- **News feed** (cards, not table): 36px square district-initials block + headline + category pill + source/date
- **RFPs table**: District, Title (with stage subtitle), Category pill, Posted, Due, Value, Status pill

### 5. Detail Panel — right-side slide-in

**Files**: `district-panel.jsx` (district-specific), `detail-panel.jsx` (contacts/opps/vacancies/news/rfps)

Triggered by clicking any row in any view. The `CanvasBody` component uses event delegation: walks up from click target to find a `<tr>` in `<tbody>` (or a `[data-row-id]` element) and routes to the right panel.

- 380px wide, absolutely positioned right
- Box shadow: `-12px 0 32px rgba(64,55,112,0.08)`
- Slide-in animation: 250ms, cubic-bezier(0.16, 1, 0.3, 1), translateX(20px → 0) + opacity 0 → 1

**Structure** (all kinds):
- Header (18px padding, 1px bottom border):
  - Eyebrow (10px uppercase + tiny icon)
  - H2 title (18px, 700, plum, -0.01em)
  - Meta row: stage/status pill(s) + secondary info
  - Action row: primary "Log activity" (plum bg) + secondary "Save" + secondary share icon button

- For districts: tabs (Overview / Contacts / Pipeline / Activity) below the action row

- Body: scrollable, sections of:
  - **Stats grid** (2-column, 10px padded `#FFFCFA` cards with `#E2DEEC` border)
  - **Sections** with 10px uppercase labels
  - **Item rows**: 6px coral dot + title + sub
  - **Notes/scope/summary blocks**: 10px padded `#FFFCFA` cards with serif-ish 12px text

**Per-kind specifics**:
- **District**: ARR / Pipeline / Schools / Renewal stats + Primary contact card + Recent activity
- **Contact**: Email / Phone / Last touch KV pairs + Engagement stats (Emails, Meetings) + Recent touchpoints
- **Opportunity**: ARR / Close / Owner / Confidence stats + Notes block + Stage history items
- **Vacancy**: "Why it matters" context block + Status/Posted stats + Suggested actions (Add to watchlist, Brief owner, Set follow-up)
- **News**: Summary block + Related districts in plan + Suggested actions (Add to plan brief, Share with team)
- **RFP**: Posted / Due / Value / Status stats + Scope block + Suggested actions (Convert to Opportunity, Assign to RFP team, Calendar reminder)

### 6. All Plans Portfolio

**File**: `app-unified.jsx` → `PortfolioView`

Activated by clicking "All plans" in the sidebar.

Header (white bg, border-bottom):
- Left: "FY26 Portfolio" eyebrow + "All plans" h1 (22px, 700, plum)
- Right: portfolio stats row — Total target / Booked / Open pipeline / To target

Body (off-white `#FFFCFA` bg):
- **Tabs**: "Active · N" / "Archived · N" — 2px plum bottom border for active, marginBottom -1 to overlap container border
- **Card grid**: `repeat(auto-fill, minmax(320px, 1fr))`, 14px gap
- **Plan card**:
  - White bg, 1px `#D4CFE2` border, 8px radius, 1px×2px shadow
  - 3px accent stripe across the top (plan accent color), rounded-top
  - Fiscal eyebrow + plan name
  - Owner avatar (top right)
  - Target / Pipeline stats row
  - Revenue-to-target progress bar with color-coded fill
  - Footer: "N views" + Shared indicator + "Unarchive" link (archived tab only)
- **New plan card** (only on Active tab): dashed border, centered plus icon + "New plan"

### 7. List Builder Modal

**File**: `list-builder.jsx` → `ListBuilder`

Opened from:
- "+ New list" in sidebar Lists header
- Dashed "New list" button at bottom of My views
- "Save as list" button in canvas header (pre-fills filters from current view)

Modal:
- Overlay: `rgba(64,55,112,0.45)` backdrop, 32px padding
- Box: 880px max-width, 88vh max-height, 16px radius, `0 24px 48px rgba(64,55,112,0.25)` shadow
- Two-column body grid: `1fr 280px` (controls left, preview right)
- Fade-in (150ms) + slide-up (200ms)

Sections (top to bottom in left column):

1. **AI prompt block** (the primary path):
   - Gradient bg: `linear-gradient(135deg, #FEF2F1 0%, #F7F0FA 100%)`
   - "✨ Describe what you want" header
   - Text input + plum "Build" button
   - Suggested prompt chips: "News at Northeast Pod districts" / "Vacancies in Iowa districts" / "Open RFPs > $100K closing this quarter" / "Champions I haven't talked to in 30d"
   - Error and amber notice slots ("Some advanced logic was simplified…")

2. **Manual editor divider**: horizontal lines flanking "OR EDIT MANUALLY" eyebrow

3. **Source** — 6-card grid (Districts / Contacts / Opps / Vacancies / News / RFPs) with emoji icon, label, total count. Active card has coral border and `#FEF2F1` bg.

4. **Conditions** — flat list of AND'd rule rows. Each row:
   - `WHERE` / `AND` label (32px width, 10px uppercase, `#8A80A8`)
   - Field select · Op select · Value select · Trash button
   - Special **`any` rule kind** (AI-collapsed OR): renders as `is any of` + chip pills for each value with × delete
   - "+ Add condition" dashed button at the end

5. **Scope** (only for non-district sources): tab strip with 3 options:
   - "Any district" (no scope)
   - "Matching rules" — flat condition editor on district fields
   - "In a plan or list" — dropdown with all existing plans/lists prefixed by 🎯 or 📋; below the dropdown: "Updates automatically as {plan name} changes" hint

6. **Save as** — name input + "Share with my team" checkbox

**Right-side preview pane** (sticky):
- "Live preview" eyebrow + big 28px tabular-nums match count + "{source} match"
- If scope=reference: small "Scoped to {name}" callout
- Sample preview items (3 hard-coded per source)
- "+ N more" muted footer

**Modal footer**:
- Left: "{N} conditions · {N} {source}" muted text
- Right: "Cancel" secondary + "Create list" primary (plum, bookmark icon)

---

## Interactions & Behavior

### Navigation
- Click any plan/list group header → toggle expand/collapse (chevron rotates)
- Click any view inside an open group → set active view, render in canvas
- Click "All plans" → switch to portfolio view
- Click any portfolio card → navigate to that plan's default view

### Detail panel
- Click any row in any data view (table / map / kanban / contacts / opps / vacancies / news / rfps) → slide in the corresponding detail panel
- Click X in panel or click outside the panel → close
- Multiple clicks → panel re-renders with new entity (no transition between)

### Group context menu
- Hover any plan/list row → ⋯ button fades in on the right
- Click ⋯ → popover with actions
- Click "Hide from sidebar" → row disappears, footer shows "Show hidden (N)"
- Click "Archive plan" → row disappears, footer shows "Archived plans · N"
- Click "Show hidden (N)" → hidden items appear dashed-out with Unhide button; click again to re-hide

### List builder
- Open with no args → empty default conditions (single rule based on source)
- Open with `prefilledName` → name field pre-filled
- AI "Build" button → calls Claude API, parses returned JSON, flattens nested AND/OR trees:
  - Top-level AND → unwrap children
  - OR group of rules with same fieldId → collapse to single `{kind: 'any', fieldId, values: [...]}`
  - Anything more complex → emit amber notice
- "Add condition" → append default rule
- Trash button on any rule → remove from list
- "Create list" → adds new group to sidebar Lists section, opens it, makes it active

### Animations
- Panel slide-in: 250ms cubic-bezier(0.16, 1, 0.3, 1), translateX(20px → 0) + fade
- Modal: 150ms fade overlay + 200ms slide-up box
- Hover state transitions: 120ms ease-out on background/border
- Caret rotation: 150ms

---

## State Management

### App-level state (`UnifiedApp`)
- `groups` — array of `{ id, label, kind: 'plan' | 'list', ...kind-specific fields, views: [], archived?, hidden? }`
- `active` — `{ groupId, viewId | null }` (viewId null when portfolio is active; groupId `'__portfolio'`)
- `open` — `{ [groupId]: boolean }` map of which groups are expanded in sidebar
- `hoverId` — current hovered group/view id (for showing ⋯)
- `menuGroupId` — currently open context menu
- `showHidden` — boolean to reveal hidden items
- `showBuilder` — boolean for list builder modal
- `builderSeed` — `{ filters, name }` pre-fill data

### Action handlers
- `archiveGroup(id)` / `unarchiveGroup(id)` — toggle `archived` flag
- `hideGroup(id)` / `unhideGroup(id)` — toggle `hidden` flag
- `openBuilder(seed?)` — open list builder optionally pre-filled
- `handleCreateList(data)` — append new list group, set active

### List builder state (`ListBuilder`)
- `source`, `name`, `shared`
- `rules` — flat array of `{kind, fieldId, op, value}` or `{kind: 'any', fieldId, op, values}`
- `scopeMode` — `'none' | 'rules' | 'reference'`
- `scopeRules`, `scopeRef`
- `aiPrompt`, `aiBusy`, `aiError`, `aiNotice`

### Detail panel state (`CanvasBody`)
- `sel` — `{kind, id} | null`

The detail panel maps view types to entity kinds:
```
table | map | kanban → 'district'
contacts            → 'contact'
opps                → 'opp'
vacancies           → 'vacancy'
news                → 'news'
rfps                → 'rfp'
```

---

## Design Tokens

These all come from `design-system/colors_and_type.css`. Use the equivalent variables in Mapomatic's existing token system.

### Colors
- `--color-plum: #403770` — primary ink, primary buttons
- `--color-plum-dark: #322a5a` — hover on plum
- `--color-coral: #F37167` — accent, error
- `--color-steel-blue: #6EA3BE` — info accent
- `--color-robins-egg: #C4E7E6` — avatar bg, accent
- `--color-golden: #FFCF70` — warning
- `--color-mint: #EDFFE3` — success bg
- `--color-off-white: #FFFCFA` — page bg
- `--surface-raised: #F7F5FA` — table headers, raised surfaces
- `--surface-hover: #EFEDF5` — hover row tint
- `--border-subtle: #E2DEEC`, `--border-default: #D4CFE2`, `--border-strong: #C2BBD4`
- Foreground ladder: `#A69DC0` muted → `#8A80A8` secondary → `#6E6390` body → `#544A78` strong → `#403770` primary

### Spacing
4px grid: `4px, 6px, 8px, 12px, 16px, 20px, 24px, 32px`

### Typography
- Font: Plus Jakarta Sans (400 / 500 / 600 / 700)
- Sizes: 10px (micro/eyebrow), 12px (caption/label), 13px (table body), 14px (body/input), 18px (heading/H2), 20px (panel H1), 22px (portfolio H1)
- Numeric values: `font-variant-numeric: tabular-nums`
- Letter-spacing: `-0.01em` on H1/H2/display; `0.06em–0.08em` on uppercase eyebrows

### Radii
- 4px (small chip), 6px (button/row), 8px (card/select/modal section), 12px (popover), 16px (modal)
- 999px (pill / round)

### Shadows
- Resting card: `0 1px 2px rgba(64,55,112,0.05)`
- Hover card: `0 4px 6px -1px rgba(64,55,112,0.08)`
- Popover: `0 4px 12px rgba(64,55,112,0.12)`
- Modal: `0 24px 48px rgba(64,55,112,0.25)`
- Side panel: `-12px 0 32px rgba(64,55,112,0.08)`

---

## Backend / API Considerations

These are notes for the developer to discuss with the API team — they aren't built in the prototype.

### Plans
- New flags: `archived: boolean` (server-persisted, affects portfolio + sidebar visibility), `hidden_by_user: boolean` (per-user, hides from sidebar without affecting others)
- New computed fields for sidebar display: `progress` (0–100), `pipeline_value`, `contacts_count`, `opps_count`

### Lists
- New entity with: id, name, owner, source ('districts' | 'contacts' | 'opps' | 'vacancies' | 'news' | 'rfps'), filter_tree (JSON), scope_mode ('none' | 'rules' | 'reference'), scope_filter_tree, scope_ref_id, shared, created_at, updated_at
- Filter tree is a flat-AND model with optional `kind: 'any'` (multi-value OR collapse). Internal representation can stay tree-shaped for future flexibility — UI just renders flat.
- When `scope_mode === 'reference'`, list contents are live-derived through the referenced plan/list's district set. List membership updates automatically when the referenced set changes.

### AI list-builder endpoint
The prototype calls `window.claude.complete()` directly. In production, route through a backend endpoint:
- Input: { prompt, source_schema, existing_plans_and_lists }
- Output: structured list spec matching the schema in `list-builder.jsx`'s `runAi()` function
- The prompt template (in `list-builder.jsx`) is a good starting point — copy it.

### Entity detail panels
Each entity kind needs an API endpoint returning detail fields:
- `GET /districts/:id` — see `DistrictPanel` for fields
- `GET /contacts/:id` — see DetailPanel kind=contact
- `GET /opportunities/:id` — see DetailPanel kind=opp
- `GET /vacancies/:id` — see DetailPanel kind=vacancy
- `GET /news/:id` — see DetailPanel kind=news
- `GET /rfps/:id` — see DetailPanel kind=rfp

---

## Files in this Handoff

| File | Purpose |
|---|---|
| `index.html` | Entry point, loads all scripts and bootstraps the React app |
| `design-system/colors_and_type.css` | CSS variables for colors, typography, spacing — reference for token equivalents |
| `design-system/IconSystem.jsx` | Lucide-style icon components (currentColor stroke icons) |
| `design-system/Primitives.jsx` | Reusable atoms (Button, Input, Badge, Card, Stat, ProgressBar) |
| `app-shared.jsx` | Shared sample data + Map/Table/Kanban view bodies |
| `app-unified.jsx` | Main app: sidebar, group canvas, portfolio view, click-routing |
| `app-folk.jsx` | Source of secondary icons (pin, bookmark, table, kanban, share) re-exported as `Folk*` aliases. The Folk-faithful component itself isn't used — only its icon definitions are imported by the unified app. |
| `district-panel.jsx` | District detail right-side panel |
| `detail-panel.jsx` | Generic detail panel for contacts/opps/vacancies/news/rfps |
| `district-feeds.jsx` | Vacancies/News/RFPs view bodies with sample data |
| `list-builder.jsx` | List builder modal with AI prompt + flat condition editor |
| `tweaks-panel.jsx` | (Optional) demo Tweaks panel for density toggle — production app can ignore |

The prototype loads everything via `<script type="text/babel">` tags. In Mapomatic, each of these would be a properly-imported React module.

---

## Assets

No image assets are used. All icons are inline SVG (Lucide-style, 24×24 viewBox, 2px stroke, currentColor). All visuals (map, choropleth, pins) are SVG drawn at render time — replace with the real MapLibre integration in production.

The emoji used in section headers (🗺️ 👥 💼 👤 📰 📄 🎯 📋 ✨) should match Mapomatic's existing emoji or icon conventions — the prototype uses native emoji for speed; production may want Lucide equivalents.
