# Form Layouts

Layout patterns for the three form contexts: Modal, Panel, and Form Sections. See `_foundations.md` for shared input styling, validation, and label conventions.

---

## When to Use

- **Modal form:** Creating/editing a record with multiple fields that needs focused attention
- **Panel form:** Creating/editing within the map context without leaving the current view
- **Form sections:** Grouping related fields with headings or collapsible regions within either layout

---

## Modal Form Pattern

The canonical modal form structure for creating and editing entities. All modal forms follow this exact layout.

### Structure

- **Backdrop:** `fixed inset-0 z-40 bg-black/40` — separate element, z-40, click to close
- **Wrapper:** `fixed inset-0 z-50 flex items-center justify-center`
- **Container:** `bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col`
- **Header:** `px-6 py-4 border-b border-[#E2DEEC]` — title: `text-lg font-semibold text-[#403770]`, plus close button
- **Body:** `flex-1 overflow-y-auto px-6 py-4 space-y-4`
- **Footer:** `px-6 py-4 border-t border-[#E2DEEC] bg-[#F7F5FA] flex justify-end gap-3`

### Buttons

- **Submit:** `px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50`
- **Cancel:** `px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770]`
- **Destructive:** `bg-[#F37167] hover:bg-[#e05f55]`
- **Pending:** text changes to "Creating..." / "Saving...", `disabled:opacity-50`

### JSX Skeleton

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

{/* Modal wrapper */}
<div className="fixed inset-0 z-50 flex items-center justify-center">
  {/* Container */}
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">

    {/* Header */}
    <div className="px-6 py-4 border-b border-[#E2DEEC] flex items-center justify-between">
      <h2 className="text-lg font-semibold text-[#403770]">Create Task</h2>
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
    <div className="px-6 py-4 border-t border-[#E2DEEC] bg-[#F7F5FA] flex justify-end gap-3">
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

### Keyboard

| Key | Behavior |
|-----|----------|
| `Escape` | Close modal |
| `Tab` | Cycle through focusable elements within modal (focus trap) |
| `Enter` | Submit form |

### Codebase Examples

| Component | File |
|-----------|------|
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

Panel forms are embedded in sidebar panels on the map view. They use tighter spacing and have no independent shadow since the panel provides elevation.

### Structure

- **Header:** `px-3 py-2.5 border-b border-[#E2DEEC]` with back button and uppercase title (`text-xs font-medium text-[#8A80A8] uppercase tracking-wider`)
- **Body:** `flex-1 p-3 space-y-3 overflow-y-auto`
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
  <div className="flex-1 p-3 space-y-3 overflow-y-auto">
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

### Keyboard

| Key | Behavior |
|-----|----------|
| `Escape` | Navigate back (no trap) |
| `Tab` | Move between fields (no focus trap) |
| `Enter` | Submit form |

### Codebase Examples

| Component | File |
|-----------|------|
| AccountForm | `src/features/map/components/panels/AccountForm.tsx` |
| PlanEditForm | `src/features/map/components/right-panels/PlanEditForm.tsx` |
| TaskForm | `src/features/map/components/right-panels/TaskForm.tsx` |
| ActivityForm | `src/features/map/components/right-panels/ActivityForm.tsx` |
| PlanFormPanel | `src/features/map/components/panels/PlanFormPanel.tsx` |

---

## Form Section Patterns

Use sections to group related fields within either modal or panel forms.

### Section Heading

```
text-xs font-semibold text-[#8A80A8] uppercase tracking-wider
```

### Collapsible Sections

A bordered wrapper with a chevron toggle — used for optional or advanced groupings. Example: the "Link To" section in TaskFormModal.

```tsx
<div className="border border-[#E2DEEC] rounded-lg overflow-hidden">
  <button
    type="button"
    onClick={() => setOpen(!open)}
    className="w-full px-4 py-2.5 flex items-center justify-between text-xs font-semibold text-[#8A80A8] uppercase tracking-wider hover:bg-[#F7F5FA]"
  >
    Link To
    <svg
      className={`w-4 h-4 transition-transform ${open ? "rotate-180" : ""}`}
      viewBox="0 0 20 20"
      fill="currentColor"
    >
      <path fillRule="evenodd" d="M5.23 7.21a.75.75 0 011.06.02L10 11.17l3.71-3.94a.75.75 0 111.08 1.04l-4.25 4.5a.75.75 0 01-1.08 0l-4.25-4.5a.75.75 0 01.02-1.06z" clipRule="evenodd" />
    </svg>
  </button>
  {open && (
    <div className="px-4 pb-4 pt-2 space-y-3 border-t border-[#E2DEEC]">
      {/* Optional fields */}
    </div>
  )}
</div>
```

### Optional Fields Toggle

A "Show / Hide optional fields" link pattern used in panel forms (e.g., AccountForm) to surface secondary fields on demand.

```tsx
<button
  type="button"
  onClick={() => setShowOptional(!showOptional)}
  className="text-xs text-[#8A80A8] hover:text-[#403770] underline"
>
  {showOptional ? "Hide optional fields" : "Show optional fields"}
</button>

{showOptional && (
  <div className="space-y-3">
    {/* Secondary fields */}
  </div>
)}
```

---

## Do / Don't

- **DO** use modal for focused multi-field workflows
- **DON'T** use modal for single-field edits — use inline editing instead
- **DO** use panel for map-context editing
- **DON'T** nest a modal inside a panel
- **DO** put destructive actions on the left, and cancel/submit on the right in modal footers

---

## Accessibility

- **Modal:** `role="dialog"`, `aria-labelledby` pointing to the title `id`, `aria-modal="true"`, focus trap active while open
- **Panel:** No special role needed — it is part of the page layout
- **Footer buttons:** Submit button uses `type="submit"`, cancel button uses `type="button"`
