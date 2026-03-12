# Modal

Focused overlay for forms, confirmations, and detail views. Blocks page interaction.

See `_foundations.md` for shared styling foundations (backdrop, close button, dismiss behavior, header pattern).

---

## When to Use

- Use when the user needs to focus on a form or confirmation without distraction
- Use for create/edit workflows that need multiple fields
- Don't use when content can stay in context (use [Panel](panel.md) or [Flyout](flyout.md) instead)
- Don't use for small contextual info (use [Popover](popover.md) instead)

## Canonical Styling

Wrapper:
```
fixed inset-0 z-50 flex items-center justify-center
```

Content:
```
bg-white rounded-2xl shadow-xl w-full max-w-{size} mx-4 max-h-[85vh] flex flex-col
```

## Anatomy

```tsx
{/* Backdrop */}
<div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

{/* Modal wrapper */}
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col">
    {/* Header */}
    <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
      <h2 className="text-lg font-semibold text-[#403770]">Modal Title</h2>
      {/* Standard close button — see _foundations.md */}
    </div>

    {/* Body (scrollable) */}
    <div className="p-6 overflow-y-auto">
      {/* Modal content */}
    </div>

    {/* Footer */}
    <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2DEEC]">
      <button className="px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors">
        Save
      </button>
    </div>
  </div>
</div>
```

## Variants

### Size Variants

| Size | Class | Use case |
|------|-------|----------|
| Small | `max-w-sm` | Confirmation dialogs |
| Medium | `max-w-md` | Standard forms |
| Large | `max-w-lg` | Complex forms with many fields |

### Confirmation Dialog

No header/footer split — single content area:

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/40" onClick={onCancel} />
  <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
    <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Item?</h3>
    <p className="text-sm text-[#6E6390] mb-6">
      Are you sure? This action cannot be undone.
    </p>
    <div className="flex justify-end gap-3">
      <button className="px-4 py-2 text-sm font-medium text-[#544A78] hover:bg-[#EFEDF5] rounded-lg transition-colors">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] hover:bg-[#F37167]/90 rounded-lg transition-colors">
        Delete
      </button>
    </div>
  </div>
</div>
```

## States

| State | Visual |
|-------|--------|
| Default | Centered overlay with backdrop |
| Loading (submit) | Submit button shows spinner, disabled — see `Navigation/buttons.md` loading state |

## Keyboard

- `Escape` closes the modal
- `Tab` cycles through focusable elements within the modal
- Click on backdrop closes the modal

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| PlanFormModal | `src/features/plans/components/PlanFormModal.tsx` | `rounded-xl shadow-2xl bg-black/50` — should be `rounded-2xl shadow-xl bg-black/40` |
| TaskFormModal | `src/features/tasks/components/TaskFormModal.tsx` | `rounded-xl` — should be `rounded-2xl` |
| ActivityFormModal | `src/features/activities/components/ActivityFormModal.tsx` | `rounded-xl` — should be `rounded-2xl` |
| GoalFormModal | `src/features/goals/components/GoalFormModal.tsx` | Audit needed |
| OutcomeModal | `src/features/activities/components/OutcomeModal.tsx` | `rounded-xl` — should be `rounded-2xl` |
