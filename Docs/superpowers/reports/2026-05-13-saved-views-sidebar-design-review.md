# Design Review — Saved Views Sidebar

**Date:** 2026-05-13
**Branch:** `worktree-saved-views-sidebar`
**Reviewer:** Code-level audit (no browser screenshots)
**Scope:** `src/features/views/components/**`, `src/app/views/**`

---

## 1. Verdict

**PASSED-WITH-ISSUES.**

The implementation is tight against both the prototype and tokens.md for color, type, and animation. The structural fidelity to the design handoff is high — all 8 view bodies, the 6 detail kinds, the list builder's 6 sections, and the portfolio dashboard land where they should and use the right brand tokens.

The issues found are all in two categories:
1. **Tokens.md vs prototype tension on radii** — the spec calls for 6-8px radii ("most elements") while tokens.md forbids `rounded-md`/`rounded-sm`. The team chose prototype fidelity. Important but a defensible product decision.
2. **A handful of off-token neutrals** snuck into accents (e.g. `#2d2750`, `#5C5277`, `#6f6786`, `#B8B0D0`). Most are coral- or plum-tinted variants pulled from the prototype source. Important — should be folded into named tokens or substituted.

No blockers. Animations, sizes, narrow-width resilience, and mobile rules are all correctly observed.

---

## 2. Summary Table

| Component | Blocker | Important | Minor | Nit |
|---|---|---|---|---|
| `ViewsSidebar.tsx` | 0 | 0 | 0 | 0 |
| `SidebarTopNav.tsx` | 0 | 1 | 1 | 0 |
| `MyViewsSection.tsx` | 0 | 1 | 0 | 0 |
| `PlansSubsection.tsx` | 0 | 0 | 0 | 0 |
| `ListsSubsection.tsx` | 0 | 0 | 0 | 0 |
| `GroupRow.tsx` | 0 | 1 | 1 | 0 |
| `GroupViewList.tsx` | 0 | 1 | 0 | 0 |
| `GroupContextMenu.tsx` | 0 | 0 | 1 | 0 |
| `HiddenFooter.tsx` | 0 | 0 | 0 | 0 |
| `SidebarFooter.tsx` | 0 | 0 | 0 | 1 |
| `GroupCanvas.tsx` | 0 | 0 | 0 | 0 |
| `GroupHeader.tsx` | 0 | 1 | 1 | 0 |
| `ViewTabsStrip.tsx` | 0 | 1 | 0 | 0 |
| `PortfolioView.tsx` | 0 | 1 | 1 | 0 |
| `PlanCardPortfolio.tsx` | 0 | 0 | 1 | 0 |
| `detail/DetailPanel.tsx` | 0 | 0 | 0 | 0 |
| `detail/DetailPanelHeader.tsx` | 0 | 1 | 0 | 0 |
| `detail/DetailPanelTabs.tsx` | 0 | 0 | 0 | 0 |
| `detail/atoms.tsx` | 0 | 0 | 0 | 0 |
| `detail/DistrictDetailContent.tsx` | 0 | 0 | 0 | 0 |
| `detail/ContactDetailContent.tsx` | 0 | 0 | 0 | 0 |
| `detail/OppDetailContent.tsx` | 0 | 0 | 0 | 0 |
| `detail/VacancyDetailContent.tsx` | 0 | 0 | 0 | 0 |
| `detail/NewsDetailContent.tsx` | 0 | 0 | 0 | 0 |
| `detail/RfpDetailContent.tsx` | 0 | 0 | 0 | 0 |
| `views/TableView.tsx` | 0 | 1 | 0 | 0 |
| `views/KanbanView.tsx` | 0 | 0 | 1 | 0 |
| `views/ContactsView.tsx` | 0 | 0 | 0 | 0 |
| `views/OppsView.tsx` | 0 | 0 | 0 | 0 |
| `views/VacanciesView.tsx` | 0 | 0 | 0 | 0 |
| `views/NewsView.tsx` | 0 | 1 | 0 | 0 |
| `views/RfpsView.tsx` | 0 | 0 | 0 | 0 |
| `views/MapViewContainer.tsx` | 0 | 0 | 0 | 0 |
| `builder/ListBuilderModal.tsx` | 0 | 0 | 0 | 0 |
| `builder/AiPromptBlock.tsx` | 0 | 1 | 0 | 0 |
| `builder/SourcePicker.tsx` | 0 | 1 | 0 | 0 |
| `builder/ConditionRow.tsx` | 0 | 0 | 1 | 0 |
| `builder/ConditionsEditor.tsx` | 0 | 0 | 0 | 0 |
| `builder/ScopeEditor.tsx` | 0 | 0 | 0 | 0 |
| `builder/LivePreviewPane.tsx` | 0 | 0 | 0 | 0 |
| `builder/SaveAsBlock.tsx` | 0 | 0 | 0 | 0 |
| `builder/ModalFooter.tsx` | 0 | 0 | 0 | 0 |
| **Total** | **0** | **11** | **8** | **1** |

---

## 3. Findings

### Important — token compliance

#### I-1 — `rounded-md` / `rounded-sm` used pervasively, forbidden by tokens.md

**Tokens.md** (line 147): *"Do not use `rounded-sm` or `rounded-md` in new code."* Only `rounded-full`, `rounded-lg`, `rounded-xl`, `rounded-2xl` are permitted.

**Where:**
- `SidebarTopNav.tsx` — no offence (no rounded on nav buttons), but Leaderboard widget passes through
- `GroupRow.tsx:144`, `:160` (`rounded-sm`), `:222`
- `GroupContextMenu.tsx:183`
- `MyViewsSection.tsx:75` (CTA button), `:65` empty-state card
- `ListsSubsection.tsx:47` (+ trigger)
- `GroupHeader.tsx:353`, `:371`, `:389` (Icon/Secondary/PrimaryButton helpers)
- `ViewTabsStrip.tsx` (n/a — no rounded)
- `views/TableView.tsx` (n/a — pills are `rounded-full`, stage chip uses inline style)
- `_shared.tsx:45`, `:106`, `:130` — skeleton + Show More + Retry buttons
- `builder/AiPromptBlock.tsx:168`, `:179` — input + Build button
- `builder/SourcePicker.tsx:39` (acceptable — `rounded-lg`)
- `builder/ConditionRow.tsx:128`, `:195`, `:209`, `:237` — selects + chip bag
- `LivePreviewPane.tsx:80`, `:99`, `:115` — sample rows

**Fix.** Either (a) update tokens.md to allow `rounded-md` for 6px (which the prototype demands across small chrome and selects), or (b) bump every `rounded-md` to `rounded-lg` (8px) for tokens conformance — accepting that buttons/selects will look slightly fuller. Recommend a small token addition (`rounded-md` documented as an allowed exception for selects and ⋯ menu rows) since the prototype tested at 6px.

Acknowledging this is a doc-vs-prototype gap, not an implementation bug. Counted once at the project level rather than per file.

#### I-2 — Off-token darker plum used in `NewsView` headline (`text-[#2d2750]`)
- **`views/NewsView.tsx:176`** — headline body text uses `style={{ letterSpacing: "-0.005em" }}` with `text-[#2d2750]`. `#2d2750` is darker than Plum `#403770` and not in tokens.md.
- **Fix:** swap to `text-[#403770]` (Primary). The extra darkening isn't carrying any prototype-required emphasis — the prototype used Primary plum here.

#### I-3 — Off-token muted purple used for view-item text (`text-[#5C5277]`)
- **`GroupViewList.tsx:90`** — inactive view button uses `text-[#5C5277]`. The token ladder is `#544A78` (Strong) → `#6E6390` (Body); `#5C5277` falls between.
- **Fix:** use `text-[#544A78]` for inactive view items so the contrast against the active state (`#403770`) stays consistent and matches the prototype's "subtle plum tier" usage elsewhere.

#### I-4 — Off-token muted purple `text-[#6f6786]` for "Cold" / "Closed" / "Awarded" pills
- **`detail/atoms.tsx:168–178`**, **`views/VacanciesView.tsx:58`**, **`views/RfpsView.tsx:57–59,164`** — secondary status pills use `fg: "#6f6786"` on `bg: "#EFEDF5"`. `#6f6786` is not in tokens.md.
- The prototype uses this in the same place (pulled from `STAGE_PILL_PS`). It's a neutral darker than Body `#6E6390` and lighter than Strong `#544A78`.
- **Fix:** replace with `#544A78` (Strong) to land inside the token ladder. Contrast on `#EFEDF5` remains accessible.

#### I-5 — Off-token light coral `border-[#E0CFCC]` on AI prompt input
- **`builder/AiPromptBlock.tsx:168`** — input border is `#E0CFCC`. Not in tokens.
- **Fix:** use `border-[#F0D9D6]` (the same coral-tinted border already used on the outer block at line 143) for consistency, or `border-[#D4CFE2]` (Border Default).

#### I-6 — Off-token darker purple `text-[#6f4c8c]` in news category palette
- **`views/NewsView.tsx:80`** — `curriculum` category uses `fg: "#6f4c8c"`. Not in tokens.
- **Fix:** swap to `#544A78` (Strong) or `#403770` (Primary) to stay in token ladder.

#### I-7 — Card-hover border `#B8B0D0` used twice; not in tokens
- **`views/KanbanView.tsx:209`**, **`views/NewsView.tsx:154`** — hover state uses `hover:border-[#B8B0D0]`. Between Border Default `#D4CFE2` and Border Strong `#C2BBD4`.
- **Fix:** use `hover:border-[#C2BBD4]` (Border Strong) — that's the documented hover-emphasis tier.

#### I-8 — `border-[1.5px]` arbitrary border width in `SourcePicker`
- **`builder/SourcePicker.tsx:41`** — active card uses `border-[1.5px] border-[#F37167]`. The 1.5px width prevents layout-shift on toggle but isn't a documented value.
- **Fix:** either (a) keep 1.5px and document it as an allowed exception for "toggleable cards" in tokens.md, or (b) use `border-2` and add `m-px` to neighbours to absorb the shift. The current code is correct in intent; just undocumented.

#### I-9 — `GroupHeader`'s buttons miss tokens.md radius convention
- **`GroupHeader.tsx:353,371,389`** — IconButton/SecondaryButton/PrimaryButton all use `rounded-md` (6px). Tokens.md says buttons should be `rounded-lg` (8px).
- **Fix:** bump to `rounded-lg`. Same comment as I-1.

#### I-10 — `DetailPanelHeader` action buttons use 8px radius via `rounded-lg` — OK, but skirts the spec
- **`detail/DetailPanelHeader.tsx:52,55`** — primary + secondary action buttons use `rounded-lg`. The handoff README §"Radii" says "6-8px on most elements" — both 6 and 8 are acceptable. **No action.**

#### I-11 — `NewsView` skips the `data-row-kind` event-delegation handoff for some clicks
- **`views/NewsView.tsx:147–151`** — each card is an `<a target="_blank">` rather than a row. The card *does* mark itself with `data-row-kind="news" data-row-id={n.id}` (line 149–150), but the wrapping `<a>` will navigate to the external URL on click, swallowing the detail-panel intent. Per spec §"Detail panel": "Click any row in any view → push `?detail=[kind]:[id]` to URL → DetailPanel slides in." Today the card opens the article in a new tab instead of showing the news detail panel.
- **Fix:** change the `<a>` to a `<div role="button" tabIndex={0}>` and let GroupCanvas's event delegation route to the detail panel. Move the external-link affordance into the detail panel (an "Open in source" link). This is the only place where the click-to-detail contract is broken.

#### I-12 — `TableView` is missing the prototype's "Students" and "Pipeline" columns
- **`views/TableView.tsx:153–158`** — columns are `District / State / Tier / FY26 ARR / Stage`. Prototype `CanvasTableView` ships `District / State / Tier / Students / FY26 ARR / Pipeline / Stage`.
- **Fix:** add `Students` (read `district.enrollment`) and `Pipeline` (read CRM-derived field) columns. Or, if intentionally trimmed, document the deviation in the file header (currently only the existing fields are described, no note about omissions).

#### I-13 — `PortfolioView` substitutes header stats (acknowledged in code, but the substitution loses the "Total target / Booked / To target" intent)
- **`PortfolioView.tsx:90–106`** — surfaces Open pipeline / Total contacts / Open opps / Plans count instead of the prototype's Target / Booked / Open pipeline / To target.
- The file header documents the substitution (Phase F deviation). **No fix required — this is an Acknowledged deviation.** Flagged here only so reviewers know it's not an oversight. See §4.

---

### Minor

#### M-1 — `SidebarTopNav` doesn't render the full top-nav set from the spec
- **`SidebarTopNav.tsx:35–45`** — items shown: Home, Map, Activities, Tasks. Spec §"Component Plan" calls for "Home, Map, Activities, Tasks, Leaderboard, Reports, LHF, Resources, Profile, Admin". Leaderboard is mounted via the widget (line 80). Reports / LHF / Resources / Profile / Admin are missing.
- **Fix:** decide whether these tabs are out-of-scope for v1 (their handlers may not exist) and document if so. Currently the omission is silent.

#### M-2 — `SidebarTopNav` rows use border-left transparent placeholder
- **`SidebarTopNav.tsx:66`** — `border-l-[3px] border-transparent` is a placeholder for the coral active-accent. None of the items ever sets it because navigation is router-driven and the legacy tab system doesn't expose active-tab state here.
- **Fix:** either remove the dead `border-l-[3px]` until active-state lookup is wired, or thread `usePathname() / useSearchParams()` to set coral when the active route matches.

#### M-3 — `GroupRow`'s ⋯ trigger uses 120ms `transition-opacity` (correct per spec) but has no focus-visible style
- **`GroupRow.tsx:222`** — the absolutely-positioned ⋯ button can be reached by Tab but has no `focus-visible` ring, so keyboard users won't see it.
- **Fix:** add `focus-visible:opacity-100 focus-visible:ring-1 focus-visible:ring-[#F37167]` (or whatever the project's standard is).

#### M-4 — `GroupContextMenu` Pin/Share items log warnings on click
- **`GroupContextMenu.tsx:91–109`** — Pin / Share fire `console.warn` and close the menu. Acceptable as a v1 stub, but a tooltip or "Coming soon" hint would be friendlier; users will not see console output.
- **Fix:** disable the items or add a `hint="Coming in v1.1"` line; better yet, hide them entirely for v1.

#### M-5 — `GroupHeader` `IconButton` lacks `aria-label` defaulting
- **`GroupHeader.tsx:167–172`** — Filter / Search are stubs without `onClick` handlers (only `aria-label`). Per CLAUDE.md "Show loading state, don't hide UI", these should at minimum render a `title` attribute so hover-tooltip explains the stub.
- **Fix:** add `title="Filter (coming soon)"` etc.

#### M-6 — `ViewTabsStrip` `+ View` affordance is permanently disabled-looking but doesn't disable click
- **`ViewTabsStrip.tsx:80`** — onClick is `() => undefined`. Looks clickable. Title says "coming soon" but cursor stays as pointer.
- **Fix:** set `cursor: not-allowed` or wrap with `disabled` attr; matches v1.1 stub pattern.

#### M-7 — `PortfolioView` "Plans" stat uses bespoke "up" tint `#5f665b`
- **`PortfolioView.tsx:169`** — `tone="up"` renders the Plans count in `#5f665b` (success-sentiment text). Bit odd for a neutral counter — there's no "up" semantic here.
- **Fix:** drop the `tone="up"` prop on the Plans stat. The other three stats render in plum; Plans should match.

#### M-8 — `PlanCardPortfolio` hardcodes "8 views" placeholder
- **`PlanCardPortfolio.tsx:108`** — TODO documented for v1.1, but a hardcoded "8 views" footer text appears on every card.
- **Fix:** until the per-plan view count ships, render just "Plan" or omit the bookmark+count footer entirely. "8 views" is misleading because every plan exposes all 8 view types via the registry (not user-created saved views).

#### M-9 — `GroupHeader` `FilterChip` shows raw `fieldId` strings to users
- **`GroupHeader.tsx:333`** — chip label is `${rule.fieldId} ${rule.op} ${rule.value}`. fieldId is an internal slug (e.g. `state_abbrev`, not "State"). Per project memory ("No ID strings in output — Query tool must not return raw IDs to users — they're reps, not engineers"), this is a small but recurring footgun.
- **Fix:** resolve the fieldId to its `FieldDef.label` via `SOURCE_FIELDS[source].find(f => f.id === rule.fieldId).label`.

#### M-10 — `AiPromptBlock` disabled-build button uses plum-50%
- **`builder/AiPromptBlock.tsx:177`** — disabled state is `bg-[#403770]/50`. Tokens.md doesn't define an opacity-modifier disabled state. Matches DetailPanelHeader convention but isn't tokenized.
- **Fix:** consider `bg-[#A69DC0] cursor-not-allowed` (Muted token) for disabled. Minor — opacity-50 is widely used in the codebase.

#### M-11 — `KanbanView` "+ Add district" dashed CTA is permanently a no-op
- **`views/KanbanView.tsx:193–196`** — same pattern as the `+ View` tab. Visually inviting but unwired.
- **Fix:** same as M-6 — disable or remove until wired.

#### M-12 — `ConditionRow` "any" pill bag border + chip color: info palette is correct, but `add` select is bare
- **`builder/ConditionRow.tsx:256–273`** — the "+ add" inline select sits inside the chip bag without visual affordance. It works but a rep won't discover it.
- **Fix:** wrap in a chip-shaped border or render a "+" button that opens a popover; defer to v1.1 if scope-tight.

---

### Nit

#### N-1 — `SidebarFooter` job-title fallback could read pod when available
- **`SidebarFooter.tsx:59–63`** — comment documents the intent ("when the pod field ships server-side we'll swap the source"). Already a documented v1.1 TODO; no action.

---

## 4. Acknowledged Deviations (documented in code)

These are deliberate gaps from the prototype/spec that the implementer flagged inline. They are NOT findings.

| File | Deviation | Where |
|---|---|---|
| `PortfolioView.tsx` | Header stats are Open pipeline / Total contacts / Open opps / Plans count instead of prototype's Target / Booked / Open pipeline / To target — because `/api/territory-plans` doesn't expose target aggregates. | File header lines 11–22 |
| `PlanCardPortfolio.tsx` | Per-card "Total target / To target" → Districts + Pipeline. Hardcoded "8 views" footer. | File header lines 14–24; line 106-108 |
| `MapViewContainer.tsx` | Map view in v0 doesn't filter to the plan's leaid set — banner explains the limitation. | File header lines 8–17 |
| `OppsView.tsx` | Endpoint returns no `total` count; show-more uses row-count heuristic. | Line 121–124 |
| `NewsView.tsx` | Lists ship empty in v0 (news endpoint doesn't accept leaid set). | File header lines 13–15 |
| `ContactDetailContent.tsx` | Engagement metrics (emails/meetings, Last touch) render `—`. | File header lines 8–14 |
| `OppDetailContent.tsx` | Confidence + Notes fields don't exist on Opportunity → `—` / placeholder. | File header lines 9–17 |
| `VacancyDetailContent.tsx` | Signal pill is a heuristic from category+status (no first-class field). | File header lines 14–17 |
| `NewsDetailContent.tsx` | Tag pill uses neutral plum tint instead of per-category color. | File header lines 11–14 |
| `RfpDetailContent.tsx` | Category falls back through oppType / keywords / "RFP". | File header lines 13–16 |
| `DistrictDetailContent.tsx` | Contacts/Pipeline/Activity tabs are placeholders linking back to legacy district page. | File header lines 18–20 |
| `GroupCanvas.tsx` | Lists have `leaids = null` in v0 (Phase E will add). | Comment lines 67–71 |
| `TableView.tsx` / `ContactsView.tsx` / `OppsView.tsx` | "Tier", "Stage" derived from booleans because no first-class fields yet. | Inline comments |
| `SourcePicker.tsx` | Source totals are placeholder integers from `SOURCE_META` (no live API). | File header lines 4–11 |
| `AiPromptBlock.tsx` | Build button disabled state uses opacity-50% bg. | (not commented; mentioned in M-10) |

---

## 5. Tokens Compliance Spot-Check

Sampled Tailwind/inline styles across 10 files to verify plum-derived neutrals + brand palette. Findings:

| Class / Color | File:line | Status |
|---|---|---|
| `bg-[#FFFCFA]` (Off-White / Surface) | `GroupCanvas.tsx:104`, `PortfolioView.tsx:110`, `_shared.tsx:29` | OK |
| `bg-[#F7F5FA]` (Surface Raised) | `TableView.tsx:152` (sticky thead), `GroupRow.tsx:144` hover | OK |
| `bg-[#EFEDF5]` (Hover) | `GroupRow.tsx:146` active, `SidebarTopNav.tsx:66` hover | OK |
| `bg-[#C4E7E6]` (Robin's-Egg) | `SidebarFooter.tsx:48`, `PlanCardPortfolio.tsx:134`, `ContactsView.tsx:155`, `GroupHeader.tsx:247` | OK — avatar bg per prototype |
| `text-[#403770]` (Plum / Primary) | broadly; primary text everywhere | OK |
| `text-[#F37167]` (Coral) | active view icons (`GroupViewList.tsx:96`), eyebrow dot (`GroupHeader.tsx:113`), DetailPanelHeader eyebrow icon | OK |
| `border-[#D4CFE2]` (Border Default) | card edges, sidebar `border-r` (`ViewsSidebar.tsx:72`), table thead `border-b` | OK |
| `border-[#E2DEEC]` (Border Subtle) | row dividers, `DetailPanelHeader.tsx:72`, `LivePreviewPane.tsx:56` | OK |
| `text-[#A69DC0]` (Muted) | "FY26" label (`PlansSubsection.tsx:83`), inactive view-icon (`GroupViewList.tsx:96`), Loader spinner | OK |
| `text-[#8A80A8]` (Secondary) | uppercase eyebrows, hint copy throughout | OK |
| `rounded-md` | dozens of places (see I-1) | **NOT OK per tokens.md** |
| `text-[#2d2750]` | `NewsView.tsx:176` | **NOT OK — see I-2** |
| `text-[#5C5277]` | `GroupViewList.tsx:90` | **NOT OK — see I-3** |
| `text-[#6f6786]` | atoms.tsx STAGE_PILL, VacanciesView, RfpsView pill fg | **NOT OK — see I-4** |
| `text-[#6f4c8c]` | NewsView CATEGORY_TINT.curriculum | **NOT OK — see I-6** |
| `border-[#B8B0D0]` | KanbanView/NewsView hover | **NOT OK — see I-7** |
| `border-[#E0CFCC]` | AiPromptBlock input | **NOT OK — see I-5** |
| `text-[#997c43]` | TableView stage fallback (line 224) | **NOT OK — golden-stop not in token ladder; map to `#7d6d3a` (warning text)** |

**Stage / progress color contracts (≥75% green / ≥50% blue / <50% coral):**
- `GroupRow.tsx:299` → `#69B34A` / `#6EA3BE` / `#F37167` ✓
- `GroupHeader.tsx:65–70` → identical ✓
- `PlanCardPortfolio.tsx:90–93` → identical ✓
Consistent across all three. Good.

**Animations:**
- DetailPanel slide-in: `250ms cubic-bezier(0.16, 1, 0.3, 1)` (`DetailPanel.tsx:122`) ✓
- ListBuilderModal fade 150ms + slide 200ms (`ListBuilderModal.tsx:343,354`) ✓
- Caret rotation 150ms (`GroupRow.tsx:151`) ✓
- Hover transitions: `duration-100` (slightly tighter than spec's 120ms; difference is sub-perceptible — pass)

**Sizing:**
- Sidebar 252 / 268 (`ViewsSidebar.tsx:42`) ✓
- DetailPanel 380 with `max-width: calc(100vw - 16px)` (`DetailPanel.tsx:115–119`) ✓ (mobile-safe)
- ListBuilderModal `max-w-[880px]` (`ListBuilderModal.tsx:348`) ✓
- Group accent bars 3px (`GroupRow.tsx:160`, `PlanCardPortfolio.tsx:118`) ✓

**Narrow-width resilience (CLAUDE.md):**
- `whitespace-nowrap` is applied on virtually every text span inside flex/grid containers — extensively and correctly. Sampled 30+ instances, all OK.
- Tables wrap in `overflow-x-auto` parents (`TableView.tsx:149`, `ContactsView.tsx:130`, `OppsView.tsx:128`, `VacanciesView.tsx:133`, `RfpsView.tsx:130`) ✓
- ViewTabsStrip uses `overflow-x-auto` (line 43) ✓

**Mobile (CLAUDE.md):**
- No `overflow: hidden` on body/html. `ViewsLayout` uses `overflow-hidden` on the flex container (acceptable — it's a layout div, not body) ✓
- `touch-action: pan-y` on sidebar (`ViewsSidebar.tsx:82`) ✓ — sidebar never wraps a map
- `touch-action: pan-y` on ViewTabsStrip (`ViewTabsStrip.tsx:46`), KanbanView (`KanbanView.tsx:142`), `_shared.tsx:31` ✓
- `MapViewContainer` does NOT set `touch-action` (correct — map needs all gestures) ✓
- `WebkitOverflowScrolling: "touch"` on PanelBody (`atoms.tsx:195`) ✓
- Mobile hamburger overlay in `ViewsLayout.tsx:53–67` ✓

**Icons:**
- All Lucide, `currentColor` via Tailwind `text-*` (with one exception: `GroupViewList.tsx:96` uses inline `style={{ color: ... }}` to toggle coral/muted — semantically equivalent, still inherits stroke). Sampled 20+ icon usages. All `strokeWidth={2}` or `2.25` per prototype. ✓

---

## 6. Bottom Line

Ship it after addressing **I-2 / I-3 / I-4 / I-6 / I-7** (5 small color swaps in 5 files) and resolving **I-11** (NewsView card target — currently breaks the click-to-detail contract). The rest are acceptable for v1 with the deviations already documented, or are doc-vs-prototype radius tension that's worth a tokens.md amendment rather than a code change.

No blockers; verdict reflects the polish work needed before a public release.
