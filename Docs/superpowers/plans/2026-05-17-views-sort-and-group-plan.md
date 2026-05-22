# Implementation Plan: Sort + Group Toolbar Controls

**Date:** 2026-05-17
**Slug:** views-sort-and-group
**Spec:** `docs/superpowers/specs/2026-05-17-views-sort-and-group-spec.md`
**Backend context:** `docs/superpowers/specs/2026-05-17-views-sort-and-group-backend-context.md`

## Commit Cadence

Per saved feedback: feat/* branch + many small focused commits. The plan is
sequenced into 9 commits, each ~50-200 LoC, each on its own logical boundary,
each shippable individually (the feature is gated behind UI that only appears
once it's all wired).

Commits 1-3 land the data plumbing with **no visible UI change**. Commits 4-7
add the UI. Commits 8-9 are tests + cleanup.

## Phases

### Phase 1 — Foundation (no UI change)

**Commit 1: `feat(views): add groupBy field to grid layout schema`**

- File: `src/lib/saved-views/grid-layout-schema.ts`
  - Add `groupBy: z.object({ id: z.string() }).nullable().optional()` with `superRefine` against `sortableFieldIds`.
  - Replicate on `newsLayoutSchema`.
- File: `src/lib/saved-views/__tests__/grid-layout-schema.test.ts`
  - Cases: accepts `{ id: "state" }` (districts), accepts `null`, accepts undefined (legacy blob), rejects unsortable id (e.g. `target`), repeats for news.
- Verification: `npx vitest run src/lib/saved-views/__tests__/grid-layout-schema.test.ts`

**Commit 2: `feat(views): make contacts.name and contacts.leaid sortable`**

- File: `src/lib/saved-views/source-fields.ts` (`SOURCE_FIELDS.contacts`)
  - Add `{ id: "name", column: "name", type: "text" }` if not present.
- File: `src/features/views/lib/columns.ts`
  - Flip `contacts.name` `sortable: true`.
  - Flip `contacts.leaid` `sortable: true`.
- Verification: extend an existing sql-compiler test to confirm `ORDER BY "name" ASC NULLS LAST` compiles for contacts. Run the file's full suite.

**Commit 3: `feat(views): prepend groupBy to sort stack in data fetcher`**

- File: `src/features/views/hooks/useViewsData.ts`
  - When `layout.groupBy` is set, prepend `{ id: layout.groupBy.id, dir: "asc" }` to the array used to build `sort=` URL params.
  - Add `groupBy?.id` to the query key so cache differentiates ungrouped vs grouped state.
- File: `src/features/views/hooks/useGridLayout.ts`
  - `defaultLayout()` returns `groupBy: null` alongside columns/sort/filters.
- Verification: add a unit test on `useViewsData` (mock fetch, assert URL params) — `groupBy: { id: "state" }` produces `sort=state:asc&...` as the first param.

### Phase 2 — Sort toolbar UI

**Commit 4: `feat(grid): Sort chip strip + field picker in toolbar`**

- New: `src/features/views/components/grid/SortFieldPicker.tsx`
  - Mirror `FilterFieldPicker`. Lists `SOURCE_COLUMNS[source]` where `sortable: true`. Disables fields already in `layout.sort`. Header label "Add sort".
- New: `src/features/views/components/grid/GridSortChips.tsx`
  - `+ Sort` dashed-pill trigger; chip row; "Clear all" link when ≥2 sorts.
  - Chip body: lucide `ArrowUp`/`ArrowDown` (12px) + column header. Multi-sort index suffix (¹²³) when stack length > 1.
  - Click chip body → call parent `onSortChange(id, dir === "asc" ? "desc" : "asc", false)` (single-sort flip).
  - Click X → call parent `onSortChange(id, null, false)`.
- File: `src/features/views/components/grid/GridView.tsx`
  - Insert `<GridSortChips>` between `<GridFilterChips>` and the `[⚙]` button. Reuse the existing `handleSortChange`.
- File: `__tests__/GridSortChips.test.tsx`
  - Open picker → pick "Target" → chip appears with desc default? (Decision: pickers add as `asc` first; user clicks body to flip.)
  - Click chip body flips direction.
  - X removes from stack.
  - Picker disables already-sorted columns.
  - "Clear all" empties stack.
- Verification: `npx vitest run` + visual smoke on `/territory-plan/<id>?tab=table`.

### Phase 3 — Group toolbar UI

**Commit 5: `feat(grid): Group chip + field picker in toolbar`**

- New: `src/features/views/components/grid/GroupFieldPicker.tsx`
  - Lists columns where `sortable: true` AND `filterWidget.kind ∈ { multiselect, select, toggle }`. Header label "Group by".
- New: `src/features/views/components/grid/GridGroupChip.tsx`
  - `+ Group` dashed-pill trigger; single chip max; chip body has lucide `Layers` icon + column header; no direction toggle.
  - Click chip body → reopen picker (swap field).
  - Click X → `onChange({ ...layout, groupBy: null })`.
- File: `src/features/views/components/grid/GridView.tsx`
  - Insert `<GridGroupChip>` after `<GridSortChips>`.
  - Conditionally hide when `source === "news" && layout.mode === "cards"` (read `mode` off `savedLayouts?.news` since GridView doesn't see mode directly — needs a small prop addition).
- File: `__tests__/GridGroupChip.test.tsx`
  - Pick field → chip appears; pick another → replaces; X removes; hidden in news cards mode.
- Verification: `npx vitest run` + visual smoke.

### Phase 4 — Group rendering

**Commit 6: `feat(grid): collapsible group sections in table body`**

- File: `src/features/views/components/grid/GridView.tsx`
  - Local state: `const [collapsed, setCollapsed] = useState<Set<string>>(new Set())`.
  - Helper: when `layout.groupBy` set, walk rows and emit `{ kind: "header", value, count } | { kind: "row", original }` sequence.
  - Render in `<tbody>`:
    - Header `<tr>` with `<td colSpan>` containing chevron + value + count.
    - `bg-[#F7F5FA]`, `border-b border-[#EFEDF5]`, `position: sticky; top: 36px`, `text-[12px] font-semibold text-[#403770]`, value `uppercase tracking-[0.06em]`, count in `#8A80A8`.
    - Click row → toggle `collapsed.has(value)` in the Set.
    - Skip data rows whose group value is in the collapsed set.
  - Null group → label "— No value —", sorted to the end (frontend reordering, since SQL NULLS LAST already puts them at the end of ASC sort).
- File: `__tests__/GridView.test.tsx`
  - Set `layout.groupBy: { id: "state" }`; assert headers render with correct counts; expanded rows visible; click header → rows hidden; null group renders "— No value —".
- Verification: `npx vitest run` + visual smoke (set group=State on a plan with multi-state districts).

### Phase 5 — End-to-end coverage + cleanup

**Commit 7: `test(grid): e2e persistence covers sort and group`**

- File: `src/features/views/hooks/__tests__/useGridLayout.test.ts` (or `__tests__/useViewsData.test.ts` — pick the existing filter→save→refetch test)
  - Add a sort change, then a groupBy change; await debounce; assert both PATCH bodies are correct; mount fresh hook with the persisted layout; confirm both fields hydrate.
- Verification: `npx vitest run src/features/views`.

**Commit 8: `docs(views): update architecture map + spec sign-off`**

- File: `docs/architecture.md` — only if Sort/Group introduce a new shared component category. Likely no change — the new files live under the existing `views/components/grid/` folder.
- Skip if no architectural surface changed.

**Commit 9 (conditional): `fix(grid): <any regressions caught in design review>`**

- Reserved slot for design-review feedback fixes if the audit flags anything.

## Dependencies + Ordering

```
   1: schema
       │
       ▼
   2: flag-flips (independent — could be 1.5, but logically same foundation phase)
       │
       ▼
   3: data layer (needs 1's schema field; also needs 2's flag-flips for the new
                  sortable contacts.name to actually validate)
       │
       ▼
   4: Sort UI ────────────────────┐
       │                          │
       ▼                          │
   5: Group UI                    │ (could parallelize 4 + 5, but they both
       │                          │  touch GridView.tsx — serialize to avoid
       ▼                          │  merge friction)
   6: Group rendering             │
       │                          │
       ▼                          │
   7: e2e tests ──────────────────┘
       │
       ▼
   8: docs (conditional)
```

## Parallelization

**Skip.** The whole change is ~600-800 LoC concentrated in one file
(`GridView.tsx`) plus 4 new small files. Subagent parallelization adds
coordination cost and merge friction for too little gain. Dispatch a single
implementer agent that walks the 8 commits in order.

## Risk + Mitigation

| Risk | Mitigation |
|---|---|
| `layout.groupBy` schema change breaks existing persisted blobs | `optional()` is forgiving — covered by Commit 1 test "parses legacy blob". |
| Sticky group headers fight the sticky column header (`top-0`) | Group headers use `top: 36px` (matching column header height). Verified visually in Commit 6. |
| Performance: 50-row table with 5 groups = 55 `<tr>`s. No issue. | None — already paginate at 50 rows. |
| News cards mode hides Group but Sort stays — does sort work on cards? | Yes — backend sorts before returning. Cards render in the returned order. Confirmed in spec Q&A. |
| Picker popovers clip on narrow viewports | Existing pattern (`maxWidth: calc(100vw - 16px)`) handles this — copied from FilterFieldPicker. |
| Districts user picks "stage" / "target" / "pipeline" expecting it to work | Already prevented — sortable:false filters them out of the SortFieldPicker, and the GroupFieldPicker requires sortable AND discrete widget. |

## Test Strategy

Each commit verifies its own changes immediately:

| Phase | Verification |
|---|---|
| 1 | `vitest grid-layout-schema.test.ts` |
| 2 | `vitest sql-compiler.test.ts` + sql-compiler-order-by |
| 3 | `vitest useViewsData.test.ts` (new file or add to existing) |
| 4 | `vitest GridSortChips.test.tsx` + manual visual |
| 5 | `vitest GridGroupChip.test.tsx` + manual visual |
| 6 | `vitest GridView.test.tsx` (group render) + manual visual |
| 7 | `vitest src/features/views` full suite |

Final gates before merge:
- `npx vitest run` — full project suite.
- `npm run build` — TypeScript + Next.js build.
- Mobile smoke on `http://a-arcega.local:3005` per CLAUDE.md.

## Out-of-Scope Reminders

- Don't add sort drag-reorder.
- Don't persist collapsed state.
- Don't add group aggregates.
- Don't refactor districts SQL to enable `stage`/`target`/`pipeline` group-by.
