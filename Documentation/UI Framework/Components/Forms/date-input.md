# Date Input

Native date selection for the territory planner — covers single date fields and date range pairs. See `_foundations.md` for the canonical class string, label convention, validation patterns, and focus ring specification.

---

## When to Use

Use `<input type="date">` whenever the user must supply a calendar date: due dates, activity start and end dates, outcome dates, and task deadlines.

**Always use the native date input.** The native `<input type="date">` is accessible, mobile-friendly, and requires no custom calendar widget. Browser chrome (the date picker popup) is intentional — do not suppress it.

**Don't use** a custom date picker unless the native input demonstrably fails a specific product requirement. Custom pickers add dependency weight, custom accessibility burden, and mobile keyboard conflicts.

---

## Variants

### Single Date

A single `<input type="date">` using the canonical class string verbatim.

**Classes:**
```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
```

**Use case:** Any single calendar date — a task due date, an activity date, a plan end date.

**TSX example:**
```tsx
<div>
  <label htmlFor="due-date" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Due Date <span className="text-[#F37167]">*</span>
  </label>
  <input
    id="due-date"
    type="date"
    value={dueDate}
    onChange={(e) => setDueDate(e.target.value)}
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
      disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed"
  />
</div>
```

---

### Date Range Pair

Two date inputs placed side by side — a "Start Date" and an "End Date" — using a two-column grid. Validate that end date is on or after start date on blur of the end date field.

**Layout wrapper:**
```
grid grid-cols-2 gap-3
```

**Use case:** Activity start/end dates, plan date ranges, any field where a span of time is required.

**TSX example:**
```tsx
<div className="grid grid-cols-2 gap-3">
  <div>
    <label htmlFor="start-date" className="block text-xs font-medium text-[#8A80A8] mb-1">
      Start Date <span className="text-[#F37167]">*</span>
    </label>
    <input
      id="start-date"
      type="date"
      value={startDate}
      onChange={(e) => setStartDate(e.target.value)}
      aria-describedby="date-range-hint"
      className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
        bg-white text-[#403770] placeholder:text-[#A69DC0]
        focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
        disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed"
    />
  </div>
  <div>
    <label htmlFor="end-date" className="block text-xs font-medium text-[#8A80A8] mb-1">
      End Date <span className="text-[#F37167]">*</span>
    </label>
    <input
      id="end-date"
      type="date"
      value={endDate}
      min={startDate}
      onChange={(e) => setEndDate(e.target.value)}
      onBlur={() => {
        if (endDate && startDate && endDate < startDate) {
          setEndDateError("End date must be on or after the start date");
        } else {
          setEndDateError("");
        }
      }}
      aria-describedby={endDateError ? "end-date-error date-range-hint" : "date-range-hint"}
      aria-invalid={endDateError ? "true" : undefined}
      className={`w-full px-3 py-2 text-sm border rounded-lg
        bg-white text-[#403770] placeholder:text-[#A69DC0]
        focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
        disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
        ${endDateError
          ? "border-[#f58d85] bg-[#fef1f0]"
          : "border-[#C2BBD4]"
        }`}
    />
    {endDateError && (
      <p id="end-date-error" className="text-xs text-[#F37167] mt-1">
        {endDateError}
      </p>
    )}
  </div>
</div>
<p id="date-range-hint" className="sr-only">
  Enter a start date and end date for the activity range.
</p>
```

---

## States

States are inherited from `_foundations.md`. No overrides are needed for date inputs beyond the range-pair error state shown above.

| State | Border | Background | Text | Ring |
|-------|--------|------------|------|------|
| Default | `#C2BBD4` | `#FFFFFF` | `#403770` | — |
| Focus | transparent | `#FFFFFF` | `#403770` | Coral `#F37167` (2px) |
| Error | `#f58d85` | `#fef1f0` | `#403770` | — |
| Error + Focus | `#f58d85` | `#fef1f0` | `#403770` | Coral `#F37167` (2px) |
| Disabled | `#E2DEEC` | `#F7F5FA` | `#A69DC0` | — |

> No hover state — date inputs have no hover effect. Focus ring on click/tab is sufficient.

---

## Keyboard Interactions

| Key | Action |
|-----|--------|
| `Tab` | Move between date segments (month / day / year) then advance to the next field |
| `Shift+Tab` | Move to the previous segment or previous field |
| `Arrow Up` / `Arrow Down` | Increment or decrement the focused segment (month, day, or year) |
| `Arrow Left` / `Arrow Right` | Move between segments within the input |
| `Enter` | Open the native date picker popup (browser-dependent) |
| `Escape` | Close the date picker popup |

---

## Do / Don't

- **DO** use the native `<input type="date">` — it is consistently accessible, renders the correct mobile date picker, and requires zero additional dependencies.
- **DON'T** add a custom date picker widget unless the native input has been proven insufficient for a specific product requirement (e.g., a disjointed multi-month calendar view or a design mandate to style the calendar popup).
- **DO** validate that the end date is on or after the start date on blur of the end date field for range pairs. Use the `min` attribute (`min={startDate}`) as a first-line browser constraint and add an explicit `onBlur` validation message for clarity.
- **DON'T** use `placeholder` text to communicate the expected date format. The browser renders the format hint natively inside the input chrome.
- **DO** pair every date input with a visible `<label>` using `htmlFor`. Never rely on surrounding context or `placeholder` alone as the field label.

---

## Accessibility

- **Native defaults:** `<input type="date">` is accessible by default. The browser exposes the correct ARIA role, manages focus within the date picker popup, and announces date values to screen readers.
- **Label pairing:** Always use `<label htmlFor="input-id">` pointing to the input's `id`. Do not substitute `aria-label` for a visible label except when a label is genuinely not possible in the layout.
- **Date range fields:** Use `aria-describedby` on both the start and end date inputs to associate them with a shared hint that explains the range relationship (e.g., a visually hidden `<p id="date-range-hint">`). This helps screen reader users understand that the two fields are related.
- **Error state:** Set `aria-invalid="true"` on the input when it is in an error state. Point `aria-describedby` at the error message element's `id` so screen readers announce the message when the field receives focus.
- **`min` / `max` constraints:** Setting `min={startDate}` on the end date input lets the browser communicate the constraint natively; pair it with an explicit error message for users who ignore the constraint or enter dates via keyboard.

---

## Codebase Examples

| Component | Date fields | File |
|-----------|-------------|------|
| ActivityFormModal | `startDate`, `endDate` (range pair) | `src/features/activities/components/ActivityFormModal.tsx` |
| TaskForm | `dueDate` (single date) | `src/features/map/components/right-panels/TaskForm.tsx` |
| OutcomeModal | Activity and outcome dates | `src/features/activities/components/OutcomeModal.tsx` |
| InlineEditCell | Date cell type (inline date input) | `src/features/shared/components/InlineEditCell.tsx` |
