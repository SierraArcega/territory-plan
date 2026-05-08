# LHF Target Required State Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make the TARGET field's required status self-evident in both the single-district and bulk "Add to Plan" popovers on the Low Hanging Fruit page.

**Architecture:** Three purely visual changes per component — swap the placeholder, apply conditional Tailwind classes on the input, and conditionally render a one-line hint below the field. No new state, no new logic. The existing `parsedTarget` / `targetNum` variables already track whether the value is valid; we just wire them to the UI.

**Tech Stack:** React 19, Tailwind 4, TypeScript — no new dependencies.

---

## Files

| File | Action |
|---|---|
| `src/features/leaderboard/components/LhfPlanPicker.tsx` | Modify — placeholder, conditional input classes, helper text |
| `src/features/leaderboard/components/LhfBulkPlanPicker.tsx` | Modify — placeholder, conditional input classes, helper text |

---

## Task 1: LhfPlanPicker — placeholder, amber field state, helper text

**Files:**
- Modify: `src/features/leaderboard/components/LhfPlanPicker.tsx:346–372`

### Context

The target input section currently lives at lines 346–372. The relevant variables:

- `targetInput` — raw string state for the input
- `parsedTarget` — memoized `parseTargetInput(targetInput)`, already defined at line 81. It is `0` when the field is empty or blank.

The three changes all happen inside the `{/* Target input */}` block.

- [ ] **Step 1: Update the input — placeholder + conditional border/bg classes**

Replace the `<input>` element at lines 360–370 with:

```tsx
<input
  id="add-plan-target"
  type="text"
  inputMode="decimal"
  value={targetInput}
  placeholder="e.g. 50,000"
  onChange={(e) => setTargetInput(e.target.value)}
  onBlur={(e) => setTargetInput(formatTargetInput(e.target.value))}
  className={`w-full rounded-md border pl-5 pr-2 py-1.5 text-sm text-[#403770] tabular-nums focus:border-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 ${
    parsedTarget <= 0
      ? "border-amber-400 bg-amber-50"
      : "border-[#C2BBD4] bg-white"
  }`}
  required
/>
```

Key changes:
- `placeholder` goes from `"0"` → `"e.g. 50,000"`
- `className` becomes a template expression: amber border + bg when empty, normal when filled

- [ ] **Step 2: Add helper text below the input wrapper**

After the closing `</div>` of the `relative` wrapper (the one containing the `$` span and the input), add:

```tsx
{parsedTarget <= 0 && (
  <p className="text-[11px] text-amber-700 mt-1">
    Set a target amount to add to plan
  </p>
)}
```

The full updated `{/* Target input */}` block should read:

```tsx
{/* Target input */}
<div className="space-y-1">
  <label
    htmlFor="add-plan-target"
    className="block text-[11px] font-semibold text-[#544A78] uppercase tracking-wider"
  >
    Target
  </label>
  <div className="relative">
    <span
      className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-[#6E6390] pointer-events-none"
      aria-hidden="true"
    >
      $
    </span>
    <input
      id="add-plan-target"
      type="text"
      inputMode="decimal"
      value={targetInput}
      placeholder="e.g. 50,000"
      onChange={(e) => setTargetInput(e.target.value)}
      onBlur={(e) => setTargetInput(formatTargetInput(e.target.value))}
      className={`w-full rounded-md border pl-5 pr-2 py-1.5 text-sm text-[#403770] tabular-nums focus:border-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 ${
        parsedTarget <= 0
          ? "border-amber-400 bg-amber-50"
          : "border-[#C2BBD4] bg-white"
      }`}
      required
    />
  </div>
  {parsedTarget <= 0 && (
    <p className="text-[11px] text-amber-700 mt-1">
      Set a target amount to add to plan
    </p>
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit 2>&1 | grep LhfPlanPicker
```

Expected: no output (no errors in this file).

- [ ] **Step 4: Manual smoke test**

```bash
npm run dev
```

Open the LHF page (Low Hanging Fruit tab). Click the `+ Plan` button on any district that has **no suggested target** (these open with an empty field).

Verify:
- TARGET input shows placeholder `e.g. 50,000` (not `0`)
- TARGET field has an amber border and light amber background
- Helper text "Set a target amount to add to plan" appears below the field in amber
- "Add to Plan" button is disabled

Then type any positive number (e.g. `50000`):
- Amber border and background clear → normal border (`#C2BBD4`), white background
- Helper text disappears
- "Add to Plan" button becomes enabled (assuming a plan is selected)

Also click a district **with a suggested target** — the field should open pre-filled, no amber, button enabled immediately.

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LhfPlanPicker.tsx
git commit -m "feat(lhf): amber required state on target field in plan picker"
```

---

## Task 2: LhfBulkPlanPicker — placeholder, amber field state, helper text

**Files:**
- Modify: `src/features/leaderboard/components/LhfBulkPlanPicker.tsx:306–340`

### Context

The bulk picker steps through districts one at a time in a modal. The relevant variables (defined at lines 96–99):

- `target` — raw string state for the input
- `targetNum = Number(target)` — parsed number; is `0` when `target` is `""` or `"0"`

The target field lives in a `<div>` around lines 306–340. The `<input>` at lines 318–327 has no `placeholder` today.

- [ ] **Step 1: Update the input — placeholder + conditional border/bg classes**

Replace the `<input>` element at lines 318–327 with:

```tsx
<input
  id="bulk-target-input"
  type="text"
  inputMode="decimal"
  value={target}
  placeholder="e.g. 50,000"
  onChange={(e) =>
    setTarget(e.target.value.replace(/[^\d.]/g, ""))
  }
  className={`w-full pl-6 pr-3 py-2 rounded-lg border text-sm text-[#403770] tabular-nums ${
    targetNum <= 0
      ? "border-amber-400 bg-amber-50"
      : "border-[#C2BBD4] bg-white"
  }`}
/>
```

Key changes:
- `placeholder` added: `"e.g. 50,000"`
- `className` becomes conditional: amber when `targetNum <= 0`, normal otherwise

- [ ] **Step 2: Add helper text below the input row**

The target section currently ends with an optional "Suggested:" hint and an `{error && ...}` block. Add the amber helper text between the input row and the error block:

```tsx
<div>
  <label
    htmlFor="bulk-target-input"
    className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1"
  >
    Target
  </label>
  <div className="flex items-center gap-2">
    <div className="flex-1 relative">
      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A80A8]">
        $
      </span>
      <input
        id="bulk-target-input"
        type="text"
        inputMode="decimal"
        value={target}
        placeholder="e.g. 50,000"
        onChange={(e) =>
          setTarget(e.target.value.replace(/[^\d.]/g, ""))
        }
        className={`w-full pl-6 pr-3 py-2 rounded-lg border text-sm text-[#403770] tabular-nums ${
          targetNum <= 0
            ? "border-amber-400 bg-amber-50"
            : "border-[#C2BBD4] bg-white"
        }`}
      />
    </div>
    {row.suggestedTarget != null && (
      <span className="text-xs text-[#8A80A8] whitespace-nowrap">
        Suggested: {formatCurrency(row.suggestedTarget, true)}
      </span>
    )}
  </div>
  {targetNum <= 0 && (
    <p className="text-[11px] text-amber-700 mt-1">
      Set a target amount to add to plan
    </p>
  )}
  {error && (
    <div className="mt-1 text-xs text-[#B5453D]" role="alert">
      {error}
    </div>
  )}
</div>
```

- [ ] **Step 3: Verify TypeScript compiles clean**

```bash
npx tsc --noEmit 2>&1 | grep LhfBulkPlanPicker
```

Expected: no output.

- [ ] **Step 4: Manual smoke test**

On the LHF page, select 2+ districts (checkboxes) then click the bulk "Add to Plan" button to open the multi-step modal.

Verify per step:
- Districts **without** a suggested target: TARGET shows amber border + bg, helper text visible, "Add & continue" disabled
- Districts **with** a suggested target: TARGET pre-filled, no amber, "Add & continue" enabled
- Typing a value clears amber immediately, helper text disappears
- Clearing back to empty restores amber + helper text

- [ ] **Step 5: Commit**

```bash
git add src/features/leaderboard/components/LhfBulkPlanPicker.tsx
git commit -m "feat(lhf): amber required state on target field in bulk plan picker"
```
