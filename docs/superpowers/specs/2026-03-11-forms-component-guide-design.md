# Forms Component Guide — Design Spec

**Date:** 2026-03-11
**Status:** Approved
**Deliverables:** `Documentation/UI Framework/Components/forms.md` + Paper "Forms" artboard

---

## Purpose

Create a canonical forms guide that standardizes form styling, layout, and structure across the Fullmind territory planning product. The codebase currently has ~42 files with form inputs using 3 competing styling approaches, none of which align with the plum-derived tokens defined in `tokens.md`. This guide will be the single source of truth for form implementation.

## Decisions Made

| Question | Decision | Rationale |
|----------|----------|-----------|
| Form types to document | All three (Modal, Panel, Inline) | Comprehensive coverage, similar to tables guide |
| Shared primitives approach | Document patterns + recommend primitives (not mandate) | Reduces copy-paste without blocking current work |
| Input styling | Token-aligned (Style C) | Only option using plum-derived tokens from tokens.md |
| Focus ring color | Coral (#F37167) | Matches tokens.md role: "Accents, primary badges, focus rings" |
| Label positioning | Stacked only (label above input) | Matches current codebase, EUI guidance, simplest to maintain |
| Shared primitives set | FormField, FormSection, FormActions | Covers the 3 most-repeated patterns across 40+ form files |

---

## Three Form Types

### 1. Modal Forms

Full-screen overlay dialogs for creating/editing entities (tasks, plans, goals, activities, outcomes).

**Structure:**
- Backdrop: `fixed inset-0 z-50`, `bg-[#403770]/40`
- Container: `bg-white rounded-xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col`
- Header: `px-6 py-4 border-b border-[#D4CFE2]` with title (`text-lg font-bold text-[#403770]`) and close button
- Body: `flex-1 overflow-y-auto px-6 py-4 space-y-4`
- Footer: `px-6 py-4 border-t border-[#D4CFE2]` with Cancel + Submit actions

**Current files:** TaskFormModal, GoalFormModal, PlanFormModal, ActivityFormModal, OutcomeModal

### 2. Panel Forms

Embedded in sidebar panels on the map view. Tighter spacing, no independent shadow (panel provides elevation).

**Structure:**
- Header: `px-3 py-2.5 border-b border-[#E2DEEC]` with back button and title
- Body: `flex-1 p-3 space-y-4 overflow-y-auto`
- Submit: Full-width button at bottom of scroll area (not a sticky footer)

**Current files:** AccountForm, PlanEditForm, TaskForm (right panel), PlanFormPanel

### 3. Inline Editing

Click-to-edit table cells. Minimal chrome, optimized for speed.

**Structure:**
- Display mode: `cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30`
- Edit mode: Input with `ring-2 ring-[#403770]` (plum, not coral — inline edit uses plum to indicate active cell context rather than form-level focus)
- Save: blur or Enter (text/date), Ctrl+Enter (textarea), auto-save on change (select)
- Cancel: Escape key
- Success flash: brief green-100 background

**Current files:** InlineEditCell

---

## Canonical Input Tokens

All three form types share the same base input styling. The only variation is inline editing uses plum ring instead of coral (contextual differentiation).

### States

| State | Border | Background | Text | Ring |
|-------|--------|------------|------|------|
| Default | Border Strong `#C2BBD4` | White `#FFFFFF` | Primary `#403770` | — |
| Hover | Border Strong `#C2BBD4` | White `#FFFFFF` | Primary `#403770` | — |
| Focus | transparent | White `#FFFFFF` | Primary `#403770` | Coral `#F37167` (2px) |
| Error | Semantic `#f58d85` | Semantic `#fef1f0` | Primary `#403770` | — |
| Error + Focus | Semantic `#f58d85` | Semantic `#fef1f0` | Primary `#403770` | Coral `#F37167` (2px) |
| Disabled | Border Subtle `#E2DEEC` | Surface Raised `#F7F5FA` | Muted `#A69DC0` | — |

### Tailwind Class String (canonical)

```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
```

### Input Types Covered

- Text input (`<input type="text">`)
- Email, URL, tel, number inputs
- Date input (`<input type="date">`)
- Password input
- Select (`<select>`)
- Textarea (`<textarea>` with `resize-none`)
- Checkbox (`rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]`)
- Custom toggle/switch (document the existing pattern from OutcomeModal)

---

## Label Convention

- **Position:** Always stacked (label above input)
- **Typography:** `text-xs font-medium` (Caption tier, 12px, weight 500)
- **Color:** Secondary `#8A80A8`
- **Spacing:** `mb-1` between label and input
- **Required marker:** `*` in Coral `#F37167` after label text
- **Disabled label:** Muted `#A69DC0`
- **Error label:** Semantic Error text `#f58d85`
- **Accessibility:** Always use `<label>` with `htmlFor` pointing to input `id`

---

## Layout Rules

### Field Spacing

- Between fields within a section: `space-y-4`
- Between sections: `space-y-6`
- Panel forms (compact): `space-y-3` within sections

### Field Width

- Single column by default — inputs span full width
- Side-by-side allowed for related pairs: `grid grid-cols-2 gap-3`
  - Examples: Start/End date, Status/Priority, City/State/ZIP
- Custom grid for address rows: `grid grid-cols-[1fr_60px_80px] gap-2`

### Form Sections

- Optional section heading: `text-xs font-semibold text-[#8A80A8] uppercase tracking-wide`
- Collapsible sections (like "Link To" in TaskFormModal): border wrapper with chevron toggle
- Optional fields: toggle with "Show/Hide optional fields" pattern (as in AccountForm)

---

## Validation

### Timing

- Validate on blur (not real-time keystroke validation)
- Submit button always active by default
- Errors display after first submit attempt or on field blur

### Field-Level Errors

- Error message: `text-xs text-[#F37167] mt-1` below the input
- Input border changes to `border-[#f58d85]`
- Input background changes to `bg-[#fef1f0]`
- Label color changes to `text-[#f58d85]`

### Form-Level Errors

- Error banner above form fields: `p-3 bg-[#fef1f0] border border-[#f58d85] rounded-lg text-sm text-[#F37167]`
- Used for server-side errors or cross-field validation

### Required Fields

- Mark with `*` in Coral after label text
- Client-side: prevent submit if empty, show field-level error
- No asterisk legend needed (convention: all fields required unless stated otherwise)

---

## Shared Primitives (Recommended)

Located in `src/features/shared/components/forms/`. These are recommended for new forms and gradual migration of existing forms. Not mandated — existing forms can continue working without them.

### FormField

Wraps a single form field with label, input slot, error message, and optional help text.

```tsx
interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  children: React.ReactNode;
}
```

Responsibilities:
- Renders label with correct styling and required marker
- Renders error message below input when present
- Renders optional help text (muted, below input or error)
- Applies error/disabled label color changes

### FormSection

Groups related fields with optional heading and correct spacing.

```tsx
interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean; // uses space-y-3 instead of space-y-4
}
```

### FormActions

The footer bar with Cancel + Submit buttons.

```tsx
interface FormActionsProps {
  onCancel: () => void;
  onSubmit?: () => void; // if not inside a <form>
  submitLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  variant?: "modal" | "panel"; // modal: border-t footer bar, panel: full-width button
}
```

---

## Buttons in Forms

### Primary (Submit)

- Modal: `px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50`
- Destructive submit (delete confirmation): `bg-[#F37167] hover:bg-[#e05f55]`
- Panel: Full-width `w-full py-2.5 bg-[#403770] text-white text-sm font-medium rounded-lg`
- Pending state: text changes to "Creating..." / "Saving...", `disabled:opacity-50`

### Secondary (Cancel)

- Modal: `px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770]` (ghost style)
- Panel: typically the back/close button in the header, not a separate cancel button

---

## Discrepancies to Resolve

The guide will document that the following patterns in existing code are non-conforming and should migrate:

| Current Pattern | Replace With |
|----------------|-------------|
| `border-gray-200`, `border-gray-300` | `border-[#C2BBD4]` (Border Strong) |
| `text-gray-500`, `text-gray-700` on labels | `text-[#8A80A8]` (Secondary) |
| `text-red-500` for required marker | `text-[#F37167]` (Coral) |
| `bg-gray-50` on inputs | `bg-white` |
| `rounded-xl` on inputs | `rounded-lg` |
| `focus:ring-[#403770]` on form inputs | `focus:ring-[#F37167]` (Coral) |
| `bg-red-50 border-red-200 text-red-600` errors | Semantic Error tokens |
| `text-gray-400` for placeholders | `placeholder:text-[#A69DC0]` (Muted) |
| `border-gray-100`, `border-gray-200` on modal dividers | `border-[#D4CFE2]` (Border Default) |

---

## Paper Artboard

A "Forms" artboard in the Paper file "mapopmatic" showing:

1. **Input states** — Default, Focus (coral ring), Error, Disabled side by side
2. **Sample modal form** — Based on TaskFormModal structure with canonical styling
3. **Sample panel form** — Based on AccountForm structure with canonical styling
4. **Inline edit pattern** — Display mode → edit mode → success flash
5. **Token reference strip** — Color swatches with hex values for quick designer reference

---

## File Reference

| What | Where |
|------|-------|
| Guide output | `Documentation/UI Framework/Components/forms.md` |
| Design tokens | `Documentation/UI Framework/tokens.md` |
| Shared primitives | `src/features/shared/components/forms/` (new) |
| Modal form examples | `src/features/tasks/components/TaskFormModal.tsx`, `src/features/goals/components/GoalFormModal.tsx`, `src/features/plans/components/PlanFormModal.tsx` |
| Panel form examples | `src/features/map/components/panels/AccountForm.tsx`, `src/features/map/components/right-panels/PlanEditForm.tsx` |
| Inline edit | `src/features/shared/components/InlineEditCell.tsx` |
