# Form Component Guide

Standard styling for all forms in the territory planner. Three form types cover every use case. All patterns use the Fullmind design token system (`tokens.md`).

## Form Types

### Modal Forms

Full-screen overlay dialogs for creating/editing entities.

**Use when:** Creating or editing a record that needs focused attention and has multiple fields.

**Features:** Backdrop overlay, scrollable body, sticky header/footer, Cancel + Submit actions.

**Examples in codebase:** TaskFormModal, GoalFormModal, GoalEditorModal, PlanFormModal, ActivityFormModal, OutcomeModal, DistrictTargetEditor.

### Panel Forms

Embedded in sidebar panels on the map view.

**Use when:** Creating or editing within the map context without leaving the current view.

**Features:** Back button header, tighter spacing, full-width submit, optional field toggle.

**Examples in codebase:** AccountForm, PlanEditForm, TaskForm (right panel), ActivityForm (right panel), PlanFormPanel.

### Inline Editing

Click-to-edit cells and card sections.

**Use when:** Quick edits to a single value within a table row, card, or content block.

**Features:** Display-to-edit toggle, save on blur/Enter, Escape to cancel, success flash, quick-add variant.

**Examples in codebase:** InlineEditCell, QuickAddTask, NotesEditor.

---

## Shared Foundations

### Canonical Input Styling

All three form types share the same base input styling. The only variation is inline editing, which uses a plum ring instead of coral for contextual differentiation.

#### Tailwind Class String

```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
```

#### States

| State         | Border                    | Background              | Text                  | Ring                    |
|---------------|---------------------------|-------------------------|-----------------------|-------------------------|
| Default       | Border Strong `#C2BBD4`   | White `#FFFFFF`         | Primary `#403770`     | —                       |
| Focus         | transparent               | White `#FFFFFF`         | Primary `#403770`     | Coral `#F37167` (2px)   |
| Error         | Semantic `#f58d85`        | Semantic `#fef1f0`      | Primary `#403770`     | —                       |
| Error + Focus | Semantic `#f58d85`        | Semantic `#fef1f0`      | Primary `#403770`     | Coral `#F37167` (2px)   |
| Disabled      | Border Subtle `#E2DEEC`   | Surface Raised `#F7F5FA`| Muted `#A69DC0`       | —                       |

> **Note:** No hover state — inputs have no hover effect. The focus ring on click/tab is sufficient.

#### Input Types Covered

- **Text input** — `<input type="text">`
- **Email, URL, tel, number inputs** — same canonical class string
- **Date input** — `<input type="date">`
- **Password input** — same canonical class string
- **Select** — `<select>` with same canonical class string
- **Textarea** — `<textarea>` with `resize-none`
- **Checkbox** — `rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]`
- **Currency-prefixed input** — Use `pl-7` instead of `px-3` to accommodate the `$` prefix element positioned `absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0]`
- **Custom toggle/switch** — `w-8 h-[18px] rounded-full` track, `w-[14px] h-[14px] rounded-full bg-white shadow` thumb. Off: `bg-[#C2BBD4]` (Border Strong). On: `bg-[#403770]` (Plum). Transition: `transition-colors` on track, `transition-transform` on thumb.

---

## Label Convention

- **Position:** Always stacked (label above input)
- **Typography:** `text-xs font-medium` (Caption tier, 12px, weight 500). Use `font-semibold` only for section headings, not field labels.
- **Color:** Secondary `#8A80A8` → `text-[#8A80A8]`
- **Spacing:** `mb-1` between label and input
- **Required marker:** `*` in Coral `#F37167` after label text → `text-[#F37167]`
- **Disabled state:** label color changes to Muted `#A69DC0`
- **Error state:** label color changes to Semantic Error text `#f58d85` (the lighter semantic value — distinct from error *message* text which uses Coral Strong `#F37167`)
- **Accessibility:** always use `<label>` with `htmlFor` pointing to input `id`

```tsx
<label htmlFor="plan-name" className="block text-xs font-medium text-[#8A80A8] mb-1">
  Plan Name <span className="text-[#F37167]">*</span>
</label>
```

---

## Layout Rules

### Field Spacing

- Between fields within a section: `space-y-4`
- Between sections: `space-y-6`
- Panel forms (compact): `space-y-3` within sections

### Field Width

- Single column by default — inputs span full width
- Side-by-side for related pairs: `grid grid-cols-2 gap-3` (Start/End date, Status/Priority)
- Custom grid for address rows: `grid grid-cols-[1fr_60px_80px] gap-2`

### Form Sections

- Section heading: `text-xs font-semibold text-[#8A80A8] uppercase tracking-wider`
- Collapsible sections: border wrapper with chevron toggle
- Optional fields: "Show/Hide optional fields" toggle pattern

---

## Validation

### Timing

- Validate on blur, not real-time
- Submit button always active by default
- Errors display after first submit attempt or on field blur

### Field-Level Errors

- Error message: `text-xs text-[#F37167] mt-1` below input
- Input border: `border-[#f58d85]`
- Input background: `bg-[#fef1f0]`
- Label color: `text-[#f58d85]`

```tsx
<div>
  <label htmlFor="plan-name" className="block text-xs font-medium text-[#f58d85] mb-1">
    Plan Name <span className="text-[#F37167]">*</span>
  </label>
  <input
    id="plan-name"
    type="text"
    className="w-full px-3 py-2 text-sm border border-[#f58d85] rounded-lg
      bg-[#fef1f0] text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  />
  <p className="text-xs text-[#F37167] mt-1">Plan name is required</p>
</div>
```

### Form-Level Errors

- Banner: `p-3 bg-[#fef1f0] border border-[#f58d85] rounded-lg text-sm text-[#F37167]`
- Position: above form fields
- Use for: server-side errors, cross-field validation

### Help Text

- Style: `text-xs text-[#A69DC0] mt-1`
- Position: below input (or below error message when both present)

### Required Fields

- Mark with `*` in Coral after label text
- Client-side: prevent submit if empty, show field-level error
- No asterisk legend needed (convention: all fields required unless stated otherwise)

---

## Modal Form Pattern

The canonical modal form structure for creating and editing entities. All modals follow this exact layout.

### Structure

- **Backdrop:** `fixed inset-0 z-50 bg-[#403770]/40`
- **Container:** `bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col`
- **Header:** `px-6 py-4 border-b border-[#D4CFE2]` — title uses `text-lg font-bold text-[#403770]`, plus a close button
- **Body:** `flex-1 overflow-y-auto px-6 py-4 space-y-4`
- **Footer:** `px-6 py-4 border-t border-[#D4CFE2] bg-[#F7F5FA]`

### Buttons

- **Submit:** `px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50`
- **Cancel:** `px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770]`
- **Destructive:** `bg-[#F37167] hover:bg-[#e05f55]`
- **Pending:** text changes to "Creating..." / "Saving...", `disabled:opacity-50`

### JSX Skeleton

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-50 flex items-center justify-center bg-[#403770]/40">
  {/* Container */}
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">

    {/* Header */}
    <div className="px-6 py-4 border-b border-[#D4CFE2] flex items-center justify-between">
      <h2 className="text-lg font-bold text-[#403770]">Create Task</h2>
      <button
        onClick={onClose}
        className="text-[#A69DC0] hover:text-[#403770]"
      >
        ✕
      </button>
    </div>

    {/* Body */}
    <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
      {/* FormField slots */}
      <div>
        <label htmlFor="field-1" className="block text-xs font-medium text-[#8A80A8] mb-1">
          Field Label <span className="text-[#F37167]">*</span>
        </label>
        <input
          id="field-1"
          type="text"
          className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
            bg-white text-[#403770] placeholder:text-[#A69DC0]
            focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
      </div>

      <div>
        <label htmlFor="field-2" className="block text-xs font-medium text-[#8A80A8] mb-1">
          Another Field
        </label>
        <select
          id="field-2"
          className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
            bg-white text-[#403770]
            focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        >
          <option>Option A</option>
          <option>Option B</option>
        </select>
      </div>
    </div>

    {/* Footer */}
    <div className="px-6 py-4 border-t border-[#D4CFE2] bg-[#F7F5FA] flex justify-end gap-3">
      <button
        type="button"
        onClick={onClose}
        className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770]"
      >
        Cancel
      </button>
      <button
        type="submit"
        disabled={isPending}
        className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50"
      >
        {isPending ? "Creating..." : "Create Task"}
      </button>
    </div>

  </div>
</div>
```

---

## Panel Form Pattern

Panel forms are embedded in sidebar panels on the map view. They use tighter spacing and have no independent shadow since the panel provides elevation.

### Structure

- **Header:** `px-3 py-2.5 border-b border-[#E2DEEC]` with back button and uppercase title (`text-xs font-medium text-[#8A80A8] uppercase tracking-wider`)
- **Body:** `flex-1 p-3 space-y-4 overflow-y-auto`
- **Submit:** `w-full py-2.5 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#403770]/90`
- **No sticky footer** — the submit button scrolls with content
- **Optional fields toggle:** "Show/Hide optional fields" pattern for secondary fields

### JSX Skeleton

```tsx
<div className="flex flex-col h-full">

  {/* Header */}
  <div className="px-3 py-2.5 border-b border-[#E2DEEC] flex items-center gap-2">
    <button onClick={onBack} className="text-[#A69DC0] hover:text-[#403770]">
      ← Back
    </button>
    <h3 className="text-xs font-medium text-[#8A80A8] uppercase tracking-wider">
      Edit Account
    </h3>
  </div>

  {/* Body */}
  <div className="flex-1 p-3 space-y-4 overflow-y-auto">
    {/* FormField slots */}
    <div>
      <label htmlFor="panel-field-1" className="block text-xs font-medium text-[#8A80A8] mb-1">
        Account Name <span className="text-[#F37167]">*</span>
      </label>
      <input
        id="panel-field-1"
        type="text"
        className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
          bg-white text-[#403770] placeholder:text-[#A69DC0]
          focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      />
    </div>

    <div>
      <label htmlFor="panel-field-2" className="block text-xs font-medium text-[#8A80A8] mb-1">
        Region
      </label>
      <select
        id="panel-field-2"
        className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
          bg-white text-[#403770]
          focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      >
        <option>Northeast</option>
        <option>Southeast</option>
      </select>
    </div>

    {/* Submit scrolls with content */}
    <button
      type="submit"
      disabled={isPending}
      className="w-full py-2.5 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#403770]/90 disabled:opacity-50"
    >
      {isPending ? "Saving..." : "Save Changes"}
    </button>
  </div>

</div>
```

---

## Inline Editing Pattern

Click-to-edit cells and card sections. Minimal chrome, optimized for speed. Uses plum ring (not coral) for contextual differentiation from full form inputs.

### States

- **Display mode:** `cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30`
- **Edit mode:** `border border-[#C2BBD4] ring-2 ring-[#403770]` (plum ring — not coral — for inline context differentiation)
- **Success flash:** `bg-[#F7FFF2]` (Semantic Success bg)

### Keyboard Interactions

| Input Type | Save | Cancel |
|-----------|------|--------|
| Text | blur or Enter | Escape |
| Date | blur or Enter | Escape |
| Textarea | blur or Ctrl+Enter | Escape |
| Select | auto-save on change | Escape |

### Variants

- **Quick-add:** Single-field create pattern, Enter to save, Escape to cancel. Uses same canonical input styling.
- **Click-to-edit card:** Display-to-edit toggle within a card section (not a table cell). Same save/cancel behavior as inline cells.

### JSX Examples

**Display mode:**

```tsx
<span
  onClick={() => setEditing(true)}
  className="cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30 text-sm text-[#403770]"
>
  {value || <span className="text-[#A69DC0]">Click to edit</span>}
</span>
```

**Edit mode:**

```tsx
<input
  ref={inputRef}
  type="text"
  value={draft}
  onChange={(e) => setDraft(e.target.value)}
  onBlur={handleSave}
  onKeyDown={(e) => {
    if (e.key === "Enter") handleSave();
    if (e.key === "Escape") handleCancel();
  }}
  className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
    bg-white text-[#403770] placeholder:text-[#A69DC0]
    focus:outline-none ring-2 ring-[#403770] focus:border-transparent"
  autoFocus
/>
```

---

## Shared Primitives (Recommended)

Located in `src/features/shared/components/forms/`. These are recommended for new forms and gradual migration of existing forms. Not mandated — existing forms can continue working without them.

### FormField

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

**Responsibilities:**

- Renders label with correct styling and required marker
- Renders error message below input when present
- Renders help text: `text-xs text-[#A69DC0] mt-1`
- Applies error/disabled label color changes

### FormSection

```tsx
interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean; // uses space-y-3 instead of space-y-4
}
```

### FormActions

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

## Migration Guide

Existing forms should migrate to these patterns when next modified. The following patterns in existing code are non-conforming:

| Current Pattern | Replace With | Found In |
|----------------|-------------|----------|
| `border-gray-200`, `border-gray-300` | `border-[#C2BBD4]` (Border Strong) | TaskFormModal, GoalFormModal, PlanFormModal, OutcomeModal |
| `border-gray-200/60` | `border-[#C2BBD4]` (Border Strong) | AccountForm |
| `text-gray-500`, `text-gray-700` on labels | `text-[#8A80A8]` (Secondary) | PlanFormModal, GoalFormModal, DistrictTargetEditor |
| `text-xs font-semibold` on field labels | `text-xs font-medium` | TaskFormModal, OutcomeModal |
| `text-red-500` for required marker | `text-[#F37167]` (Coral) | PlanFormModal |
| `bg-gray-50` on inputs | `bg-white` | AccountForm |
| `rounded-xl` on inputs | `rounded-lg` | AccountForm |
| `rounded-md` on inputs | `rounded-lg` | NotesEditor |
| `rounded-xl` on modal containers | `rounded-2xl` | All modal forms |
| `focus:ring-[#403770]` on form inputs | `focus:ring-[#F37167]` (Coral) | GoalFormModal, GoalEditorModal, PlanFormModal, DistrictTargetEditor |
| `focus:ring-plum/20 focus:border-plum/30` | `focus:ring-2 focus:ring-[#F37167] focus:border-transparent` | AccountForm |
| `focus:ring-[#F37167]/30 focus:border-[#F37167]` | `focus:ring-2 focus:ring-[#F37167] focus:border-transparent` | OutcomeModal |
| `focus:ring-0` (no focus ring) | `focus:ring-2 focus:ring-[#F37167]` | TaskForm (right panel), ActivityForm (right panel) |
| `text-[10px]` labels | `text-xs` (12px) | TaskForm (right panel), ActivityForm (right panel) |
| `bg-gray-800` submit buttons | `bg-[#403770]` (Plum) | TaskForm (right panel), ActivityForm (right panel) |
| `bg-red-50 border-red-200 text-red-600` errors | Semantic Error tokens (`#fef1f0` / `#f58d85` / `#F37167`) | GoalFormModal, PlanFormModal, AccountForm, login page |
| `text-gray-400` for placeholders | `placeholder:text-[#A69DC0]` (Muted) | Multiple files |
| `bg-black/40`, `bg-black/50` backdrops | `bg-[#403770]/40` | TaskFormModal, OutcomeModal, PlanFormModal, DistrictTargetEditor |
| `border-gray-100` on dividers | `border-[#E2DEEC]` (Border Subtle) for inner dividers, `border-[#D4CFE2]` (Border Default) for section dividers | Multiple files |
| `bg-gray-300` toggle off state | `bg-[#C2BBD4]` (Border Strong) | OutcomeModal |

---

## File Reference

| What | Where |
|------|-------|
| Guide output | `Documentation/UI Framework/Components/forms.md` |
| Design tokens | `Documentation/UI Framework/tokens.md` |
| Shared primitives | `src/features/shared/components/forms/` (new) |
| Modal form examples | `src/features/tasks/components/TaskFormModal.tsx`, `src/features/goals/components/GoalFormModal.tsx`, `src/features/goals/components/GoalEditorModal.tsx`, `src/features/plans/components/PlanFormModal.tsx`, `src/features/plans/components/DistrictTargetEditor.tsx`, `src/features/activities/components/ActivityFormModal.tsx`, `src/features/activities/components/OutcomeModal.tsx` |
| Panel form examples | `src/features/map/components/panels/AccountForm.tsx`, `src/features/map/components/right-panels/PlanEditForm.tsx`, `src/features/map/components/right-panels/TaskForm.tsx`, `src/features/map/components/right-panels/ActivityForm.tsx`, `src/features/map/components/panels/PlanFormPanel.tsx` |
| Inline edit | `src/features/shared/components/InlineEditCell.tsx`, `src/features/tasks/components/QuickAddTask.tsx`, `src/features/districts/components/NotesEditor.tsx` |
| Login form | `src/app/login/page.tsx` |
