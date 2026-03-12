# Inline Editing

Click-to-edit patterns for single-value updates within tables, cards, and content blocks. Minimal chrome, optimized for speed. Not a replacement for forms — use a panel or modal when the edit involves multiple fields or needs validation feedback.

See `_foundations.md` for the canonical input class string, label convention, and focus ring specification.

---

## When to Use

| Scenario | Use |
|----------|-----|
| Editing one cell value in a table row | Inline editing (InlineEditCell) |
| Adding a single new item to a list | Quick-add (QuickAddTask) |
| Editing a text block within a card | Card editing (NotesEditor) |
| Editing two or more related fields together | Panel or modal form — not inline |
| Field that needs validation feedback | Panel or modal form — not inline |
| Sensitive fields (email, password) | Full form only — never inline |

**Rule of thumb:** one value, one click, one save. As soon as the interaction needs labels, validation messages, or multiple fields in concert, move to a form.

---

## Variants

### 1. Click-to-Edit Cell (InlineEditCell)

The primary inline editing pattern. Renders as styled text in display mode and flips to a focused input on click.

**Display mode** — `cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30`

The hover tint (Robin's Egg at 30% opacity) signals interactivity without an explicit edit icon.

```tsx
<span
  onClick={() => setEditing(true)}
  aria-label={`Edit ${fieldName}`}
  className="cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30 text-sm text-[#403770]"
>
  {value || <span className="text-[#A69DC0]">Click to edit</span>}
</span>
```

**Edit mode** — canonical input + `ring-2 ring-[#403770]` (plum ring, not coral)

The plum ring distinguishes inline editing from full form inputs, which use the coral focus ring. `autoFocus` is required — never skip it.

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

**Success flash** — `bg-[#F7FFF2]` briefly after save

After `handleSave` resolves, apply `bg-[#F7FFF2]` (Semantic Success bg) to the cell for ~600 ms, then fade back to the default background. This confirms the change registered without a toast.

**Full component sketch:**

```tsx
function InlineEditCell({ value, onSave, fieldName }: InlineEditCellProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value);
  const [flash, setFlash] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  function handleSave() {
    setEditing(false);
    onSave(draft);
    setFlash(true);
    setTimeout(() => setFlash(false), 600);
  }

  function handleCancel() {
    setDraft(value);
    setEditing(false);
  }

  if (editing) {
    return (
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
    );
  }

  return (
    <span
      onClick={() => setEditing(true)}
      aria-label={`Edit ${fieldName}`}
      className={`cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30 text-sm text-[#403770] transition-colors ${
        flash ? "bg-[#F7FFF2]" : ""
      }`}
    >
      {value || <span className="text-[#A69DC0]">Click to edit</span>}
    </span>
  );
}
```

---

### 2. Quick-Add (QuickAddTask)

A persistent input pinned to the bottom of a list. Enter creates the item and resets the field; Escape clears it without creating anything.

This is a form input (not an inline edit), so it uses the **coral focus ring** from the canonical class string — not the plum ring.

```tsx
<form
  onSubmit={(e) => {
    e.preventDefault();
    if (draft.trim()) {
      onCreate(draft.trim());
      setDraft("");
    }
  }}
>
  <input
    type="text"
    value={draft}
    onChange={(e) => setDraft(e.target.value)}
    onKeyDown={(e) => {
      if (e.key === "Escape") setDraft("");
    }}
    placeholder="Add a task…"
    aria-label="Add a task"
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  />
</form>
```

Key differences from InlineEditCell:

- Always visible — no display/edit toggle
- Coral focus ring (canonical form input, not an inline edit)
- `onSubmit` handles Enter via native form submission
- Escape clears the draft rather than restoring a previous value
- No success flash — the newly created item appearing in the list is the confirmation

---

### 3. Card Editing (NotesEditor)

Display-to-edit toggle within a card section. Clicking the display area enters edit mode; blur or Ctrl+Enter saves; Escape cancels and restores the previous value.

Uses a `<textarea>` rather than `<input>` because notes content is multi-line. The edit ring is plum (`ring-2 ring-[#403770]`) — same as InlineEditCell.

**Display mode:**

```tsx
<div
  onClick={() => setEditing(true)}
  aria-label="Edit notes"
  className="cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30 text-sm text-[#403770] min-h-[2rem] whitespace-pre-wrap"
>
  {value || <span className="text-[#A69DC0]">Add notes…</span>}
</div>
```

**Edit mode:**

```tsx
<textarea
  ref={textareaRef}
  value={draft}
  onChange={(e) => setDraft(e.target.value)}
  onBlur={handleSave}
  onKeyDown={(e) => {
    if (e.key === "Escape") handleCancel();
    if (e.key === "Enter" && e.ctrlKey) handleSave();
  }}
  rows={4}
  className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
    bg-white text-[#403770] placeholder:text-[#A69DC0]
    focus:outline-none ring-2 ring-[#403770] focus:border-transparent
    resize-none"
  autoFocus
/>
```

---

## Keyboard Interactions

| Input type | Save | Cancel |
|------------|------|--------|
| Text | Blur or Enter | Escape |
| Date | Blur or Enter | Escape |
| Textarea | Blur or Ctrl+Enter | Escape |
| Select | Auto-save on change | Escape |

Enter saves text and date inline edits because the single-line context makes accidental submission unlikely. Textarea uses Ctrl+Enter to save because Enter inserts a newline — pressing it should not accidentally commit the edit.

Select inputs auto-save on `onChange` — there is no ambiguous in-progress state, and a separate save step would feel slow.

---

## Do / Don't

- **DO** auto-focus the input when entering edit mode. Always include `autoFocus` on the rendered input. Without it, the user has no way to know where to type.
- **DON'T** use inline editing for fields that need validation feedback — use a full form panel or modal so the error message has a place to live.
- **DO** show a success flash (`bg-[#F7FFF2]`) after save to confirm the change registered, especially in dense tables where a toast would be disruptive.
- **DON'T** use inline editing for sensitive fields (email, password). These require the affordances of a full form: visible labels, autocomplete attributes, and sometimes help text or strength meters.
- **DO** restore the previous value on Escape. Cancel means "I changed my mind" — never leave the field in a half-edited state.
- **DON'T** apply the coral focus ring (`ring-[#F37167]`) to inline edit inputs. The plum ring (`ring-[#403770]`) is the visual signal that distinguishes inline editing from full form inputs.

---

## Accessibility

- Add `aria-label="Edit [field name]"` to the display-mode element so screen readers announce it as interactive.
- The input must receive focus immediately when edit mode is entered (`autoFocus`). Do not delay or animate focus onto the element.
- Announce save and cancel outcomes to screen readers via an `aria-live="polite"` region near the component:

  ```tsx
  <div aria-live="polite" className="sr-only">
    {liveMessage}
  </div>
  ```

  Set `liveMessage` to `"Saved"` after a successful save and `"Cancelled"` after a cancel. Clear the message after a short delay so it can be re-announced on the next interaction.

- Do not use `aria-label` as a substitute for a visible label in full-form contexts. `aria-label` on the display span is appropriate here because the visible value itself communicates the field's content.

---

## Codebase Examples

| Component | File |
|-----------|------|
| InlineEditCell | `src/features/shared/components/InlineEditCell.tsx` |
| QuickAddTask | `src/features/tasks/components/QuickAddTask.tsx` |
| NotesEditor | `src/features/districts/components/NotesEditor.tsx` |
