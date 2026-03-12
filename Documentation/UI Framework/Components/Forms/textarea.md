# Textarea

Multi-line text entry for the territory planner — covers `<textarea>` in standard and compact forms. See `_foundations.md` for the canonical class string, label convention, validation patterns, and focus ring specification.

---

## When to Use

Use `<textarea>` when the user needs to enter text that may span multiple lines — descriptions, notes, comments, and free-form narrative fields.

**Don't use** a textarea for single-line values. Even if the value might be long (a URL, an account name, a goal title), keep it in a `<input type="text">` — textarea implies multi-line intent and takes up unnecessary vertical space for short values.

---

## Variants

### Standard Textarea

The baseline for all multi-line text entry. Uses the canonical class string from `_foundations.md` with `resize-none` appended. Default 3–4 rows for modal forms.

**Classes:**
```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
resize-none
```

**Use case:** Plan descriptions, task notes, activity descriptions — anywhere the user writes more than a sentence in a modal form.

**TSX example:**
```tsx
<div>
  <label htmlFor="plan-description" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Description
  </label>
  <textarea
    id="plan-description"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="Describe the goals and scope of this plan..."
    rows={4}
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
      disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
      resize-none"
  />
</div>
```

**With required marker:**
```tsx
<div>
  <label htmlFor="activity-description" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Description <span className="text-[#F37167]">*</span>
  </label>
  <textarea
    id="activity-description"
    value={description}
    onChange={(e) => setDescription(e.target.value)}
    placeholder="What was accomplished in this activity?"
    rows={3}
    required
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
      resize-none"
  />
</div>
```

---

### Compact (Panel Forms)

Used inside right-panel forms where vertical space is tighter. Reduces to 2 rows and sits inside a `space-y-3` field stack. The class string is identical to the standard variant — only `rows` changes.

**Classes:**
```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
resize-none
```

**Use case:** Plan description in PlanEditForm, compact notes fields in any right-panel edit form. Use 2 rows — enough to show 2 lines of text without dominating the panel.

**TSX example:**
```tsx
{/* Inside a space-y-3 panel form */}
<div className="space-y-3">
  {/* ... other fields ... */}

  <div>
    <label htmlFor="description" className="block text-xs font-medium text-[#8A80A8] mb-1">
      Description
    </label>
    <textarea
      id="description"
      value={description}
      onChange={(e) => setDescription(e.target.value)}
      placeholder="Describe this plan..."
      rows={2}
      className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
        bg-white text-[#403770] placeholder:text-[#A69DC0]
        focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
        resize-none"
    />
  </div>
</div>
```

---

### Notes Editor (Display/Edit Toggle)

The `NotesEditor` pattern is used for inline panel sections where text is displayed as prose and only becomes an editable textarea when the user clicks "Edit". On save or cancel, it returns to display mode. This avoids cluttering the panel with always-visible edit controls.

**Use case:** District notes, plan annotations, any panel section where content is read more often than it is written.

**Behavior:**
- Display mode: prose text (`whitespace-pre-wrap`) or an italic placeholder if empty; an "Edit" link top-right enters edit mode
- Edit mode: textarea with Save / Cancel buttons below; Save is disabled until the value is dirty
- `Ctrl+Enter` saves from within the textarea (inline editing context)
- `Escape` cancels and restores the previous value

**TSX example:**
```tsx
function NotesSection({ leaid, edits }: { leaid: string; edits: DistrictEdits | null }) {
  const [notes, setNotes] = useState(edits?.notes || "");
  const [isEditing, setIsEditing] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const updateMutation = useUpdateDistrictEdits();

  const handleSave = async () => {
    await updateMutation.mutateAsync({ leaid, notes });
    setIsEditing(false);
    setIsDirty(false);
  };

  const handleCancel = () => {
    setNotes(edits?.notes || "");
    setIsEditing(false);
    setIsDirty(false);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
      e.preventDefault();
      if (isDirty) handleSave();
    }
    if (e.key === "Escape") {
      handleCancel();
    }
  };

  return (
    <div>
      <div className="flex justify-between items-center mb-3">
        <h3 className="text-sm font-bold text-[#403770]">Notes</h3>
        {!isEditing && (
          <button
            onClick={() => setIsEditing(true)}
            className="text-xs text-[#F37167] hover:text-[#403770] font-medium transition-colors"
          >
            Edit
          </button>
        )}
      </div>

      {isEditing ? (
        <div className="space-y-2">
          <textarea
            value={notes}
            onChange={(e) => { setNotes(e.target.value); setIsDirty(true); }}
            onKeyDown={handleKeyDown}
            placeholder="Add notes about this district..."
            rows={4}
            autoFocus
            aria-label="District notes"
            className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
              bg-white text-[#403770] placeholder:text-[#A69DC0]
              focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
              resize-none"
          />
          <div className="flex justify-end gap-2">
            <button
              onClick={handleCancel}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-[#403770]
                hover:bg-[#EFEDF5] rounded-lg transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!isDirty || updateMutation.isPending}
              className="inline-flex items-center px-3 py-1.5 text-xs font-medium text-white
                bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {updateMutation.isPending ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      ) : (
        <div>
          {notes ? (
            <p className="text-sm text-[#403770] whitespace-pre-wrap">{notes}</p>
          ) : (
            <p className="text-sm text-[#A69DC0] italic">No notes</p>
          )}
        </div>
      )}
    </div>
  );
}
```

---

## States

States are inherited from `_foundations.md`. Textareas use the same state tokens as text inputs.

| State | Border | Background | Text | Ring |
|-------|--------|------------|------|------|
| Default | `#C2BBD4` | `#FFFFFF` | `#403770` | — |
| Focus | transparent | `#FFFFFF` | `#403770` | Coral `#F37167` (2px) |
| Error | `#f58d85` | `#fef1f0` | `#403770` | — |
| Error + Focus | `#f58d85` | `#fef1f0` | `#403770` | Coral `#F37167` (2px) |
| Disabled | `#E2DEEC` | `#F7F5FA` | `#A69DC0` | — |

> No hover state — textareas have no hover effect. Focus ring on click/tab is sufficient.

**Error state TSX:**
```tsx
<div>
  <label htmlFor="task-notes" className="block text-xs font-medium text-[#f58d85] mb-1">
    Notes <span className="text-[#F37167]">*</span>
  </label>
  <textarea
    id="task-notes"
    value={notes}
    onChange={(e) => setNotes(e.target.value)}
    rows={3}
    aria-invalid="true"
    aria-describedby="task-notes-error"
    className="w-full px-3 py-2 text-sm border border-[#f58d85] rounded-lg
      bg-[#fef1f0] text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
      resize-none"
  />
  <p id="task-notes-error" className="text-xs text-[#F37167] mt-1">Notes are required</p>
</div>
```

---

## Keyboard Interactions

| Key | Action |
|-----|--------|
| `Enter` | Insert a new line |
| `Ctrl+Enter` / `Cmd+Enter` | Save (inline editing context only — Notes Editor pattern) |
| `Tab` | Move focus to the next field — does NOT insert a tab character |
| `Escape` | Cancel edit and restore previous value (inline editing context only) |
| `Shift+Tab` | Move focus to the previous field |

---

## Do / Don't

- **DO** always set `resize-none` — textareas do not resize in Fullmind. User-resizable textareas break panel layouts and modal height.
- **DON'T** use a textarea for single-line fields even if the value might be long. Long URLs, account names, and titles belong in `<input type="text">`. Use textarea only when multi-line content is genuinely expected.
- **DO** set the `rows` attribute to give the browser an initial height hint. Use `rows={4}` for modal forms and `rows={2}` for compact panel forms. Do not rely on CSS height alone — `rows` sets the intrinsic size before styles are applied.
- **DON'T** use `rows={1}` — that produces a single-line textarea, which looks like a text input but behaves differently (no `Enter`-to-submit). Use `<input type="text">` for single-line entry.

---

## Accessibility

- **Label pairing:** Always use `<label htmlFor="textarea-id">` pointing to the textarea's `id`. Never substitute a `placeholder` or `aria-label` alone for a visible label in a form context. In the Notes Editor pattern where no visible label is shown, add `aria-label` to the textarea.
- **`rows` attribute:** Set `rows` to reflect the expected content height. Screen readers and some assistive technologies use the intrinsic size to communicate field expectations to the user.
- **Error state:** Set `aria-invalid="true"` on the textarea when in error state. Connect the error message with `aria-describedby="error-id"` so screen readers announce the error when the field receives focus.
- **Help text:** If help text is present, connect it with `aria-describedby`. When both help text and error are shown, reference both ids: `aria-describedby="field-help field-error"`.
- **Required fields:** Add the `required` attribute alongside the visual `*` marker (see `_foundations.md` label convention). Implement field-level error messages — do not rely on native browser validation alone.
- **Keyboard shortcuts in Notes Editor:** The `Ctrl+Enter` save shortcut is a progressive enhancement. The Save button must remain visible and focusable so keyboard-only users who are unaware of the shortcut can still save.

---

## Codebase Examples

| Component | Usage | File |
|-----------|-------|------|
| PlanFormModal | Plan description, standard 4-row textarea | `src/features/plans/components/PlanFormModal.tsx` |
| TaskFormModal | Task notes, standard 3-row textarea | `src/features/tasks/components/TaskFormModal.tsx` |
| ActivityFormModal | Activity description, standard 3-row textarea | `src/features/activities/components/ActivityFormModal.tsx` |
| NotesEditor | District notes, display/edit toggle with Ctrl+Enter save | `src/features/districts/components/NotesEditor.tsx` |
| PlanEditForm | Plan description, compact 2-row panel textarea | `src/features/map/components/right-panels/PlanEditForm.tsx` |
