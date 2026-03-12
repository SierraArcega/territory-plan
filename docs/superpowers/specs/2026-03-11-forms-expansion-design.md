# Forms Documentation Expansion — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Supersedes:** `2026-03-11-forms-component-guide-design.md` (original single-file approach)
**Deliverables:**
- `Documentation/UI Framework/Components/Forms/` folder (10 files)
- Expanded Paper "Forms" artboard with component specimens
- Deletion of `Documentation/UI Framework/Components/forms.md`

---

## Purpose

Expand the existing monolithic `forms.md` into an Elastic UI-style component library with per-component pages. The current file covers form types and shared styling well but lacks individual component depth — when to use each input type, keyboard interactions, multi-select patterns, do/don't guidance, and accessibility notes. This expansion brings the forms docs to parity with the depth of other component categories (Navigation/buttons.md, Display/_foundations.md, etc.).

## Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| File structure | `Forms/` subfolder with 10 files | Matches existing doc architecture (Containers/, Display/, Navigation/) |
| Component granularity | One file per input type, plus foundations + layouts | Each component needs distinct when-to-use, keyboard, and a11y guidance |
| Depth per component | Practical middle ground | Matches buttons.md depth: class string, states, variants, one JSX example, do/don't, a11y one-liner |
| Select coverage | Native + multi-select + combobox/search-select | All three patterns exist in the codebase (filter bars, form selects) |
| Keyboard docs | Per-component tables + foundations section | Keyboard behavior varies significantly per input type |
| Paper artboard | Expand existing (don't replace) | Keep current specimens, add new component sections below |

---

## Cross-Doc Alignment Notes

The original `forms.md` has two values that conflict with `Containers/modal.md` and `Containers/_foundations.md`:

1. **Backdrop color:** `forms.md` uses `bg-[#403770]/40` (plum-tinted); `Containers/modal.md` uses `bg-black/40`. **Resolution:** Align to `bg-black/40` from Containers — the backdrop is a neutral overlay, not a branded surface. Update `form-layouts.md` and the migration table accordingly (remove the row that marks `bg-black/40` as non-conforming).

2. **Modal title weight:** `forms.md` uses `font-bold`; `Containers/modal.md` uses `font-semibold`. **Resolution:** Align to `font-semibold` from Containers — this matches every other container doc and the tokens type scale (Heading tier: `font-semibold` or `font-bold`, but container headings consistently use `font-semibold`).

3. **`type="range"` (slider):** Used in `LayerBubble.tsx` for opacity control. This is map chrome, not a form field. **Resolution:** Add a brief "Input Types Not Covered" note in `_foundations.md` scoping out range/slider as map-specific chrome.

---

## File Structure

```
Documentation/UI Framework/Components/Forms/
  _foundations.md
  text-input.md
  textarea.md
  select.md
  date-input.md
  checkbox-and-radio.md
  toggle.md
  currency-input.md
  inline-editing.md
  form-layouts.md
```

The existing `Documentation/UI Framework/Components/forms.md` is deleted after all content is redistributed.

---

## Per-File Template

Every component file follows this structure:

```markdown
# Component Name

One-line description. See `_foundations.md` for shared input styling and label convention.

---

## When to Use

- Use when: [scenario]
- Don't use when: [alternative is better]

## Variants

### Variant Name
**Classes:** (Tailwind class string)
**Use case:** (when this variant applies)
**TSX example:** (complete, copy-pasteable)

## States

| State | Border | Background | Text | Ring |
(inherited from foundations — only document overrides)

## Keyboard Interactions

| Key | Action |
(Tab, Enter, Escape, Arrow keys — whatever applies to this input type)

## Do / Don't

- DO: [guidance with rationale]
- DON'T: [anti-pattern with explanation]

## Accessibility

- [Label association, aria attributes, screen reader notes]

## Migration

| Current Pattern | Replace With | Found In |
(component-specific rows extracted from the master migration table)
```

Sections that don't apply to a component are omitted (e.g., toggle has no Migration section if no drift exists).

---

## File Contents

### 1. `_foundations.md`

**Source:** Current `forms.md` shared sections + new additions.

**Carries over verbatim:**
- Canonical input styling (class string + states table)
- Label convention (position, typography, color, spacing, required/disabled/error states)
- Layout rules (field spacing, field width, form sections)
- Validation (timing, field-level errors, form-level errors, help text, required fields)
- Shared primitives (FormField, FormSection, FormActions interfaces)
- Master migration table (complete — component files reference back here)
- File reference table

**New sections:**
- **Keyboard Foundations** — Global conventions: Tab/Shift+Tab between fields, Enter submits single-line inputs in single-field forms, focus order follows DOM order
- **Focus Management** — Focus ring convention (2px coral ring, `focus:ring-2 focus:ring-[#F37167] focus:border-transparent`), focus trap in modals (Tab cycles within modal), auto-focus first field on modal/panel open
- **Help Text** — `text-xs text-[#A69DC0] mt-1`, appears below input (or below error when both present), max 1-2 sentences

### 2. `text-input.md`

Covers: `<input type="text|email|url|tel|password|number">`

**When to use:** Single-line text entry. Use text for names/titles, email for email addresses (gets mobile keyboard), url for URLs, tel for phone (numeric keyboard), password for credentials, number for numeric-only values.

**Variants:**
- Standard text input (canonical class string)
- With icon prefix (search icon, etc.) — `pl-9` with icon positioned absolute left
- With character count — counter below input, `text-xs text-[#A69DC0]`

**Keyboard:**
| Key | Action |
|-----|--------|
| Tab | Move to next field |
| Shift+Tab | Move to previous field |
| Enter | Submit form (if single-line, within form context) |
| Ctrl+A | Select all text |

**Do/Don't:**
- DO use `type="email"` for email fields (triggers validation + mobile keyboard)
- DON'T use `type="number"` for values that happen to be digits but aren't quantities (zip codes, phone numbers) — use `type="text"` with `inputMode="numeric"`

**Accessibility:**
- Always pair with `<label htmlFor>`, use `aria-describedby` for help text/error, `aria-invalid="true"` on error

**Migration:** Extract text-input-relevant rows from master table.

### 3. `textarea.md`

Covers: `<textarea>` standard and compact.

**When to use:** Multi-line text entry — descriptions, notes, comments. Don't use for single-line values.

**Variants:**
- Standard: canonical class string + `resize-none`, default 3-4 rows
- Compact (panel forms): 2 rows, `space-y-3` context
- Notes editor (NotesEditor pattern): auto-expanding, blur to save

**Keyboard:**
| Key | Action |
|-----|--------|
| Enter | New line |
| Ctrl+Enter | Save (inline editing context only) |
| Tab | Move to next field (does NOT insert tab character) |
| Escape | Cancel edit (inline context) |

**Do/Don't:**
- DO set `resize-none` — textareas don't resize in Fullmind
- DON'T use textarea for single-line fields even if the value might be long — use text input

**Accessibility:**
- Use `aria-label` or visible label, set `rows` attribute for initial height hint

### 4. `select.md`

Covers: Native select, multi-select, combobox/search-select.

**When to use:**
- Native select: Choosing one option from a short list (< 7 items)
- Multi-select: Choosing multiple options (filter bars, tag selection)
- Combobox/search-select: Large option sets (> 7 items) where filtering helps

**Variants:**

#### Native Select
- Canonical class string (same as text input)
- Custom chevron: `appearance-none` with SVG chevron background or absolute-positioned icon

**Keyboard (native select):**
| Key | Action |
|-----|--------|
| Space / Enter | Open dropdown |
| Arrow Up/Down | Cycle through options |
| Home / End | Jump to first/last option |
| Type letter | Jump to first option starting with that letter |
| Escape | Close without selecting |
| Tab | Move to next field |

#### Multi-Select (Dropdown Checkbox List)
- Trigger button shows selected count or chip list
- Dropdown panel: `bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 max-h-60 overflow-y-auto`
- Each option: checkbox + label row with `hover:bg-[#EFEDF5]`
- Selected items displayed as chips: `inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]` with remove button

**Keyboard (multi-select):**
| Key | Action |
|-----|--------|
| Space / Enter | Open dropdown / toggle focused option |
| Arrow Up/Down | Navigate options |
| Escape | Close dropdown |
| Tab | Close dropdown, move to next field |

#### Combobox / Search-Select
- Text input + dropdown list, type to filter
- Dropdown shows filtered matches, highlights current selection
- Empty state: "No matches found" in muted text

**Keyboard (combobox):**
| Key | Action |
|-----|--------|
| Type | Filter options |
| Arrow Up/Down | Navigate filtered list |
| Enter | Select highlighted option |
| Escape | Close dropdown, clear filter |
| Tab | Accept current selection, move to next field |

**Do/Don't:**
- DO use native select for short lists — it's faster, accessible by default, and works on mobile
- DON'T build a custom dropdown when native select would suffice
- DO show a "Select..." placeholder option as first item (not a valid selection)
- DON'T use multi-select for mutually exclusive choices — use radio group instead

**Accessibility:**
- Native select: inherently accessible, just needs `<label htmlFor>`
- Multi-select: `role="listbox"`, `aria-multiselectable="true"`, `aria-expanded` on trigger
- Combobox: `role="combobox"`, `aria-autocomplete="list"`, `aria-activedescendant` for current highlight

### 5. `date-input.md`

Covers: Native date input, date range pairs.

**When to use:** Date selection — due dates, start/end dates, activity dates. Uses native `<input type="date">` (no custom date picker).

**Variants:**
- Single date: canonical class string with `type="date"`
- Date range pair: two date inputs side by side in `grid grid-cols-2 gap-3`, labels "Start Date" / "End Date"

**Keyboard:**
| Key | Action |
|-----|--------|
| Tab | Move between date segments (month/day/year) then to next field |
| Arrow Up/Down | Increment/decrement focused segment |
| Arrow Left/Right | Move between segments within the input |
| Enter | Open native date picker (browser-dependent) |
| Escape | Close date picker |

**Do/Don't:**
- DO use native date input — consistent, accessible, mobile-friendly
- DON'T add a custom date picker unless the native one proves insufficient for a specific use case
- DO validate that end date >= start date on blur for range pairs

**Accessibility:**
- Native date inputs are accessible by default, label with `<label htmlFor>`
- For date ranges, use `aria-describedby` to associate "Start Date" and "End Date" fields

### 6. `checkbox-and-radio.md`

Covers: Individual checkboxes, checkbox groups/lists, radio groups.

**When to use:**
- Checkbox: Boolean toggle (agree/disagree, enable/disable a sub-feature)
- Checkbox group: Select multiple from a list (link types in TaskFormModal, outcome options)
- Radio group: Select exactly one from a list (activity type, priority level)

**Variants:**

#### Individual Checkbox
- `rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]`
- Label to the right: `flex items-center gap-2`, label uses `text-sm text-[#403770]`

#### Checkbox Group
- Vertical list: `space-y-2` between items
- Each item: checkbox + label row
- Optional "Select All" at top

#### Radio Group
- Vertical: `space-y-2` between items
- Horizontal: `flex items-center gap-4` (for 2-3 short options only)
- Each item: `<input type="radio">` + label

**Keyboard:**
| Key | Action |
|-----|--------|
| Space | Toggle checkbox / select radio |
| Tab | Move to next field (exits group) |
| Arrow Up/Down | Move between radios in a group (native behavior) |
| Arrow Left/Right | Move between radios in a group (native behavior) |

**Do/Don't:**
- DO group related checkboxes with `<fieldset>` + `<legend>`
- DON'T use a checkbox for mutually exclusive options — use radio group
- DO use radio for 2-5 mutually exclusive options; for more, use select
- DON'T use a single radio button alone — always at least 2 options

**Accessibility:**
- Checkbox groups: wrap in `<fieldset>` with `<legend>` as group label
- Radio groups: same `<fieldset>` + `<legend>` pattern, use `name` attribute to group
- Individual checkbox: `<label>` wrapping both input and text, or `htmlFor`

### 7. `toggle.md`

Covers: Custom on/off switch component.

**When to use:** Binary settings that take effect immediately (no submit needed). Don't use for form fields that require a save action — use checkbox instead.

**Variants:**
- Standard: `w-8 h-[18px] rounded-full` track, `w-[14px] h-[14px] rounded-full bg-white shadow` thumb
  - Off: track `bg-[#C2BBD4]` (Border Strong)
  - On: track `bg-[#403770]` (Plum)
  - Transition: `transition-colors` on track, `transition-transform` on thumb

**States:**
| State | Track | Thumb |
|-------|-------|-------|
| Off | `bg-[#C2BBD4]` | Left position |
| On | `bg-[#403770]` | Right position (`translate-x-[14px]`) |
| Disabled Off | `bg-[#E2DEEC]` | Left, `opacity-50` |
| Disabled On | `bg-[#403770]/50` | Right, `opacity-50` |

**Keyboard:**
| Key | Action |
|-----|--------|
| Space | Toggle on/off |
| Enter | Toggle on/off |
| Tab | Move to next element |

**Do/Don't:**
- DO use toggle for immediate-effect settings (show/hide optional fields, enable layer)
- DON'T use toggle inside a form that has a submit button — use checkbox
- DO always pair with a visible label explaining what the toggle controls

**Accessibility:**
- Use `role="switch"` with `aria-checked="true|false"`
- Pair with visible `<label>` via `htmlFor` or wrapping

### 8. `currency-input.md`

Covers: Dollar-prefixed input for monetary values.

**When to use:** Budget, revenue, cost, or any monetary input field.

**Variants:**
- Standard: text input with `pl-7` (instead of `px-3`) to accommodate `$` prefix
- Prefix element: `absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0]` containing "$"

**TSX example:**
```tsx
<div className="relative">
  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm">$</span>
  <input
    type="text"
    inputMode="decimal"
    className="w-full pl-7 pr-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
    placeholder="0.00"
  />
</div>
```

**Keyboard:** Same as text input.

**Do/Don't:**
- DO use `inputMode="decimal"` (not `type="number"`) — avoids spinner arrows, gets numeric keyboard on mobile
- DON'T use `type="number"` — it allows `e`, `+`, `-` characters and shows spinner arrows
- DO format on blur (add commas, fix decimal places) rather than restricting input in real-time

**Accessibility:**
- `aria-label` or visible label should include "in dollars" or currency context
- Use `aria-describedby` pointing to help text for format guidance

### 9. `inline-editing.md`

**Source:** Current `forms.md` inline editing section, expanded.

Covers: Click-to-edit cells (InlineEditCell), quick-add (QuickAddTask), card editing (NotesEditor).

**When to use:** Quick single-value edits within tables, cards, or content blocks. Don't use for multi-field editing — use panel or modal form.

**Variants:**

#### Click-to-Edit Cell (InlineEditCell)
- Display: `cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30`
- Edit: canonical input + `ring-2 ring-[#403770]` (plum ring, not coral)
- Success flash: `bg-[#F7FFF2]` briefly after save

#### Quick-Add
- Persistent input at bottom of a list, Enter to create, Escape to clear
- Uses canonical input styling (coral focus ring — it's a form input, not an inline edit)

#### Card Editing (NotesEditor)
- Display-to-edit toggle within a card section
- Click to enter edit mode, blur/Ctrl+Enter to save, Escape to cancel

**Keyboard per input type:**
| Input Type | Save | Cancel |
|-----------|------|--------|
| Text | Blur or Enter | Escape |
| Date | Blur or Enter | Escape |
| Textarea | Blur or Ctrl+Enter | Escape |
| Select | Auto-save on change | Escape |

**Do/Don't:**
- DO auto-focus the input when entering edit mode
- DON'T use inline editing for fields that need validation feedback — use a form
- DO show a success flash after save to confirm the change registered
- DON'T use inline editing for sensitive fields (email, password)

**Accessibility:**
- `aria-label="Edit [field name]"` on the display-mode element
- Input gets focus immediately on entering edit mode
- Announce save/cancel to screen readers via `aria-live="polite"` region

### 10. `form-layouts.md`

**Source:** Current `forms.md` modal/panel form patterns + JSX skeletons.

Covers: Modal form layout, panel form layout, form section grouping, form action patterns.

**When to use:**
- Modal form: Creating/editing a record with multiple fields that needs focused attention
- Panel form: Creating/editing within map context without leaving the view
- Form sections: Grouping related fields with headings or collapsible regions

Carries the full JSX skeletons from the current spec, plus:
- **Form section grouping patterns** — heading style, collapsible wrapper, optional fields toggle
- **Responsive considerations** — modal max-width, panel form in narrow sidebar
- **Form action placement rules** — modal: sticky footer with border-t; panel: full-width button scrolls with content

---

## Paper Artboard Expansion

The existing Forms artboard (id: `1PX-1`, 1440x2222) already contains:
1. Input states (default/focus/error/disabled)
2. Modal form pattern
3. Panel form pattern
4. Inline editing pattern (display/edit/success)
5. Token reference strip

**New sections to add below existing content:**

### 6. Select & Multi-Select
- Native select: default state + open/expanded state
- Multi-select: trigger with chip display + open dropdown with checkboxes

### 7. Checkbox & Radio
- Vertical checkbox group (3 items, one checked)
- Horizontal radio group (3 options, one selected)

### 8. Toggle / Switch
- Off and on states side by side, with labels

### 9. Currency Input
- Showing the $ prefix positioning clearly

### 10. Textarea
- Standard (4 rows) and compact (2 rows) variants

### 11. Date Input & Range
- Single date input
- Start/End date pair in side-by-side layout

### 12. Keyboard Interaction Reference Card
- Compact table/card showing key mappings per input type
- Covers: Tab, Enter, Escape, Space, Arrow keys across text/select/checkbox/radio/toggle/inline-edit

The artboard height will need to increase to approximately 4500-5000px to accommodate the new sections.

---

## File Reference

| What | Where |
|------|-------|
| New docs folder | `Documentation/UI Framework/Components/Forms/` |
| Old single file (delete) | `Documentation/UI Framework/Components/forms.md` |
| Design tokens | `Documentation/UI Framework/tokens.md` |
| Original spec | `docs/superpowers/specs/2026-03-11-forms-component-guide-design.md` |
| Shared primitives | `src/features/shared/components/forms/` (recommended, not yet built) |
| Tag picker | `src/features/districts/components/TagsEditor.tsx` (multi-select-with-create variant, uses non-token colors — migration target) |
| Service selector | `src/features/plans/components/ServiceSelector.tsx` (checkbox group, uses Tailwind grays — migration target) |
| Goal setup modal | `src/features/goals/components/GoalSetupModal.tsx` (modal form with number input) |
| Paper artboard | "Forms" artboard in Mapomatic Design System, Components page |
