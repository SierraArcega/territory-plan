# Checkbox and Radio

Boolean toggles and mutually exclusive selection controls for the territory planner — covers individual checkboxes, checkbox groups, and radio groups. See `_foundations.md` for label convention, validation patterns, and focus ring specification.

---

## When to Use

| Variant | When to use |
|---------|-------------|
| Individual checkbox | Boolean toggle — agree/disagree, enable/disable a sub-feature, mark a task complete |
| Checkbox group | Select zero or more from a list — link types in TaskFormModal, outcome options, feature flags |
| Radio group | Select exactly one from a list — activity type, priority level, status |

**Don't** use a checkbox for mutually exclusive options — use a radio group so users understand only one value can be active at a time.

**Don't** use a single radio button alone — a radio must always appear with at least one other option in the same group. A single binary option should be a checkbox instead.

**Don't** use a radio group when the list exceeds ~5 options — use a native `<select>` instead (see `select.md`) so the UI doesn't grow unwieldy.

---

## Variants

### Individual Checkbox

A single checkbox paired with a label to its right. The Tailwind `accent-color` utilities (`text-[#403770]`) color the checked/indeterminate fill via Tailwind Forms plugin; `focus:ring-[#F37167]` gives the Coral focus ring.

**Classes (input):**
```
rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]
disabled:cursor-not-allowed disabled:opacity-50
```

**Label row wrapper:**
```
flex items-center gap-2
```

**Label text:**
```
text-sm text-[#403770]
```

**Use case:** Agreeing to terms, enabling a notification, toggling a single boolean setting on a detail panel.

**TSX example:**
```tsx
<label className="flex items-center gap-2">
  <input
    type="checkbox"
    checked={agreedToTerms}
    onChange={(e) => setAgreedToTerms(e.target.checked)}
    className="rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]
      disabled:cursor-not-allowed disabled:opacity-50"
  />
  <span className="text-sm text-[#403770]">
    I agree to the terms and conditions
  </span>
</label>
```

**With `htmlFor` (when label must be separate from input):**
```tsx
<div className="flex items-center gap-2">
  <input
    id="notify-owner"
    type="checkbox"
    checked={notifyOwner}
    onChange={(e) => setNotifyOwner(e.target.checked)}
    className="rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]"
  />
  <label htmlFor="notify-owner" className="text-sm text-[#403770]">
    Notify plan owner on save
  </label>
</div>
```

---

### Checkbox Group

A vertical list of checkbox + label rows wrapped in a `<fieldset>`. The `<legend>` serves as the group label announced by screen readers. An optional "Select All" row at the top controls all items.

**Fieldset:** no border; `space-y-2` between items.

**Each row:** same `flex items-center gap-2` pattern as individual checkbox.

**Legend classes:**
```
block text-xs font-medium text-[#8A80A8] mb-2
```

**"Select All" row** (optional, rendered before the item list): same row pattern; use an indeterminate state when some but not all items are checked.

**Use case:** Selecting link types (TaskFormModal), choosing outcome categories, enabling multiple feature options.

**TSX example:**
```tsx
const LINK_TYPE_OPTIONS = [
  { value: "resource", label: "Resource" },
  { value: "reference", label: "Reference" },
  { value: "evidence", label: "Evidence" },
  { value: "template", label: "Template" },
] as const;

function LinkTypeGroup({
  selected,
  onChange,
}: {
  selected: string[];
  onChange: (values: string[]) => void;
}) {
  const allChecked = selected.length === LINK_TYPE_OPTIONS.length;
  const someChecked = selected.length > 0 && !allChecked;

  const toggleAll = () => {
    onChange(allChecked ? [] : LINK_TYPE_OPTIONS.map((o) => o.value));
  };

  const toggle = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  return (
    <fieldset>
      <legend className="block text-xs font-medium text-[#8A80A8] mb-2">
        Link Types
      </legend>

      {/* Select All */}
      <label className="flex items-center gap-2 mb-3">
        <input
          type="checkbox"
          checked={allChecked}
          ref={(el) => {
            if (el) el.indeterminate = someChecked;
          }}
          onChange={toggleAll}
          className="rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]"
        />
        <span className="text-sm font-medium text-[#403770]">Select all</span>
      </label>

      <div className="space-y-2">
        {LINK_TYPE_OPTIONS.map((option) => (
          <label key={option.value} className="flex items-center gap-2">
            <input
              type="checkbox"
              value={option.value}
              checked={selected.includes(option.value)}
              onChange={() => toggle(option.value)}
              className="rounded border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]"
            />
            <span className="text-sm text-[#403770]">{option.label}</span>
          </label>
        ))}
      </div>
    </fieldset>
  );
}
```

---

### Radio Group

A vertical or horizontal list of radio inputs sharing the same `name` attribute, wrapped in a `<fieldset>` + `<legend>`. Use vertical layout by default; horizontal layout is acceptable only for 2–3 short options where labels fit on one line.

**Vertical layout (default):** `space-y-2` between items.

**Horizontal layout:** `flex items-center gap-4` on the item container.

**Each item:** same `flex items-center gap-2` row as checkbox; `<input type="radio">` with `name` and `value`.

**Radio input classes:**
```
border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]
disabled:cursor-not-allowed disabled:opacity-50
```

**Use case (vertical):** Activity type selection, priority level, status — any exclusive choice with 3–5 options or options with longer labels.

**Use case (horizontal):** Yes/No, Yes/No/Maybe, or two short status values where labels are single words.

**TSX example — vertical:**
```tsx
const ACTIVITY_TYPES = [
  { value: "meeting", label: "Meeting" },
  { value: "visit", label: "Site Visit" },
  { value: "pd", label: "Professional Development" },
  { value: "demo", label: "Product Demo" },
  { value: "other", label: "Other" },
] as const;

<fieldset>
  <legend className="block text-xs font-medium text-[#8A80A8] mb-2">
    Activity Type <span className="text-[#F37167]">*</span>
  </legend>
  <div className="space-y-2">
    {ACTIVITY_TYPES.map((option) => (
      <label key={option.value} className="flex items-center gap-2">
        <input
          type="radio"
          name="activity-type"
          value={option.value}
          checked={activityType === option.value}
          onChange={() => setActivityType(option.value)}
          className="border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]"
        />
        <span className="text-sm text-[#403770]">{option.label}</span>
      </label>
    ))}
  </div>
</fieldset>
```

**TSX example — horizontal (2–3 short options only):**
```tsx
<fieldset>
  <legend className="block text-xs font-medium text-[#8A80A8] mb-2">
    Priority
  </legend>
  <div className="flex items-center gap-4">
    {(["Low", "Medium", "High"] as const).map((level) => (
      <label key={level} className="flex items-center gap-2">
        <input
          type="radio"
          name="priority"
          value={level.toLowerCase()}
          checked={priority === level.toLowerCase()}
          onChange={() => setPriority(level.toLowerCase())}
          className="border-[#C2BBD4] text-[#403770] focus:ring-[#F37167]"
        />
        <span className="text-sm text-[#403770]">{level}</span>
      </label>
    ))}
  </div>
</fieldset>
```

---

## States

Checkbox and radio inputs share a common state set. The visual states below apply to the input element itself.

| State | Appearance |
|-------|-----------|
| Default (unchecked) | White fill, `#C2BBD4` border |
| Default (checked) | `#403770` (Plum) fill, `#403770` border |
| Focus | Coral `#F37167` 2px focus ring around the input |
| Hover | `#EFEDF5` background on the label row (apply to the wrapping `<label>`) |
| Disabled (unchecked) | `opacity-50`, `cursor-not-allowed`; no interaction |
| Disabled (checked) | Same opacity/cursor treatment; checked mark still visible |
| Error (group) | Red legend text (`text-[#f58d85]`) + error message below the group |

**Hover on label row** — add `hover:bg-[#EFEDF5] rounded-md px-2 -mx-2 cursor-pointer` to the wrapping `<label>` when a hover highlight is desired (panel settings lists, not inline form rows).

**Error state (group):**
```tsx
<fieldset>
  <legend className="block text-xs font-medium text-[#f58d85] mb-2">
    Activity Type <span className="text-[#F37167]">*</span>
  </legend>
  <div className="space-y-2" aria-describedby="activity-type-error">
    {/* ...radio items */}
  </div>
  <p id="activity-type-error" className="text-xs text-[#F37167] mt-1">
    Please select an activity type
  </p>
</fieldset>
```

---

## Keyboard Interactions

| Key | Action |
|-----|--------|
| `Space` | Toggle focused checkbox / select focused radio |
| `Tab` | Move focus to the next focusable field (exits the group) |
| `Shift+Tab` | Move focus to the previous focusable field |
| `Arrow Down` / `Arrow Right` | Move to the next radio in the group (native browser behavior) |
| `Arrow Up` / `Arrow Left` | Move to the previous radio in the group (native browser behavior) |

> Radio groups receive native arrow-key navigation at no cost — do not suppress or override it. Tab exits the group and moves to the next field; the user does not Tab between radios within a group.

---

## Do / Don't

- **DO** wrap related checkboxes in `<fieldset>` + `<legend>` — this provides the group label to screen readers and is required for accessibility compliance.
- **DON'T** use a checkbox for mutually exclusive options. If only one choice can be active at a time, use a radio group so users understand the constraint visually and semantically.
- **DO** use a radio group for 2–5 mutually exclusive options. When the list exceeds 5 options, switch to a native `<select>` (see `select.md`) to keep the form compact.
- **DON'T** use a single radio button alone. A lone radio provides no meaningful choice; use a checkbox for a single boolean option instead.
- **DO** give all radios in a group the same `name` attribute. This is what ties them together for keyboard navigation and ensures only one can be checked at a time.
- **DON'T** use horizontal radio layout for more than 3 short options or when labels are longer than 2–3 words — they will wrap inconsistently across viewport sizes.
- **DO** always associate a visible label with each input, either by wrapping the input in `<label>` or by pairing `id`/`htmlFor`. Never use `placeholder` as a substitute for a label on checkboxes or radios.

---

## Accessibility

**Checkbox groups:**
- Wrap in `<fieldset>` with a `<legend>` — the legend is the accessible name for the group. Screen readers announce it before reading individual option labels.
- If the group is required, mark the legend with a visual `*` indicator and add an error message when validation fails. Connect the error message to the group with `aria-describedby` on the container `<div>`.
- The indeterminate state on a "Select All" checkbox must be set imperatively via a `ref`: `el.indeterminate = someChecked`. The `indeterminate` HTML attribute does not exist — it must be a JS property.

**Radio groups:**
- Same `<fieldset>` + `<legend>` pattern as checkbox groups.
- Use the `name` attribute on all radio inputs in the group — this is how the browser links them for keyboard navigation and mutual exclusion.
- A pre-selected default is strongly recommended for radio groups. Leaving all radios unchecked on load means the user must deliberately make a choice; this is acceptable for required fields but confirm the intent with the designer.

**Individual checkbox:**
- Wrap both input and text in `<label>` — this expands the click target to the full label text and eliminates the need for a separate `id`/`htmlFor` pairing.
- If the checkbox must remain outside its label (e.g., in a table cell), use `id` on the input and `htmlFor` on the label.
- Add `aria-invalid="true"` and `aria-describedby` pointing to the error message element when validation fails.

---

## Migration

| Current pattern | Replace with | Found in |
|----------------|-------------|----------|
| `text-gray-600`, `text-gray-700` on checkbox/radio labels | `text-[#403770]` (Plum) | ServiceSelector, ActivityFormModal |
| `accent-[#403770]` missing (raw browser default blue) | `text-[#403770]` on input via Tailwind Forms plugin | ServiceSelector (`src/features/plans/components/ServiceSelector.tsx`) |
| Tailwind gray borders on checkboxes/radios | `border-[#C2BBD4]` (Border Strong) | ServiceSelector |
| `focus:ring-blue-500` or `focus:ring-[#403770]` | `focus:ring-[#F37167]` (Coral) | ActivityFormModal, LayerBubble |
| Bare `<div>` grouping checkboxes without `<fieldset>` | `<fieldset>` + `<legend>` | TaskForm, LayerBubble |

Primary migration target: `ServiceSelector` (`src/features/plans/components/ServiceSelector.tsx`) uses Tailwind gray tokens throughout its checkbox and option rows.

---

## Codebase Examples

| Component | Pattern | File |
|-----------|---------|------|
| ActivityFormModal | Individual checkbox + radio group (activity type) | `src/features/activities/components/ActivityFormModal.tsx` |
| LayerBubble | Checkbox group (map layer toggles) | `src/features/map/components/LayerBubble.tsx` |
| TaskForm | Checkbox group (link types, outcome options) | `src/features/map/components/right-panels/TaskForm.tsx` |
| ServiceSelector | Checkbox group (plan service types) — migration target | `src/features/plans/components/ServiceSelector.tsx` |
