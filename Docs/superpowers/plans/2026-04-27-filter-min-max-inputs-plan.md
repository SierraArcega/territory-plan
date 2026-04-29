# Implementation Plan: RangeFilter inline min/max number inputs

**Date:** 2026-04-27
**Slug:** filter-min-max-inputs
**Branch:** worktree-filter-min-max-inputs
**Spec:** `Docs/superpowers/specs/2026-04-27-filter-min-max-inputs-spec.md`

## Scope

Single-component frontend change. No backend, no schema, no API, no store
changes. The shared `RangeFilter` component is consumed by 5 dropdowns —
modifying it once propagates everywhere.

## File touch list

| File | Change |
|---|---|
| `src/features/map/components/SearchBar/controls/RangeFilter.tsx` | **Modified.** Replace static value labels with editable inputs. Add `prefix` and `suffix` optional props for currency / percent adornments. Add typing/blur/Enter/Escape handlers. |
| `src/features/map/components/SearchBar/DistrictsDropdown.tsx` | **Modified.** Pass `prefix="$"` to currency rows (Pipeline, Bookings, Invoicing, Expenditure / Pupil, Total/Federal/State/Local Revenue, Tech Spending, Title I Revenue, ESSER, Median Household Income, SPED Expenditure / Student); pass `suffix="%"` to percent rows (ELL, SWD, Poverty, Graduation, Math, Reading, Chronic Absenteeism, Enrollment Trend). Drop `formatValue` for these — adornment lives outside the input. |
| `src/features/map/components/SearchBar/DemographicsDropdown.tsx` | **Modified.** Same prop swap as above for the rows it owns. |
| `src/features/map/components/SearchBar/FinanceDropdown.tsx` | **Modified.** Same prop swap. |
| `src/features/map/components/SearchBar/AcademicsDropdown.tsx` | **Modified.** Same prop swap. |
| `src/features/map/components/SearchBar/FullmindDropdown.tsx` | **Modified.** Same prop swap (Pipeline / Bookings / Invoicing). |
| `src/features/map/components/SearchBar/controls/__tests__/RangeFilter.test.tsx` | **New.** Vitest + Testing Library tests covering typing, blur/Enter/Escape, clamping, swap, step bypass. |

## Task ordering

### Task 1 — Modify `RangeFilter.tsx`

1. Add to `RangeFilterProps`:
   - `prefix?: string` — rendered before the input as a non-editable adornment (e.g., `"$"`).
   - `suffix?: string` — rendered after the input as a non-editable adornment (e.g., `"%"`).
   - `formatValue` stays for backward compatibility but is no longer used inside the component (kept so existing call sites continue compiling without diff churn; actual currency / percent presentation moves to `prefix` / `suffix`). Mark internally as unused.
2. Add local input state separate from `lo` / `hi`:
   - `loInput: string`, `hiInput: string` — strings, mirror committed `lo` / `hi` whenever those change externally (slider drag, external clear).
3. Replace the two `<span>` value labels with two `<input>` elements:
   - `type="text"`, `inputMode={step < 1 ? "decimal" : "numeric"}`
   - `aria-label={\`${label} minimum\`}` / maximum
   - `className` matches today's label color/size (`text-[10px] tabular-nums`) plus input affordances: `bg-transparent`, `w-16`, `px-1.5`, `py-0.5`, `rounded`, `border border-transparent hover:border-[#D4CFE2]`, `focus:outline-none focus:ring-1 focus:ring-plum/30 focus:border-plum/30`
   - Active-state plum text reuses today's `text-plum font-medium` conditional
4. Wire handlers:
   - `onChange` → updates `loInput` / `hiInput` only
   - `onFocus` → `e.currentTarget.select()`
   - `onBlur` → call `commitLo` / `commitHi`
   - `onKeyDown`:
     - `Enter` → `e.currentTarget.blur()` (triggers blur commit)
     - `Escape` → revert input to last committed value, blur
5. `commitLo` / `commitHi` behavior:
   - Parse via `Number(input)`. If `NaN` or empty → revert input string to current `lo` / `hi`, no apply.
   - Round to integer if `step >= 1`.
   - Clamp to `[min, max]`.
   - For `commitLo`: if parsed > current `hi`, swap (set `lo = hi`, `hi = parsed`); else `setLo(parsed)`.
   - For `commitHi`: mirror.
   - Sync the input string to the committed numeric value.
   - Call `scheduleApply` (existing function — keep its `min/max → removeFilter` behavior).
6. Render adornments:
   - Each input wrapped in a flex container; if `prefix`, render `<span>` before input; if `suffix`, render after.
   - Adornments use the same color/state classes as the input text.
7. Live sync during slider drag:
   - When the slider changes `lo` / `hi`, the `useEffect` that already syncs to `existingValues` is enough — extend it to also reset `loInput` / `hiInput` strings.
   - When the user is *focused* on an input, do **not** overwrite their typing. Track focus via two booleans (`loFocused`, `hiFocused`).

### Task 2 — Update consumers

For each of the 5 dropdowns, audit every `<RangeFilter>` call:
- If the call has `formatValue={(v) => \`$${formatCompact(v)}\`}` → replace with `prefix="$"` and drop `formatValue`.
- If the call has `formatValue={(v) => \`${v}%\`}` → replace with `suffix="%"` and drop `formatValue`.
- Calls with no `formatValue` stay as-is.
- The `formatCompact` import stays only where still used elsewhere in the file (it isn't used outside RangeFilter calls — once removed from the calls, drop the import to keep lint clean).

Concrete map per file:
- **DistrictsDropdown.tsx**: `FullmindContent` Pipeline/Bookings/Invoicing → `prefix="$"`. `FinanceContent` all 8 rows → `prefix="$"`. `DemographicsContent`: ELL/SWD/Poverty rows have no formatValue today (none of the percent rows in this file pass it), but Median Household Income → `prefix="$"`, Enrollment Trend → `suffix="%"`. `AcademicsContent`: 4 percent rows → `suffix="%"`, SPED Expenditure → `prefix="$"`, others as-is. (Confirm by re-reading the file before editing.)
- **DemographicsDropdown.tsx**: Median Household Income → `prefix="$"`, Enrollment Trend → `suffix="%"`. Other rows already had no formatValue.
- **FinanceDropdown.tsx**: every currency row → `prefix="$"`.
- **AcademicsDropdown.tsx**: percent rows → `suffix="%"`, currency rows → `prefix="$"`.
- **FullmindDropdown.tsx**: Pipeline / Bookings / Invoicing → `prefix="$"`.

Drop unused `formatCompact` imports.

### Task 3 — Add component tests

`src/features/map/components/SearchBar/controls/__tests__/RangeFilter.test.tsx`:
- `renders min and max inputs alongside the slider`
- `typing in min input does not apply until blur`
- `pressing Enter commits the typed value`
- `Escape reverts unsaved input`
- `typing 137 in a step=500 row commits 137 (bypasses step)`
- `typing a value above max clamps to max`
- `typing a min greater than current max swaps lo and hi`
- `slider drag updates input value when input is not focused`
- `prefix and suffix adornments render outside the input`
- `setting both inputs back to bounds removes the filter`

Mock the Zustand store via the existing test pattern (read `SearchBar.test.tsx`
and `FilterMultiSelect.test.tsx` first to match conventions).

### Task 4 — Verification

- `npx vitest run src/features/map/components/SearchBar/controls/__tests__/RangeFilter.test.tsx`
- `npx vitest run` — full suite, ensure no regressions in `SearchBar.test.tsx`
- `npm run build` — must succeed

### Task 5 — Manual smoke (Stage 8)

Open `/` in dev, click Districts dropdown, expand each section, verify:
- Each row shows two inputs underneath the slider (was static text)
- Typing 137 in Enrollment min, blurring → filter pill shows `Enrollment 137-200000`
- Slider drag still works, inputs update live
- `$` and `%` adornments render where expected
- Escape reverts mid-type changes
- Resetting both inputs to bounds removes the filter (matching today's slider reset behavior)

## Dependencies & ordering

Task 1 must complete before Task 2 (consumers reference new props).
Task 3 can run in parallel with Task 2 once Task 1 lands.
Task 4 runs after 1-3.
Task 5 runs last.

## Risk notes

- `formatCompact` exported from RangeFilter — kept exported even though no
  longer used internally, since `FullmindContent`'s `FinancialRangeFilter`
  wrapper passes it explicitly. Verify by grepping `formatCompact` usage.
- Slider thumb at typed value 137 in a step=500 slider: native `<input
  type="range">` rounds the displayed thumb position to the nearest step. The
  underlying state stores 137 exactly. Visual jitter is expected and OK —
  document this in a single-line comment in `RangeFilter.tsx`.
- Backward compatibility: `formatValue` prop kept optional in the interface
  to avoid call-site churn during refactor; we just don't use it for inputs.
  The currently-rendered "value labels" disappear since they become inputs.
