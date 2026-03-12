# Forms Documentation Expansion Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Split the monolithic `forms.md` into a `Forms/` subfolder with 10 component files, each at the depth level of `Navigation/buttons.md`.

**Architecture:** Redistribute existing `forms.md` content into `_foundations.md` (shared patterns) and `form-layouts.md` (modal/panel skeletons), then create 8 new per-component files with when-to-use, variants, keyboard interactions, do/don't, and accessibility guidance. Delete the old file last. Paper artboard expansion is already complete.

**Cross-doc alignment fixes applied in this plan:**
1. Backdrop: `bg-black/40` (matches `Containers/modal.md`, not the plum-tinted `bg-[#403770]/40` from old `forms.md`)
2. Modal title: `font-semibold` (matches `Containers/modal.md`, not `font-bold` from old `forms.md`)
3. Modal header/footer borders: `border-[#E2DEEC]` (Border Subtle — inner dividers, matching `Containers/modal.md`, not `border-[#D4CFE2]` from old `forms.md`)
4. Range input: scoped out in `_foundations.md` as map-specific chrome

**Tech Stack:** Markdown documentation, Fullmind design token system (`tokens.md`)

**Spec:** `docs/superpowers/specs/2026-03-11-forms-expansion-design.md`

---

## Chunk 1: Foundations and Core Files

### Task 1: Create `_foundations.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/_foundations.md`
- Reference: `Documentation/UI Framework/Components/forms.md` (source)
- Reference: `Documentation/UI Framework/Components/Display/_foundations.md` (pattern)
- Reference: `Documentation/UI Framework/tokens.md` (token values)

This is the keystone file — all other component files reference it. Must be written first.

- [ ] **Step 1: Create the foundations file**

Write `Documentation/UI Framework/Components/Forms/_foundations.md` with this content structure:

```markdown
# Form Component Foundations

Shared patterns for all form components. Every component guide in this folder
references these foundations. If a pattern is defined here, the component guide should
not redefine it — just reference this file.

All values come from `tokens.md`. No Tailwind grays (`gray-*`) in form components.

---

## Canonical Input Styling

[Carry over the canonical Tailwind class string and states table from forms.md lines 47-66 verbatim]

## Input Types Not Covered

- **Range / Slider** (`<input type="range">`): Map-specific chrome (opacity slider in LayerBubble). Not a form component — documented in map chrome guides.

## Label Convention

[Carry over from forms.md lines 82-97 verbatim]

## Layout Rules

[Carry over from forms.md lines 101-120 verbatim]

## Validation

[Carry over from forms.md lines 122-170 verbatim]

## Help Text

- Style: `text-xs text-[#A69DC0] mt-1`
- Position: below input (or below error message when both present)
- Length: max 1-2 sentences — if you need more, link to a docs page
- Accessibility: connect to input via `aria-describedby`

## Keyboard Foundations

Global keyboard conventions across all form components:

| Key | Behavior |
|-----|----------|
| Tab | Move focus to next focusable field |
| Shift+Tab | Move focus to previous focusable field |
| Enter | Submit form (single-line inputs within a `<form>`) |

- Focus order follows DOM order — do not use `tabIndex` > 0
- All interactive elements must be reachable via Tab
- Focus indicators must always be visible (never `outline-none` without a ring replacement)

## Focus Management

- **Focus ring:** `focus:ring-2 focus:ring-[#F37167] focus:border-transparent` (coral, 2px)
- **Inline edit exception:** `ring-2 ring-[#403770]` (plum ring for contextual differentiation)
- **Modal focus trap:** Tab cycles within the modal while open; focus returns to trigger on close
- **Auto-focus:** First focusable field receives focus on modal/panel open
- **Skip link:** Not currently implemented; add if forms grow beyond 10 fields

## Shared Primitives (Recommended)

[Carry over from forms.md lines 399-446 verbatim — FormField, FormSection, FormActions interfaces]

## Migration Reference

[Carry over the FULL migration table from forms.md lines 452-476, BUT:
- REMOVE the row about `bg-black/40` backdrops (that's actually correct per Containers/modal.md)
- Keep all other rows]

## File Reference

| What | Where |
|------|-------|
| This foundations file | `Documentation/UI Framework/Components/Forms/_foundations.md` |
| Design tokens | `Documentation/UI Framework/tokens.md` |
| Shared primitives | `src/features/shared/components/forms/` (recommended, not yet built) |
| Component guides | All other `.md` files in this folder |
| Modal form examples | `TaskFormModal.tsx`, `GoalFormModal.tsx`, `GoalEditorModal.tsx`, `PlanFormModal.tsx`, `DistrictTargetEditor.tsx`, `ActivityFormModal.tsx`, `OutcomeModal.tsx` |
| Panel form examples | `AccountForm.tsx`, `PlanEditForm.tsx`, `TaskForm.tsx`, `ActivityForm.tsx`, `PlanFormPanel.tsx` |
| Inline edit | `InlineEditCell.tsx`, `QuickAddTask.tsx`, `NotesEditor.tsx` |
| Login form | `src/app/login/page.tsx` |
```

The actual content for each section should be lifted directly from the existing `forms.md`, with the cross-doc alignment fixes applied:
- Remove the `bg-black/40` → `bg-[#403770]/40` migration row (bg-black/40 is correct)
- Change `font-bold` to `font-semibold` for modal titles wherever referenced

- [ ] **Step 2: Verify the file renders correctly**

Open the file and confirm:
- All hex values match `tokens.md`
- No Tailwind grays
- States table is complete
- Migration table doesn't include the bg-black/40 row

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/_foundations.md"
git commit -m "docs: add form component foundations"
```

---

### Task 2: Create `form-layouts.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/form-layouts.md`
- Reference: `Documentation/UI Framework/Components/forms.md` (source — modal/panel JSX skeletons)
- Reference: `Documentation/UI Framework/Components/Containers/modal.md` (alignment check)

- [ ] **Step 1: Create the form-layouts file**

Write `Documentation/UI Framework/Components/Forms/form-layouts.md` following this structure:

```markdown
# Form Layouts

Layout patterns for the three form contexts: Modal, Panel, and Form Sections. See `_foundations.md` for shared input styling and validation.

---

## When to Use

- **Modal form:** Creating/editing a record with multiple fields that needs focused attention
- **Panel form:** Creating/editing within the map context without leaving the current view
- **Form sections:** Grouping related fields with headings or collapsible regions within either layout

---

## Modal Form Pattern

### Structure

- **Backdrop:** `fixed inset-0 z-40 bg-black/40` (matches Containers/modal.md)
- **Wrapper:** `fixed inset-0 z-50 flex items-center justify-center`
- **Container:** `bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col`
- **Header:** `px-6 py-4 border-b border-[#E2DEEC] flex items-center justify-between` — title: `text-lg font-semibold text-[#403770]`
- **Body:** `flex-1 overflow-y-auto px-6 py-4 space-y-4`
- **Footer:** `px-6 py-4 border-t border-[#E2DEEC] bg-[#F7F5FA] flex justify-end gap-3`

[Full JSX skeleton from forms.md lines 194-263, with these corrections:
- Backdrop: bg-black/40 (not bg-[#403770]/40)
- Title: font-semibold (not font-bold)
- Header/footer border: border-[#E2DEEC] (matching Containers/modal.md)]

### Buttons

- **Submit:** `px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50`
- **Cancel:** `px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770]`
- **Destructive:** `bg-[#F37167] hover:bg-[#e05f55]`
- **Pending:** text changes to "Creating..." / "Saving...", `disabled:opacity-50`

### Keyboard

| Key | Action |
|-----|--------|
| Escape | Close modal (if no unsaved changes) |
| Tab | Cycle focus within modal (focus trap) |
| Enter | Submit form (from any single-line input) |

### Codebase Examples

| Modal | File |
|-------|------|
| TaskFormModal | `src/features/tasks/components/TaskFormModal.tsx` |
| GoalFormModal | `src/features/goals/components/GoalFormModal.tsx` |
| GoalEditorModal | `src/features/goals/components/GoalEditorModal.tsx` |
| GoalSetupModal | `src/features/goals/components/GoalSetupModal.tsx` |
| PlanFormModal | `src/features/plans/components/PlanFormModal.tsx` |
| ActivityFormModal | `src/features/activities/components/ActivityFormModal.tsx` |
| OutcomeModal | `src/features/activities/components/OutcomeModal.tsx` |
| DistrictTargetEditor | `src/features/plans/components/DistrictTargetEditor.tsx` |

---

## Panel Form Pattern

[Carry over from forms.md lines 267-336, keeping all existing content]

### Keyboard

| Key | Action |
|-----|--------|
| Escape | Navigate back (same as back button) |
| Tab | Move between fields (no focus trap) |
| Enter | Submit form |

### Codebase Examples

| Panel | File |
|-------|------|
| AccountForm | `src/features/map/components/panels/AccountForm.tsx` |
| PlanEditForm | `src/features/map/components/right-panels/PlanEditForm.tsx` |
| TaskForm | `src/features/map/components/right-panels/TaskForm.tsx` |
| ActivityForm | `src/features/map/components/right-panels/ActivityForm.tsx` |
| PlanFormPanel | `src/features/map/components/panels/PlanFormPanel.tsx` |

---

## Form Section Patterns

### Section Heading

`text-xs font-semibold text-[#8A80A8] uppercase tracking-wider`

### Collapsible Section

Border wrapper with chevron toggle. Used for "Link To" in TaskFormModal.

### Optional Fields Toggle

"Show/Hide optional fields" pattern (as in AccountForm). Toggle reveals secondary fields below.

---

## Do / Don't

- DO use modal for focused multi-field workflows that block the page
- DON'T use modal for quick single-field edits — use inline editing
- DO use panel for map-context editing that preserves spatial awareness
- DON'T nest a modal inside a panel — close the panel first
- DO put destructive actions (Delete) on the left of modal footers, separated from Cancel/Submit on the right

## Accessibility

- Modal: `role="dialog"`, `aria-labelledby` pointing to title, `aria-modal="true"`, focus trap
- Panel: no special role needed — it's an embedded form, not an overlay
- Footer buttons: submit button should be `type="submit"` inside a `<form>`, cancel should be `type="button"`
```

- [ ] **Step 2: Verify cross-doc alignment**

Confirm:
- Backdrop is `bg-black/40` (matches `Containers/modal.md`)
- Title is `font-semibold` (matches `Containers/modal.md`)
- Border colors use `#E2DEEC` for header/footer dividers

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/form-layouts.md"
git commit -m "docs: add form layouts guide (modal, panel, sections)"
```

---

## Chunk 2: Individual Component Files (Group A)

### Task 3: Create `text-input.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/text-input.md`

- [ ] **Step 1: Create the file**

Follow the per-file template from the spec (section "Per-File Template"). Content source is spec section "2. `text-input.md`" (lines 134-160).

The file must include:
- `# Text Input` header with one-line description referencing `_foundations.md`
- **When to Use** — single-line text entry, type variants (text/email/url/tel/password/number)
- **Variants** — Standard (canonical class string with full TSX example), With Icon Prefix (`pl-9` pattern), With Character Count
- **States** — "Inherited from `_foundations.md` — no overrides"
- **Keyboard Interactions** table — Tab, Shift+Tab, Enter, Ctrl+A
- **Do / Don't** — DO use type="email" for email; DON'T use type="number" for non-quantity digits
- **Accessibility** — label htmlFor, aria-describedby, aria-invalid
- **Migration** — extract relevant rows from the master table (placeholder colors, input border colors found in text input contexts)
- **Codebase Examples** table — list files that use text inputs (TaskFormModal, GoalFormModal, PlanFormModal, AccountForm, login page)

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/text-input.md"
git commit -m "docs: add text input component guide"
```

---

### Task 4: Create `textarea.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/textarea.md`

- [ ] **Step 1: Create the file**

Content source is spec section "3. `textarea.md`" (lines 162-186).

Include:
- **When to Use** — multi-line entry, DON'T use for single-line
- **Variants** — Standard (canonical + `resize-none`, 3-4 rows, full TSX), Compact (2 rows, panel context), Notes Editor (NotesEditor auto-expanding pattern)
- **Keyboard** — Enter (new line), Ctrl+Enter (save inline), Tab (next field), Escape (cancel inline)
- **Do / Don't** — DO set resize-none, DON'T use textarea for single-line
- **Accessibility** — aria-label or visible label, rows attribute
- **Codebase Examples** — PlanFormModal, TaskFormModal, ActivityFormModal, NotesEditor, PlanEditForm

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/textarea.md"
git commit -m "docs: add textarea component guide"
```

---

### Task 5: Create `select.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/select.md`

- [ ] **Step 1: Create the file**

This is the most detailed component file — it covers 3 variants. Content source is spec section "4. `select.md`" (lines 188-250).

Include:
- **When to Use** — native (< 7 options), multi-select (multiple choices), combobox (> 7 options with filtering)
- **Variants** section with 3 sub-sections:
  - **Native Select** — canonical class string + `appearance-none` for custom chevron, full TSX example
  - **Multi-Select (Dropdown Checkbox List)** — trigger with chip display, dropdown panel styling (`bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 max-h-60 overflow-y-auto`), option row styling (`hover:bg-[#EFEDF5]`), chip styling (`inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]`), full TSX example
  - **Combobox / Search-Select** — text input + dropdown, filtered list, empty state, full TSX example
- **Keyboard Interactions** — 3 separate tables, one per variant (native, multi-select, combobox) with all key mappings from the spec
- **Do / Don't** — DO use native for short lists, DON'T build custom when native suffices, DO show placeholder, DON'T use multi-select for mutually exclusive
- **Accessibility** — native (just label), multi-select (role="listbox", aria-multiselectable, aria-expanded), combobox (role="combobox", aria-autocomplete, aria-activedescendant)
- **Migration** — TagsEditor uses non-token colors (migration target), ServiceSelector uses Tailwind grays
- **Codebase Examples** — native selects across form modals, FilterBar for multi-select, TagsEditor for multi-select-with-create

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/select.md"
git commit -m "docs: add select component guide (native, multi-select, combobox)"
```

---

### Task 6: Create `date-input.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/date-input.md`

- [ ] **Step 1: Create the file**

Content source is spec section "5. `date-input.md`" (lines 252-278).

Include:
- **When to Use** — date selection, native type="date", DON'T use custom picker
- **Variants** — Single Date (canonical + type="date", TSX), Date Range Pair (grid grid-cols-2 gap-3, two inputs, TSX)
- **Keyboard** — Tab (between segments), Arrow Up/Down (increment/decrement), Arrow Left/Right (between segments), Enter (open picker), Escape (close)
- **Do / Don't** — DO use native, DON'T add custom picker, DO validate end >= start
- **Accessibility** — native accessible by default, label htmlFor, aria-describedby for ranges
- **Codebase Examples** — ActivityFormModal (start/end dates), TaskForm (due date), OutcomeModal (dates), InlineEditCell (date type)

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/date-input.md"
git commit -m "docs: add date input component guide"
```

---

## Chunk 3: Individual Component Files (Group B)

### Task 7: Create `checkbox-and-radio.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/checkbox-and-radio.md`

- [ ] **Step 1: Create the file**

Content source is spec section "6. `checkbox-and-radio.md`" (lines 280-322).

Include:
- **When to Use** — checkbox (boolean), checkbox group (multi-select list), radio (exactly one)
- **Variants** with 3 sub-sections:
  - **Individual Checkbox** — `rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]`, label right `flex items-center gap-2`, TSX
  - **Checkbox Group** — vertical `space-y-2`, optional Select All, TSX
  - **Radio Group** — vertical `space-y-2`, horizontal `flex items-center gap-4` (2-3 short options), TSX for both
- **Keyboard** — Space (toggle/select), Tab (exit group), Arrow Up/Down/Left/Right (navigate radios)
- **Do / Don't** — DO fieldset+legend, DON'T checkbox for mutually exclusive, DO radio for 2-5, DON'T single radio alone
- **Accessibility** — fieldset+legend for groups, name attribute for radios, label wrapping or htmlFor
- **Migration** — ServiceSelector uses Tailwind grays (migration target)
- **Codebase Examples** — ActivityFormModal (checkboxes, radio), LayerBubble (checkboxes), TaskForm (checkboxes), ServiceSelector

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/checkbox-and-radio.md"
git commit -m "docs: add checkbox and radio component guide"
```

---

### Task 8: Create `toggle.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/toggle.md`

- [ ] **Step 1: Create the file**

Content source is spec section "7. `toggle.md`" (lines 324-358).

Include:
- **When to Use** — immediate-effect binary settings, DON'T use in forms with submit button
- **Variants** — Standard only (track + thumb dimensions, off/on colors)
- **States** table — Off, On, Disabled Off, Disabled On (track color + thumb position for each)
- **Keyboard** — Space, Enter, Tab
- **Do / Don't** — DO for immediate settings, DON'T in submit forms, DO pair with label
- **Accessibility** — role="switch", aria-checked, label via htmlFor
- **TSX example** — complete toggle component
- **Migration** — `bg-gray-300` toggle off → `bg-[#C2BBD4]` (OutcomeModal)
- **Codebase Examples** — OutcomeModal, AccountForm (show optional fields)

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/toggle.md"
git commit -m "docs: add toggle/switch component guide"
```

---

### Task 9: Create `currency-input.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/currency-input.md`

- [ ] **Step 1: Create the file**

Content source is spec section "8. `currency-input.md`" (lines 360-394).

Include:
- **When to Use** — budget, revenue, cost, monetary fields
- **Variants** — Standard (pl-7 with $ prefix element `absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0]`)
- **TSX example** — complete currency input from spec (the exact code block at lines 371-383)
- **States** — "Inherited from `_foundations.md` — the $ prefix uses Muted `#A69DC0` in all states"
- **Keyboard** — "Same as text input — see `text-input.md`"
- **Do / Don't** — DO inputMode="decimal", DON'T type="number", DO format on blur
- **Accessibility** — label includes currency context, aria-describedby for format help
- **Codebase Examples** — DistrictTargetEditor, InlineEditCell (currency formatting), FinanceCard, StaffingCard

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/currency-input.md"
git commit -m "docs: add currency input component guide"
```

---

### Task 10: Create `inline-editing.md`

**Files:**
- Create: `Documentation/UI Framework/Components/Forms/inline-editing.md`

- [ ] **Step 1: Create the file**

Content source is spec section "9. `inline-editing.md`" (lines 396-436) plus existing forms.md inline editing section (lines 340-395).

Include:
- **When to Use** — quick single-value edits, DON'T use for multi-field or validation-heavy
- **Variants** with 3 sub-sections:
  - **Click-to-Edit Cell** — display mode classes, edit mode classes (plum ring `ring-2 ring-[#403770]`), success flash `bg-[#F7FFF2]`, full TSX for display and edit modes (from forms.md lines 368-394)
  - **Quick-Add** — persistent input, Enter to create, Escape to clear, coral focus ring (it's a form input)
  - **Card Editing (NotesEditor)** — display-to-edit toggle, blur/Ctrl+Enter to save
- **Keyboard per input type** table — Text (blur/Enter save, Escape cancel), Date, Textarea (Ctrl+Enter), Select (auto-save)
- **Do / Don't** — DO auto-focus, DON'T for validation-heavy, DO success flash, DON'T for sensitive fields
- **Accessibility** — aria-label="Edit [field]", immediate focus, aria-live="polite"
- **Codebase Examples** — InlineEditCell, QuickAddTask, NotesEditor

- [ ] **Step 2: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/inline-editing.md"
git commit -m "docs: add inline editing component guide"
```

---

## Chunk 4: Cleanup and Final Commit

### Task 11: Delete old `forms.md`

**Files:**
- Delete: `Documentation/UI Framework/Components/forms.md`

- [ ] **Step 1: Verify all content has been redistributed**

Check that every section from `forms.md` has a home in the new `Forms/` folder:
- Lines 1-5 (intro) → `_foundations.md` header
- Lines 6-67 (canonical input, states) → `_foundations.md`
- Lines 68-98 (label convention) → `_foundations.md`
- Lines 99-120 (layout rules) → `_foundations.md`
- Lines 121-170 (validation) → `_foundations.md`
- Lines 171-263 (modal form pattern) → `form-layouts.md`
- Lines 264-336 (panel form pattern) → `form-layouts.md`
- Lines 337-395 (inline editing) → `inline-editing.md`
- Lines 396-446 (shared primitives) → `_foundations.md`
- Lines 447-476 (migration) → `_foundations.md`
- Lines 477-489 (file reference) → `_foundations.md`

- [ ] **Step 2: Delete the old file**

```bash
git rm "Documentation/UI Framework/Components/forms.md"
```

- [ ] **Step 3: Commit**

```bash
git commit -m "docs: remove old monolithic forms.md (content redistributed to Forms/ folder)"
```

---

### Task 12: Final verification

- [ ] **Step 1: Verify all 10 files exist**

```bash
ls "Documentation/UI Framework/Components/Forms/"
```

Expected output:
```
_foundations.md
checkbox-and-radio.md
currency-input.md
date-input.md
form-layouts.md
inline-editing.md
select.md
text-input.md
textarea.md
toggle.md
```

- [ ] **Step 2: Verify no Tailwind grays leaked in**

Search all new files for `gray-`:
```bash
grep -r "gray-" "Documentation/UI Framework/Components/Forms/"
```

Expected: no matches (or only in migration table "Replace With" context showing what TO replace).

- [ ] **Step 3: Verify all hex values are from tokens.md**

Spot-check that recurring hex values match:
- `#403770` (Plum), `#F37167` (Coral), `#C2BBD4` (Border Strong), `#8A80A8` (Secondary), `#A69DC0` (Muted), `#E2DEEC` (Border Subtle), `#D4CFE2` (Border Default), `#F7F5FA` (Surface Raised), `#EFEDF5` (Hover), `#fef1f0` (Error bg), `#f58d85` (Error text), `#F7FFF2` (Success bg)

- [ ] **Step 4: Verify old forms.md is gone**

```bash
test ! -f "Documentation/UI Framework/Components/forms.md" && echo "DELETED" || echo "STILL EXISTS"
```

Expected: `DELETED`
