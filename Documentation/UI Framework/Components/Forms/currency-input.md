# Currency Input

Dollar-prefixed input for monetary values in the territory planner — budget targets, revenue, costs, and any other financial field. See `_foundations.md` for the canonical class string, label convention, validation patterns, and focus ring specification.

---

## When to Use

Use the currency input for any field where the user enters a dollar amount: budget targets, revenue figures, cost estimates, contract values, or staffing expenditures.

**Don't use** a plain `type="number"` input for monetary values — it allows `e`, `+`, and `-` characters, shows spinner arrows (which are distracting on currency fields), and behaves inconsistently across browsers and mobile devices.

**Don't use** `type="text"` without `inputMode="decimal"` — the correct input mode is essential for surfacing the numeric keyboard on mobile.

---

## Variants

### Standard Currency Input

A text input with `pl-7` (instead of the standard `px-3`) to accommodate the `$` prefix element positioned absolutely inside the wrapper.

**Classes (wrapper):**
```
relative
```

**Classes ($ prefix):**
```
absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm
```

**Classes (input):**
```
w-full pl-7 pr-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
```

**Use case:** Any single monetary value — budget target per district, contract value, projected revenue, cost estimate.

**TSX example:**
```tsx
<div>
  <label htmlFor="budget-target" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Budget Target <span className="text-[#F37167]">*</span>
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm">$</span>
    <input
      id="budget-target"
      type="text"
      inputMode="decimal"
      value={budgetTarget}
      onChange={(e) => setBudgetTarget(e.target.value)}
      onBlur={(e) => setBudgetTarget(formatCurrency(e.target.value))}
      placeholder="0.00"
      className="w-full pl-7 pr-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
        bg-white text-[#403770] placeholder:text-[#A69DC0]
        focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
        disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed"
    />
  </div>
</div>
```

---

### With Help Text

Use `aria-describedby` to attach a format hint below the input — particularly useful when the field requires a specific format (e.g., whole dollars only, or a specific decimal precision).

**TSX example:**
```tsx
<div>
  <label htmlFor="annual-budget" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Annual Budget
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm">$</span>
    <input
      id="annual-budget"
      type="text"
      inputMode="decimal"
      value={annualBudget}
      onChange={(e) => setAnnualBudget(e.target.value)}
      onBlur={(e) => setAnnualBudget(formatCurrency(e.target.value))}
      placeholder="0.00"
      aria-describedby="annual-budget-hint"
      className="w-full pl-7 pr-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
        bg-white text-[#403770] placeholder:text-[#A69DC0]
        focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
    />
  </div>
  <p id="annual-budget-hint" className="text-xs text-[#A69DC0] mt-1">
    Enter the total budget in dollars. Commas are added automatically.
  </p>
</div>
```

---

## States

States are inherited from `_foundations.md`. The `$` prefix element uses Muted `#A69DC0` in all states — it does not change color on focus or error.

| State | Border | Background | Text | Ring | $ Prefix |
|-------|--------|------------|------|------|----------|
| Default | `#C2BBD4` | `#FFFFFF` | `#403770` | — | `#A69DC0` |
| Focus | transparent | `#FFFFFF` | `#403770` | Coral `#F37167` (2px) | `#A69DC0` |
| Error | `#f58d85` | `#fef1f0` | `#403770` | — | `#A69DC0` |
| Error + Focus | `#f58d85` | `#fef1f0` | `#403770` | Coral `#F37167` (2px) | `#A69DC0` |
| Disabled | `#E2DEEC` | `#F7F5FA` | `#A69DC0` | — | `#A69DC0` |

> No hover state — currency inputs have no hover effect. Focus ring on click/tab is sufficient.

**Error state TSX:**
```tsx
<div>
  <label htmlFor="revenue-target" className="block text-xs font-medium text-[#f58d85] mb-1">
    Revenue Target <span className="text-[#F37167]">*</span>
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm">$</span>
    <input
      id="revenue-target"
      type="text"
      inputMode="decimal"
      value={revenueTarget}
      onChange={(e) => setRevenueTarget(e.target.value)}
      aria-invalid="true"
      aria-describedby="revenue-target-error"
      className="w-full pl-7 pr-3 py-2 text-sm border border-[#f58d85] rounded-lg
        bg-[#fef1f0] text-[#403770] placeholder:text-[#A69DC0]
        focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
    />
  </div>
  <p id="revenue-target-error" className="text-xs text-[#F37167] mt-1">
    Revenue target is required
  </p>
</div>
```

**Disabled state TSX:**
```tsx
<div>
  <label htmlFor="locked-budget" className="block text-xs font-medium text-[#A69DC0] mb-1">
    Locked Budget
  </label>
  <div className="relative">
    <span className="absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0] text-sm">$</span>
    <input
      id="locked-budget"
      type="text"
      inputMode="decimal"
      value={lockedBudget}
      disabled
      className="w-full pl-7 pr-3 py-2 text-sm border border-[#E2DEEC] rounded-lg
        bg-[#F7F5FA] text-[#A69DC0] cursor-not-allowed"
    />
  </div>
</div>
```

---

## Formatting on Blur

Format the value on blur rather than restricting input in real time. Real-time restrictions (e.g., blocking non-numeric keystrokes) interfere with copy/paste, make it hard to correct values mid-entry, and create poor mobile UX.

**Recommended blur formatter:**
```ts
function formatCurrency(raw: string): string {
  // Strip everything except digits and the first decimal point
  const cleaned = raw.replace(/[^0-9.]/g, "");
  const number = parseFloat(cleaned);
  if (isNaN(number)) return "";
  // Format with commas and two decimal places
  return number.toLocaleString("en-US", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
}
```

**Reverse formatter (before submitting):**

Strip formatting before storing or sending the value — store raw numbers, not display strings.

```ts
function parseCurrency(formatted: string): number {
  return parseFloat(formatted.replace(/[^0-9.]/g, "")) || 0;
}
```

---

## Keyboard Interactions

Currency input keyboard behavior is identical to a standard text input. See `text-input.md` for the full keyboard interaction table.

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next field |
| `Shift+Tab` | Move focus to previous field |
| `Enter` | Submit the enclosing `<form>` |
| `Ctrl+A` / `Cmd+A` | Select all text in the input |
| `Escape` | Clear browser autocomplete dropdown (if open) |

---

## Do / Don't

- **DO** use `inputMode="decimal"` instead of `type="number"` — `inputMode="decimal"` surfaces the numeric keyboard on mobile while keeping the field a `type="text"` input, which avoids spinner arrows, blocks `e`, `+`, and `-` characters, and correctly handles leading zeros and copy/paste.
- **DON'T** use `type="number"` for currency fields — it allows `e`, `+`, `-` input, renders spinner arrows, and behaves inconsistently across browsers when the value includes commas.
- **DO** format on blur — add thousand-separator commas and enforce decimal places when the user leaves the field, not while they are typing.
- **DON'T** format in real time (on every keystroke) — doing so breaks mid-entry editing, interferes with paste operations, and frustrates mobile users.
- **DO** strip formatting before storing or submitting the value — save raw numbers (`parseCurrency(value)`), not display strings like `"1,250.00"`.
- **DON'T** omit the `$` prefix — the visual prefix is load-bearing for the `pl-7` left padding. Removing the prefix without also changing `pl-7` back to `px-3` will leave awkward empty space on the left.
- **DO** use `placeholder="0.00"` to communicate the expected format — it is more informative than an empty placeholder and disappears on focus as expected.

---

## Accessibility

- **Label pairing:** Always use `<label htmlFor="input-id">` pointing to the input's `id`. The label should include currency context — prefer "Budget Target (in dollars)" or "Annual Revenue" over a generic "Amount" when the currency unit is not otherwise obvious from context.
- **Help text:** Connect format guidance to the input with `aria-describedby="help-text-id"`. When both error and help text are present, include both ids: `aria-describedby="field-help field-error"`.
- **Error state:** Set `aria-invalid="true"` on the input when in error state so screen readers announce the invalid status. The error message element should have a matching `id` referenced by `aria-describedby`.
- **$ prefix element:** The `<span>` containing "$" is decorative — it does not need an `aria-hidden` attribute because it carries no semantic meaning that the label does not already provide. Screen readers will read the label (which should convey "dollars") rather than the visible prefix character.
- **Formatted value announcement:** When formatting is applied on blur, the screen reader will announce the reformatted value. This is expected and correct behavior — users hear "1,250.00" rather than "1250", which is clearer.

---

## Codebase Examples

| Component | Currency fields | File |
|-----------|----------------|------|
| DistrictTargetEditor | Budget target, revenue, and cost inputs (uses `pl-7` + `$` prefix pattern) | `src/features/plans/components/DistrictTargetEditor.tsx` |
| InlineEditCell | `formatter` prop for currency display mode | `src/features/shared/components/InlineEditCell.tsx` |
| FinanceCard | District financial data display | `src/features/map/components/panels/district/FinanceCard.tsx` |
| StaffingCard | Staffing cost display | `src/features/map/components/panels/district/StaffingCard.tsx` |

> **Migration note:** `DistrictTargetEditor` currently uses `text-gray-400` for the `$` prefix and `focus:ring-[#403770]` — both should be updated to `text-[#A69DC0]` and `focus:ring-[#F37167]` respectively per the design token spec.
