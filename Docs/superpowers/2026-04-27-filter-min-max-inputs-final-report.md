# Code Review — RangeFilter inline min/max inputs

**Date:** 2026-04-27
**Branch:** `worktree-filter-min-max-inputs`
**Spec:** `Docs/superpowers/specs/2026-04-27-filter-min-max-inputs-spec.md`
**Plan:** `Docs/superpowers/plans/2026-04-27-filter-min-max-inputs-plan.md`
**Recommendation:** READY FOR REVIEW

## One-line summary

Single-component change is well-scoped, fully spec-compliant, all consumers
mechanically updated, 12 tests pass; one subtle Escape-after-typing timing
that works in jsdom and almost certainly in real browsers but warrants a
single manual smoke check.

## Issue counts

- Critical: 0
- Important: 0
- Suggestions: 3

## Strengths

- Clean separation between slider state (`lo`/`hi`) and typed input state
  (`loInput`/`hiInput`), with focus-tracked guards (`loFocused`/`hiFocused`)
  preventing the slider sync `useEffect` from clobbering in-progress typing.
  See `RangeFilter.tsx:75-94`.
- Spec compliance is complete: clamping, swap, step bypass, decimal handling,
  bounds-reset removal, Escape revert, prefix/suffix adornments, aria labels,
  `inputMode` derived from `step` — all implemented.
- The plan suggested keeping `formatValue` on the interface for backward
  compatibility; the implementation went one better and removed it entirely
  along with the `formatCompact` default. This is a beneficial deviation —
  consumers were all updated cleanly so no compat shim is needed.
- All 5 dropdowns (`DistrictsDropdown`, `DemographicsDropdown`,
  `FinanceDropdown`, `AcademicsDropdown`, `FullmindDropdown`) plus the
  internal `FinancialRangeFilter` wrapper were updated mechanically with no
  drift — every `formatValue={(v) => '$' + formatCompact(v)}` became
  `prefix="$"`, every `formatValue={(v) => v + '%'}` became `suffix="%"`,
  and unused `formatCompact` named imports were dropped (verified via grep —
  no consumer imports `formatCompact` from `RangeFilter` anymore).
- Tests are well-targeted across the 12 cases the plan called for, plus
  swap-with-existing-filter (`RangeFilter.test.tsx:133-145`), decimal
  rounding (`:147-155`), and decimal preservation when `step < 1`
  (`:157-174`). Test setup mocks the Zustand store consistently with the
  pattern in this codebase.
- TypeScript: strict typing throughout, no `any`, no `@ts-ignore`. Naming
  matches the spec/plan exactly (`commitLo`, `commitHi`, `loFocused`,
  `hiFocused`, `parseTyped`, `applyImmediate`, `scheduleApply`).
- Styling consistency preserved: inactive `text-[#A69DC0]`, active
  `text-plum font-medium`, focus ring `focus:ring-1 focus:ring-plum/30`,
  hover border `hover:border-[#D4CFE2]` — all match existing dropdown chrome
  conventions and the documented Fullmind tokens (no Tailwind grays).

## Plan deviations (all beneficial)

- `formatValue` prop fully removed from `RangeFilterProps` rather than kept
  optional (plan §1.1 said "kept for backward compat"). Since every consumer
  was updated, removal is cleaner. Confirmed no remaining `formatValue`
  references anywhere in `src/`.
- `formatCompact` is still exported from `RangeFilter.tsx:17-25` but no
  longer imported by any consumer. The plan's risk note worried
  `FinancialRangeFilter` would still need it, but that wrapper now uses
  `prefix="$"`. See Suggestion 1.

## Suggestions (nice-to-have, none blocking)

### S1 — `formatCompact` is a now-unused export

`RangeFilter.tsx:17-25` defines and exports `formatCompact`, but no consumer
imports it (verified via `grep -rn "formatCompact" src/`). It's also unused
inside the file now that `formatValue` is gone. Either:

- Remove it (cleanest), or
- Move it to `src/features/shared/lib/format.ts` alongside the existing
  `formatCompactNumber` (which has slightly different semantics — `14832`
  becomes `"14.8K"` there but `"15K"` here, so they aren't drop-in
  replacements).

Low priority — dead exports don't hurt runtime, just clutter the API
surface.

### S2 — Escape-after-typing relies on subtle React event timing

`RangeFilter.tsx:276-283` (and `:305-312` for max input):

```tsx
onKeyDown={(e) => {
  if (e.key === "Enter") {
    e.currentTarget.blur();
  } else if (e.key === "Escape") {
    setLoInput(String(lo));
    e.currentTarget.blur();
  }
}}
```

The Escape branch calls `setLoInput(String(lo))` then synchronously calls
`blur()`. The `onBlur` handler then calls `commitLo()`, which reads
`loInput` from its closure. Whether `commitLo` sees the freshly-set `"0"`
or the still-typed `"9999"` depends on whether React has flushed the
keydown handler's state updates before invoking the synthetically-fired
blur handler.

I verified empirically in jsdom: `commitLo` reads the post-`setLoInput`
value `"0"`, so `parseTyped` returns 0, the bounds-reset logic kicks in,
no `onApply` is called, and `input.value` correctly shows `"0"`. The 12th
test (`Escape reverts unsaved input`) confirms this. React 18+ also
generally flushes discrete events before nested DOM-method-triggered
events, so real browsers should behave the same. **Worth one explicit
manual smoke test** to confirm Escape behavior in Chrome/Safari before
ship — if it ever regresses, the hardening fix is a `skipNextCommit` ref:

```tsx
const skipNextCommitRef = useRef(false);
// Escape branch:
skipNextCommitRef.current = true;
setLoInput(String(lo));
e.currentTarget.blur();
// commitLo entry:
if (skipNextCommitRef.current) { skipNextCommitRef.current = false; return; }
```

Don't add this preemptively — current code is correct in jsdom and the
ref-based pattern adds noise. Just noting for future debugging if the
behavior ever flakes.

### S3 — Test for `clamps a value above max` accidentally exercises bounds-reset

`RangeFilter.test.tsx:111-121` types `999999999` into the max input,
blurs, and asserts `input.value === "200000"`. Because the row starts
inactive and `lo` defaults to `min=0`, the post-clamp state is
`(0, 200000) === (min, max)`, which triggers the remove-filter branch
rather than calling `onApply`. The comment at `:118-120` acknowledges
this. To exercise pure clamping behavior (verify `onApply` is called
with the clamped value), add a variant where the row already has an
active sub-range:

```tsx
storeState.searchFilters = [{ id: "f", column: "enrollment", op: "between", value: [50, 100] }];
// type 999999999 in max input → onApply should be called with (50, 200000)
```

The existing test's intent is a touch ambiguous between "clamping works"
and "clamp + bounds-reset works." The `swap` test at `:133-145` already
covers the `onApply`-with-clamped-value path indirectly, so this is
purely a clarity nitpick.

## Files reviewed

Absolute paths:

- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/src/features/map/components/SearchBar/controls/RangeFilter.tsx`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/src/features/map/components/SearchBar/controls/__tests__/RangeFilter.test.tsx`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/src/features/map/components/SearchBar/AcademicsDropdown.tsx`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/src/features/map/components/SearchBar/DemographicsDropdown.tsx`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/src/features/map/components/SearchBar/DistrictsDropdown.tsx`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/src/features/map/components/SearchBar/FinanceDropdown.tsx`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/src/features/map/components/SearchBar/FullmindDropdown.tsx`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/Docs/superpowers/specs/2026-04-27-filter-min-max-inputs-spec.md`
- `/Users/astonfurious/The Laboratory/territory-plan/.claude/worktrees/filter-min-max-inputs/Docs/superpowers/plans/2026-04-27-filter-min-max-inputs-plan.md`

## Verification artifacts

- 12/12 RangeFilter tests pass (re-ran during review)
- The 15 pre-existing test failures elsewhere in the suite are unrelated
  to this change (DB-dependent API tests + a SearchBar test missing fetch
  mock; `SearchBar/index.tsx` is unchanged from main on this branch)
- `npm run build` succeeds per the implementer's verification
- `grep -rn "formatValue" src/` returns zero hits (full removal verified)
- `grep -rn "formatCompact" src/` returns only the unused export at
  `RangeFilter.tsx:17` and an unrelated definition in
  `FlippablePlanCard.tsx` (different file, different function)

## Security / perf

- No XSS: `prefix`/`suffix` are rendered as plain text inside `<span>`
  elements, never via `dangerouslySetInnerHTML` (`RangeFilter.tsx:260,
  286, 289, 315`). Safe even if a future caller passes untrusted strings,
  though current call sites are all hardcoded literals.
- Perf: re-render count is identical to the pre-change behavior; the two
  added `useState` slots (`loInput`, `hiInput`) and two boolean focus
  flags don't introduce extra subscriptions to the Zustand store. The
  existing narrow selectors (`s.searchFilters`, `s.removeSearchFilter`)
  are preserved.
