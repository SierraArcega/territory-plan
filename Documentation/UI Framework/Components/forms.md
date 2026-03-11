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
