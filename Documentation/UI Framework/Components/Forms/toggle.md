# Toggle

Custom on/off switch component for the territory planner — covers immediate-effect binary settings rendered as a pill-shaped track with a circular thumb. See `_foundations.md` for label convention, focus ring specification, and shared form foundations.

---

## When to Use

Use a toggle for binary settings that take effect immediately, without a submit action. The user flips the toggle and the change happens in real time.

**Don't** use a toggle inside a form that has a submit button — use a checkbox instead (see `checkbox-and-radio.md`). The toggle implies immediacy; pairing it with a save action creates a misleading contract.

**Always** pair the toggle with a visible label explaining what it controls. Never use a toggle as an unlabelled icon-only control.

| Situation | Use |
|-----------|-----|
| Immediately enable/disable a setting (show optional fields, enable a layer) | Toggle |
| Form field inside a modal with a Save button | Checkbox |
| Agree/disagree or mark complete | Checkbox |

---

## Variants

### Standard Toggle

A single pill track with a circular thumb that slides between left (off) and right (on) positions. No size variants — the dimensions below are the only set used in the territory planner.

**Track classes:**
```
relative inline-flex items-center w-8 h-[18px] rounded-full cursor-pointer
transition-colors focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:ring-offset-1
```

**Track color — off:** `bg-[#C2BBD4]`

**Track color — on:** `bg-[#403770]`

**Thumb classes:**
```
absolute left-[2px] top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow
transition-transform
```

**Thumb position — off:** `translate-x-0`

**Thumb position — on:** `translate-x-[14px]`

---

## States

| State | Track | Thumb |
|-------|-------|-------|
| Off | `bg-[#C2BBD4]` (Border Strong) | `translate-x-0` — left position |
| On | `bg-[#403770]` (Plum) | `translate-x-[14px]` — right position |
| Disabled Off | `bg-[#E2DEEC]` (Border Subtle) | `translate-x-0`, `opacity-50` on the whole control |
| Disabled On | `bg-[#403770]/50` | `translate-x-[14px]`, `opacity-50` on the whole control |

Apply `opacity-50 cursor-not-allowed pointer-events-none` to the wrapper element for both disabled states.

---

## Keyboard Interactions

| Key | Action |
|-----|--------|
| `Space` | Toggle on/off |
| `Enter` | Toggle on/off |
| `Tab` | Move focus to the next focusable element |
| `Shift+Tab` | Move focus to the previous focusable element |

The toggle must be implemented as a `<button>` (or with `role="switch"` on a `<div>`) so that it receives keyboard focus naturally. Do not use a hidden `<input type="checkbox">` as the sole interactive element without making the visual track focusable.

---

## TSX Example

```tsx
interface ToggleProps {
  id: string;
  checked: boolean;
  onChange: (checked: boolean) => void;
  label: string;
  disabled?: boolean;
}

function Toggle({ id, checked, onChange, label, disabled = false }: ToggleProps) {
  return (
    <div className="flex items-center gap-2">
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={[
          "relative inline-flex items-center w-8 h-[18px] rounded-full cursor-pointer",
          "transition-colors focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:ring-offset-1",
          checked ? "bg-[#403770]" : "bg-[#C2BBD4]",
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : "",
          // Disabled on state uses reduced-opacity plum
          disabled && checked ? "bg-[#403770]/50" : "",
          // Disabled off state uses Border Subtle
          disabled && !checked ? "bg-[#E2DEEC]" : "",
        ]
          .filter(Boolean)
          .join(" ")}
      >
        <span
          className={[
            "absolute left-[2px] top-[2px] w-[14px] h-[14px] rounded-full bg-white shadow",
            "transition-transform",
            checked ? "translate-x-[14px]" : "translate-x-0",
          ].join(" ")}
        />
      </button>
      <label
        htmlFor={id}
        className={[
          "text-sm cursor-pointer select-none",
          disabled ? "text-[#A69DC0]" : "text-[#8A80A8]",
        ].join(" ")}
      >
        {label}
      </label>
    </div>
  );
}
```

**Usage — show optional fields:**
```tsx
const [showOptional, setShowOptional] = useState(false);

<Toggle
  id="show-optional"
  checked={showOptional}
  onChange={setShowOptional}
  label="Show optional fields"
/>
```

**Usage — disabled:**
```tsx
<Toggle
  id="enable-layer"
  checked={false}
  onChange={() => {}}
  label="Enable overlay layer"
  disabled
/>
```

---

## Do / Don't

- **DO** use the toggle for settings that take effect immediately — show/hide optional fields, enable a map layer, activate a notification.
- **DON'T** use the toggle inside a form that has a Save/Submit button. The toggle implies the change is live; a deferred submit breaks that contract. Use a checkbox instead.
- **DO** always pair the toggle with a visible label that explains what it controls. A label like "Notifications" is acceptable; an unlabelled toggle is not.
- **DON'T** use the toggle for destructive or irreversible actions. Use an explicit confirmation dialog instead.
- **DO** apply `disabled` and `aria-disabled` together with `opacity-50 cursor-not-allowed` so both keyboard and pointer users understand the control is inactive.
- **DON'T** invent additional size variants. The `w-8 h-[18px]` track and `w-[14px] h-[14px]` thumb are the only toggle dimensions used in the territory planner.

---

## Accessibility

- Use `role="switch"` with `aria-checked="true"` or `aria-checked="false"` on the interactive element. This tells screen readers the widget is a two-state on/off control, not a generic button.
- Pair the toggle with a visible `<label>` and connect it via `htmlFor` pointing to the toggle's `id`. Alternatively, wrap both in a container and use `aria-labelledby` pointing to the label's `id`.
- When disabled, add `aria-disabled="true"` in addition to the HTML `disabled` attribute so assistive technology announces the inactive state.
- The Coral focus ring (`focus:ring-2 focus:ring-[#F37167] focus:ring-offset-1`) must always remain visible — never suppress it.

```tsx
<button
  role="switch"
  aria-checked={isOn}
  aria-disabled={disabled}
  aria-label="Enable email notifications"  // use only if no visible label is present
  ...
/>
```

---

## Migration

| Current pattern | Replace with | Found in |
|----------------|-------------|----------|
| `bg-gray-300` toggle off state | `bg-[#C2BBD4]` (Border Strong) | OutcomeModal (`src/features/activities/components/OutcomeModal.tsx`) |

---

## Codebase Examples

| Component | Pattern | File |
|-----------|---------|------|
| OutcomeModal | Toggle for binary setting — migration target (`bg-gray-300` off state) | `src/features/activities/components/OutcomeModal.tsx` |
| AccountForm | Toggle to show/hide optional fields | `src/features/map/components/panels/AccountForm.tsx` |
