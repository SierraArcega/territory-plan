# Display Components Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a complete display component guide (9 files in `Display/` subfolder) documenting 8 display component categories with plum-derived token usage, following the same subfolder pattern as `Navigation/` and `Tables/`.

**Architecture:** Documentation-only deliverable (no code changes). Each component guide follows a shared structure referencing `_foundations.md` for common patterns (semantic colors, containers, number formatting, transitions). Component files define the abstract pattern first, then map to codebase implementations with TSX examples.

**Tech Stack:** Markdown documentation

**Spec:** `docs/superpowers/specs/2026-03-11-display-components-guide-design.md`

**Key Reference Files:**
- Token system: `Documentation/UI Framework/tokens.md`
- Navigation foundations (template): `Documentation/UI Framework/Components/Navigation/_foundations.md`
- Buttons guide (template for TSX examples + codebase table): `Documentation/UI Framework/Components/Navigation/buttons.md`
- Tables foundations (template): `Documentation/UI Framework/Components/Tables/_foundations.md`
- SignalBadge: `src/features/map/components/panels/district/signals/SignalBadge.tsx`
- PlanCard: `src/features/plans/components/PlanCard.tsx`
- ExploreKPICards: `src/features/map/components/explore/ExploreKPICards.tsx`
- LeadingIndicatorsPanel: `src/features/progress/components/LeadingIndicatorsPanel.tsx`
- GoalProgress: `src/features/goals/components/GoalProgress.tsx`
- MapV2Tooltip: `src/features/map/components/MapV2Tooltip.tsx`
- CalendarConnectBanner: `src/features/calendar/components/CalendarConnectBanner.tsx`
- SignalCard: `src/features/map/components/panels/district/signals/SignalCard.tsx`
- EnrollmentCard: `src/features/map/components/panels/district/EnrollmentCard.tsx`

**Parallelism:** Tasks 2–9 are independent of each other (all depend only on Task 1). Task 10 depends on all prior tasks.

---

## Chunk 1: Display Foundations + Component Files

> **Agentic workers — expansion rule:** Each task references a section of the spec. Read that section, then write the full markdown file with complete prose, tables, Tailwind class strings, and TSX code examples using the exact hex values from the spec. The spec is the authoritative source for all values.
>
> **Style rules:**
> - Open each file with `# Component Name` and a 1–2 sentence description
> - Include `See _foundations.md for ...` cross-reference where shared patterns apply
> - Every variant gets: class string, use case, TSX example
> - End each file with a `## Codebase Examples` table mapping components to files
> - No Tailwind grays (`gray-*`) anywhere — use plum-derived hex values only
> - Include `## Migration Notes` section at the end when the spec flags codebase deviations

### Task 1: Create Display/_foundations.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/_foundations.md`

**Dependencies:** None

- [ ] **Step 1: Create the Display/ directory**

```bash
mkdir -p "Documentation/UI Framework/Components/Display"
```

- [ ] **Step 2: Write _foundations.md**

Write the file with these sections, pulling all values from spec section "Display Foundations":

```markdown
# Display Component Foundations

Shared patterns for all display components. Every component guide in this folder
references these foundations. If a pattern is defined here, the component guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in display components.

---

## Semantic Color Application

[Table mapping Error/Warning/Success/Info to Badge fill, Badge text, Callout bg, Progress bar, Dot indicator — exact hex values from spec lines 46-51]

[Badge fill vs callout bg note from spec line 53]

[Display-specific text colors note from spec line 55 — document as tokens.md extensions]

---

## Display Container

[Standard card shell: bg-white rounded-lg border border-[#D4CFE2] shadow-sm]
[Note about correcting rounded-xl and border-gray-* drift]

---

## Status Dot

[Pattern: w-2 h-2 rounded-full flex-shrink-0]
[Color sourcing note]

---

## Number Formatting Conventions

[Table: null→"—", 1M+→"1.2M", 1K+→"12K", <1K→"1,234"]
[Currency variants]
[toLocaleString() and trailing .0 rules]

---

## Transition Timing

[Table: progress bar fill, tooltip enter/exit, skeleton pulse, color changes, expand/collapse]

---

## Disabled / Empty Pattern

[Stat: "—" in text-[#A69DC0]]
[Progress: empty track only]
[Badge: hide entirely]
```

- [ ] **Step 3: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/_foundations.md"`
Expected: No matches

- [ ] **Step 4: Spot-check token values**

Run: `grep -c "#fef1f0\|#EDFFE3\|#403770\|#EFEDF5\|#D4CFE2\|#A69DC0" "Documentation/UI Framework/Components/Display/_foundations.md"`
Expected: 6+ matches (each key token appears at least once)

- [ ] **Step 5: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/_foundations.md"
git commit -m "docs: add display component foundations"
```

---

### Task 2: Write badges.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/badges.md`

**Dependencies:** Task 1

**Reference:** Spec section "Badges (`badges.md`)" (lines 111-188)

- [ ] **Step 1: Write badges.md**

Write the file with these sections:

1. **Header** — `# Badges` + description + `See _foundations.md for semantic color palette and status dot pattern.`

2. **Signal Badges** section:
   - Base classes: `inline-flex items-center font-medium rounded-full`
   - Size variants table (Compact: `px-1.5 py-0.5 text-[10px]`, Normal: `px-2 py-0.5 text-xs`)
   - Colors table (Growing/Stable/At Risk/Declining with solid hex backgrounds from spec lines 130-133)
   - TSX example showing a signal badge with conditional color logic
   - Migration note: opacity-based fills → solid hex

3. **Status Badges** section:
   - Base classes: `inline-flex items-center px-2 py-0.5 text-xs font-semibold rounded-full`
   - Status table (Working/Planning/Stale/Archived from spec lines 147-150)
   - TSX example
   - Migration note: PlanCard gray-200 → `bg-[#F7F5FA] text-[#6E6390]`

4. **Count / Label Badges** section:
   - Classes from spec line 158
   - TSX example

5. **Recency Badges** section:
   - Base classes from spec line 166
   - Recency table (Active/Slowing/Stale/No activity from spec lines 170-173)
   - TSX example with dot + text
   - Migration note: inline styles with non-token colors → plum-derived
   - Migration note: CalendarSyncBadge uses `bg-green-400`/`bg-red-400` for status dots — migrate to plum-derived semantic colors (`bg-[#8AA891]` success, `bg-[#F37167]` error) per foundations semantic color table

6. **Codebase Examples** table from spec lines 181-187

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/badges.md"`
Expected: No matches (or only within Migration Notes section)

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/badges.md"
git commit -m "docs: add badge component guide"
```

---

### Task 3: Write stats.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/stats.md`

**Dependencies:** Task 1

**Reference:** Spec section "Stats / KPI Cards (`stats.md`)" (lines 191-251)

- [ ] **Step 1: Write stats.md**

Write the file with these sections:

1. **Header** — `# Stats / KPI Cards` + description + `See _foundations.md for number formatting conventions and display container.`

2. **KPI Card Grid** section:
   - Grid layout: `grid gap-4` + responsive column count table from spec lines 200-203
   - Individual card classes from spec line 208
   - Left accent bar: `absolute left-0 top-0 bottom-0 w-[3px]`
   - Typography specs (Label/Value/Subtitle from spec lines 214-216)
   - Accent color palette table from spec lines 220-226
   - TSX example showing a full KPI card with accent bar
   - Migration note: `border-gray-200` → `border-[#D4CFE2]`

3. **Stat with Trend Indicator** section:
   - Trend badge classes from spec line 234
   - Direction table (Up/Down/Flat from spec lines 238-240)
   - TSX example with SVG arrow + percentage

4. **Codebase Examples** table from spec lines 244-250

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/stats.md"`
Expected: No matches (or only within Migration Notes section)

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/stats.md"
git commit -m "docs: add stats/KPI component guide"
```

---

### Task 4: Write progress.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/progress.md`

**Dependencies:** Task 1

**Reference:** Spec section "Progress Bars (`progress.md`)" (lines 254-301)

- [ ] **Step 1: Write progress.md**

Write the file with these sections:

1. **Header** — `# Progress Bars` + description + `See _foundations.md for transition timing.`

2. **Standard Progress Bar** section:
   - Track: `h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden`
   - Fill: `h-full rounded-full transition-all duration-500`
   - Default fill: `bg-[#403770]`
   - TSX example

3. **Goal Progress Bar** section:
   - Track: `h-2 bg-[#EFEDF5] rounded-full overflow-hidden`
   - Threshold table (100%+/75-99%/50-74%/<50% from spec lines 276-279)
   - Status indicator: `flex items-center gap-1.5 text-xs`
   - TSX example with threshold logic and status indicator

4. **Label Row** section:
   - Layout: `flex items-center justify-between`
   - Left label: `text-xs text-[#8A80A8] font-medium`
   - Right value: `text-xs font-medium` with dynamic color
   - TSX example

5. **Codebase Examples** table from spec lines 296-301

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/progress.md"`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/progress.md"
git commit -m "docs: add progress bar component guide"
```

---

### Task 5: Write loading.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/loading.md`

**Dependencies:** Task 1

**Reference:** Spec section "Loading / Skeletons (`loading.md`)" (lines 305-341)

- [ ] **Step 1: Write loading.md**

Write the file with these sections:

1. **Header** — `# Loading / Skeletons` + description + `See _foundations.md for transition timing (animate-pulse).`

2. **Skeleton Cards** section:
   - Skeleton bar classes: `bg-[#EFEDF5] rounded animate-pulse`
   - Standard sizes table (Label/Value/Subtitle from spec lines 317-319)
   - Card shell: display container + `p-4 gap-2.5`
   - Grid matching rule
   - TSX example showing 3 skeleton cards in a grid

3. **Inline Spinner** section:
   - Classes from spec line 329
   - `border-current` note
   - TSX example

4. **Migration Notes** section:
   - Skeleton patterns in LeadingIndicatorsPanel and ExploreKPICards should use `bg-[#EFEDF5]` instead of Tailwind grays for skeleton bar fills

5. **Codebase Examples** table from spec lines 338-341

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/loading.md"`
Expected: No matches (or only within Migration Notes section)

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/loading.md"
git commit -m "docs: add loading/skeleton component guide"
```

---

### Task 6: Write tooltips.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/tooltips.md`

**Dependencies:** Task 1

**Reference:** Spec section "Tooltips (`tooltips.md`)" (lines 345-395)

- [ ] **Step 1: Write tooltips.md**

Write the file with these sections:

1. **Header** — `# Tooltips` + description + `See _foundations.md for transition timing (tooltip-enter/tooltip-exit).`

2. **Map Tooltip (Rich)** section:
   - Container classes from spec lines 354-356
   - z-20 justification note from spec lines 359
   - Positioning rule from spec line 363
   - Typography specs (entity name/metadata/category label from spec lines 366-368)
   - Divider: `border-t border-[#E2DEEC]`
   - Category indicator: status dot + label
   - Animation reference
   - TSX example
   - Migration note: `z-[15]` → `z-20`

3. **Simple Tooltip (Dark)** section:
   - Container from spec lines 383
   - Text: `text-xs font-medium text-white`
   - Positioning note
   - TSX example

4. **Accessibility** — `role="tooltip"`, `aria-describedby` note from spec line 464

5. **Codebase Examples** table from spec lines 392-395

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/tooltips.md"`
Expected: No matches (or only within Migration Notes section)

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/tooltips.md"
git commit -m "docs: add tooltip component guide"
```

---

### Task 7: Write empty-states.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/empty-states.md`

**Dependencies:** Task 1

**Reference:** Spec section "Empty States (`empty-states.md`)" (lines 399-433)

- [ ] **Step 1: Write empty-states.md**

Write the file with these sections:

1. **Header** — `# Empty States` + description + `See _foundations.md for disabled/empty pattern.`

2. **Full-Page Empty State** section:
   - Container: `flex flex-col items-center justify-center gap-3 py-10`
   - Icon: `w-10 h-10` stroke, `text-[#C2BBD4]`, `strokeWidth={1.5}`
   - Heading: `text-sm font-semibold text-[#6E6390]`
   - Description: `text-xs text-[#A69DC0] text-center max-w-[280px]`
   - CTA: reference `Navigation/buttons.md` primary button
   - TSX example showing "No plans yet" with CTA

3. **Card Inline Empty State** section:
   - Text: `text-lg text-[#A69DC0]` centered
   - Examples list
   - No CTA note
   - TSX example

4. **Codebase Examples** table from spec lines 427-433

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/empty-states.md"`
Expected: No matches

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/empty-states.md"
git commit -m "docs: add empty states component guide"
```

---

### Task 8: Write callouts.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/callouts.md`

**Dependencies:** Task 1

**Reference:** Spec section "Callouts / Banners (`callouts.md`)" (lines 437-490)

- [ ] **Step 1: Write callouts.md**

Write the file with these sections:

1. **Header** — `# Callouts / Banners` + description + `See _foundations.md for semantic color palette.`

2. **Promotional Banner** section:
   - Container classes from spec lines 446-447
   - `rounded-xl` justification note
   - Icon container from spec line 452
   - Typography (title/description from spec lines 454-456)
   - CTA button classes from spec line 458
   - Dismiss button classes from spec line 460 (with focus ring)
   - TSX example

3. **Semantic Callout** section:
   - Container: `flex items-start gap-3 px-4 py-3.5 rounded-lg border`
   - Icon sizing from spec line 472
   - Semantic colors table from spec lines 476-479
   - Title: `text-[13px] font-semibold`
   - Description: `text-xs text-[#6E6390]`
   - TSX example showing an info callout

4. **Accessibility** section:
   - Focus ring on dismiss buttons (reference `Navigation/_foundations.md`)
   - `role="alert"` for error/warning, `role="status"` for info/success

5. **Codebase Examples** table from spec lines 488-490

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/callouts.md"`
Expected: No matches (or only within Migration Notes section)

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/callouts.md"
git commit -m "docs: add callout/banner component guide"
```

---

### Task 9: Write cards.md

**Files:**
- Create: `Documentation/UI Framework/Components/Display/cards.md`

**Dependencies:** Task 1

**Reference:** Spec section "Cards (`cards.md`)" (lines 494-561)

- [ ] **Step 1: Write cards.md**

Write the file with these sections:

1. **Header** — `# Cards` + description noting this covers **card content patterns** + `For the card shell itself, see Containers/card.md.`

2. **Card Shell (Base)** section:
   - Quick reference: `bg-white rounded-lg border border-[#D4CFE2] shadow-sm overflow-hidden`
   - `rounded-lg` vs `rounded-xl` note from spec line 506

3. **Metric Card** section:
   - Header: `flex items-center justify-between px-4 py-3 border-b border-[#E2DEEC]`
   - Title/badge specs from spec lines 513-514
   - Body: value `text-2xl font-bold text-[#403770]` + context `text-xs text-[#8A80A8]`
   - TSX example

4. **Content Card** section:
   - Body layout with badge row, title, metadata
   - Embedded progress reference to `progress.md`
   - TSX example

5. **Expandable Card** section:
   - Expand trigger classes from spec line 535 (including focus ring)
   - Chevron: `w-3 h-3 transition-transform duration-150`
   - Detail section: `px-4 pb-3 border-t border-[#E2DEEC]`
   - Detail rows: `flex justify-between text-sm`
   - TSX example with expand/collapse state

6. **Migration Notes** section:
   - LeadingIndicatorsPanel, LaggingIndicatorsPanel, and SignalCard use `rounded-xl` on card shells — standard cards should use `rounded-lg` per foundations
   - `border-gray-100`/`border-gray-200` in metric cards → `border-[#D4CFE2]`

7. **Codebase Examples** table from spec lines 552-560

- [ ] **Step 2: Verify no Tailwind grays**

Run: `grep -i "gray-" "Documentation/UI Framework/Components/Display/cards.md"`
Expected: No matches (or only within Migration Notes section)

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Display/cards.md"
git commit -m "docs: add card content patterns guide"
```

---

### Task 10: Final verification and commit

**Files:**
- Verify all: `Documentation/UI Framework/Components/Display/*.md`

**Dependencies:** Tasks 1–9

- [ ] **Step 1: Verify all 9 files exist**

```bash
ls -la "Documentation/UI Framework/Components/Display/"
```

Expected: `_foundations.md`, `badges.md`, `stats.md`, `progress.md`, `loading.md`, `tooltips.md`, `empty-states.md`, `callouts.md`, `cards.md`

- [ ] **Step 2: Verify no Tailwind grays outside Migration Notes**

```bash
grep -rn "gray-" "Documentation/UI Framework/Components/Display/" | grep -v "Migration"
```

Expected: No matches

- [ ] **Step 3: Verify all files reference _foundations.md**

```bash
grep -l "_foundations.md" "Documentation/UI Framework/Components/Display/"*.md | wc -l
```

Expected: 8 (all component files except _foundations.md itself)

- [ ] **Step 4: Verify all files have Codebase Examples section**

```bash
grep -l "Codebase Examples" "Documentation/UI Framework/Components/Display/"*.md | wc -l
```

Expected: 8 (all component files)

- [ ] **Step 5: Verify migration notes coverage**

Check that files with migration notes cover all 8 spec migration items (spec lines 568-577):

```bash
grep -l "Migration" "Documentation/UI Framework/Components/Display/"*.md | wc -l
```

Expected: 5+ files (badges, stats, loading, tooltips, cards should each have Migration Notes sections)

Cross-check the following migration items are addressed somewhere across the component files:
1. `gray-*` classes in ExploreKPICards, LeadingIndicatorsPanel, CalendarSyncBadge
2. `rounded-xl` on standard card shells (LeadingIndicatorsPanel, LaggingIndicatorsPanel, SignalCard)
3. `border-gray-100`/`border-gray-200` → `border-[#D4CFE2]`
4. `bg-green-400`/`bg-red-400` status dots → plum-derived semantic colors
5. Inline styles with non-token colors → plum-derived tokens
6. Non-token recency badge colors → semantic palette
7. `bg-gray-200 text-gray-700` Planning status → `bg-[#F7F5FA] text-[#6E6390]`
8. `z-[15]` → `z-20` for map tooltips
