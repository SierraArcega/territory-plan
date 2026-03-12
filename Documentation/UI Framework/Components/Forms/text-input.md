# Text Input

Single-line text entry for the territory planner — covers `<input type="text|email|url|tel|password|number">`. See `_foundations.md` for the canonical class string, label convention, validation patterns, and focus ring specification.

---

## When to Use

| Input type | When to use |
|------------|-------------|
| `type="text"` | Names, titles, free-form short strings (plan name, account name, notes field title) |
| `type="email"` | Email addresses — triggers email validation and the correct mobile keyboard |
| `type="url"` | Website URLs — triggers URL validation and mobile keyboard with easy `.com` access |
| `type="tel"` | Phone numbers — triggers numeric keyboard on mobile; does not enforce format |
| `type="password"` | Credentials — browser hides characters and enables password manager integration |
| `type="number"` | Quantities and amounts where arithmetic makes sense (targets, counts, dollar amounts with a currency prefix) |

**Don't use** `type="number"` for values that happen to be digits but are not quantities — zip codes, phone numbers, IDs, and account numbers should use `type="text"` with `inputMode="numeric"`. Numbers with leading zeros or that require paste and format operations should also stay as `type="text"`.

**Don't use** a text input for multi-line content — use `<textarea>` instead (see `_foundations.md`).

---

## Variants

### Standard Text Input

The baseline for all single-line text entry. Uses the canonical class string verbatim.

**Classes:**
```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
```

**Use case:** Any single-line text field — name, title, label, short description. The default choice when no special behavior is needed.

**TSX example:**
```tsx
<div>
  <label htmlFor="plan-name" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Plan Name <span className="text-[#F37167]">*</span>
  </label>
  <input
    id="plan-name"
    type="text"
    value={planName}
    onChange={(e) => setPlanName(e.target.value)}
    placeholder="e.g. Q3 Northeast Expansion"
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
      disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed"
  />
</div>
```

**Email example:**
```tsx
<div>
  <label htmlFor="contact-email" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Email <span className="text-[#F37167]">*</span>
  </label>
  <input
    id="contact-email"
    type="email"
    value={email}
    onChange={(e) => setEmail(e.target.value)}
    placeholder="name@district.edu"
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  />
</div>
```

**Password example:**
```tsx
<div>
  <label htmlFor="password" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Password <span className="text-[#F37167]">*</span>
  </label>
  <input
    id="password"
    type="password"
    value={password}
    onChange={(e) => setPassword(e.target.value)}
    placeholder="Enter your password"
    autoComplete="current-password"
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  />
</div>
```

---

### With Icon Prefix

Adds a leading icon inside the input — the most common use is a search input. The icon is positioned absolutely; the input uses `pl-9` to avoid text overlapping the icon.

**Classes (input):**
```
w-full pl-9 pr-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
```

**Icon wrapper:** `relative` on the container; icon at `absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0]`

**Use case:** Search inputs in toolbars, filter bars, or any field where a semantic icon reduces the need for a label (e.g., a magnifying glass makes "Search" implicit). Always include a visible label or `aria-label` even when the icon implies the purpose.

**TSX example:**
```tsx
<div className="relative">
  <svg
    className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0]"
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
    />
  </svg>
  <input
    type="text"
    value={query}
    onChange={(e) => setQuery(e.target.value)}
    placeholder="Search accounts..."
    aria-label="Search accounts"
    className="w-full pl-9 pr-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  />
</div>
```

---

### With Character Count

Displays a character counter below the input — useful for fields with a known maximum length (goal titles, plan descriptions, short labels). The counter updates live as the user types.

**Counter classes:**
```
text-xs text-[#A69DC0] mt-1 text-right
```

When approaching the limit (within ~10% of max), switch the counter color to Coral to signal urgency: `text-xs text-[#F37167] mt-1 text-right`

**Use case:** Goal name, plan title, or any field where character budget awareness improves the user's experience.

**TSX example:**
```tsx
const MAX_LENGTH = 80;

<div>
  <label htmlFor="goal-title" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Goal Title <span className="text-[#F37167]">*</span>
  </label>
  <input
    id="goal-title"
    type="text"
    value={title}
    onChange={(e) => setTitle(e.target.value)}
    maxLength={MAX_LENGTH}
    placeholder="e.g. Grow district adoption by 20%"
    className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
      bg-white text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  />
  <p className={`text-xs mt-1 text-right ${
    title.length >= MAX_LENGTH * 0.9 ? "text-[#F37167]" : "text-[#A69DC0]"
  }`}>
    {title.length}/{MAX_LENGTH}
  </p>
</div>
```

---

## States

States are inherited from `_foundations.md`. No overrides needed for text inputs.

| State | Border | Background | Text | Ring |
|-------|--------|------------|------|------|
| Default | `#C2BBD4` | `#FFFFFF` | `#403770` | — |
| Focus | transparent | `#FFFFFF` | `#403770` | Coral `#F37167` (2px) |
| Error | `#f58d85` | `#fef1f0` | `#403770` | — |
| Error + Focus | `#f58d85` | `#fef1f0` | `#403770` | Coral `#F37167` (2px) |
| Disabled | `#E2DEEC` | `#F7F5FA` | `#A69DC0` | — |

> No hover state — text inputs have no hover effect. Focus ring on click/tab is sufficient.

**Error state TSX:**
```tsx
<div>
  <label htmlFor="plan-name" className="block text-xs font-medium text-[#f58d85] mb-1">
    Plan Name <span className="text-[#F37167]">*</span>
  </label>
  <input
    id="plan-name"
    type="text"
    value={planName}
    onChange={(e) => setPlanName(e.target.value)}
    aria-invalid="true"
    aria-describedby="plan-name-error"
    className="w-full px-3 py-2 text-sm border border-[#f58d85] rounded-lg
      bg-[#fef1f0] text-[#403770] placeholder:text-[#A69DC0]
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  />
  <p id="plan-name-error" className="text-xs text-[#F37167] mt-1">Plan name is required</p>
</div>
```

**Disabled state TSX:**
```tsx
<div>
  <label htmlFor="account-id" className="block text-xs font-medium text-[#A69DC0] mb-1">
    Account ID
  </label>
  <input
    id="account-id"
    type="text"
    value={accountId}
    disabled
    className="w-full px-3 py-2 text-sm border border-[#E2DEEC] rounded-lg
      bg-[#F7F5FA] text-[#A69DC0] cursor-not-allowed"
  />
</div>
```

---

## Keyboard Interactions

| Key | Action |
|-----|--------|
| `Tab` | Move focus to next field |
| `Shift+Tab` | Move focus to previous field |
| `Enter` | Submit the enclosing `<form>` (single-line inputs only) |
| `Ctrl+A` / `Cmd+A` | Select all text in the input |
| `Escape` | Clear browser autocomplete dropdown (if open); blur is handled by the enclosing modal/panel — see `form-layouts.md` |

---

## Do / Don't

- **DO** use `type="email"` for email fields — it triggers browser email validation, shows the email keyboard on iOS/Android, and enables password manager autofill pairing.
- **DON'T** use `type="number"` for values that are digits but not quantities. Zip codes, phone numbers, district IDs, and account numbers should use `type="text"` with `inputMode="numeric"` to avoid the browser's spin buttons and to allow leading zeros.
- **DO** always provide a visible `<label>` paired with `htmlFor`. Do not rely on `placeholder` alone as a label — placeholders disappear on focus and are not announced reliably by all screen readers.
- **DON'T** suppress the focus ring. Never use `focus:ring-0` or `focus:outline-none` without a replacement ring. The focus ring is required for keyboard navigation and WCAG 2.1 compliance.
- **DO** set `autoComplete` attributes on credential fields (`autoComplete="current-password"`, `autoComplete="new-password"`, `autoComplete="email"`) to enable password manager integration and browser autofill.
- **DON'T** use `type="number"` for currency inputs — use `type="text"` with `inputMode="decimal"` and handle formatting in state. Currency inputs use the `pl-7` prefix pattern from `_foundations.md`.

---

## Accessibility

- **Label pairing:** Always use `<label htmlFor="input-id">` pointing to the input's `id`. Never substitute a `placeholder` or `aria-label` alone for a visible label.
- **Help text:** Connect help text to the input with `aria-describedby="help-text-id"`. When both error and help text are present, include both ids: `aria-describedby="field-help field-error"`.
- **Error state:** Set `aria-invalid="true"` on the input when in error state so screen readers announce the invalid status. The error message element should have a matching `id` referenced by `aria-describedby`.
- **Required fields:** The `required` attribute on the input element triggers native browser validation. Pair it with the visual `*` marker in the label (see `_foundations.md` label convention). Do not rely on native browser validation alone — implement field-level error messages as well.
- **Password inputs:** Do not prevent copy/paste. Blocking clipboard operations harms usability and password manager workflows.
- **Icon prefix inputs:** When the icon communicates the field's purpose (e.g., search magnifying glass with no visible label), add `aria-label` to the input to provide an accessible name.

---

## Migration

Rows from the `_foundations.md` master migration table that apply specifically to text inputs:

| Current pattern | Replace with | Found in |
|----------------|-------------|----------|
| `border-gray-200`, `border-gray-300` | `border-[#C2BBD4]` (Border Strong) | TaskFormModal, GoalFormModal, PlanFormModal, OutcomeModal |
| `text-gray-400` placeholders | `placeholder:text-[#A69DC0]` (Muted) | Multiple files |
| `focus:ring-[#403770]` on form inputs | `focus:ring-[#F37167]` (Coral) | GoalFormModal, GoalEditorModal, PlanFormModal, DistrictTargetEditor |
| `bg-red-50 border-red-200 text-red-600` errors | `bg-[#fef1f0]` / `border-[#f58d85]` / `text-[#F37167]` | GoalFormModal, PlanFormModal, AccountForm, login page |

---

## Codebase Examples

| Component | Input types used | File |
|-----------|-----------------|------|
| TaskFormModal | `text` (task title, notes) | `src/features/tasks/components/TaskFormModal.tsx` |
| GoalFormModal | `text` (goal name), `number` (target value) | `src/features/goals/components/GoalFormModal.tsx` |
| PlanFormModal | `text` (plan name, description) | `src/features/plans/components/PlanFormModal.tsx` |
| AccountForm | `text` (account name), `email`, `tel`, `url` | `src/features/map/components/panels/AccountForm.tsx` |
| Login page | `email`, `password` | `src/app/login/page.tsx` |
