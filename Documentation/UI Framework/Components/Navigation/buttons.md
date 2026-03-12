# Buttons

Standard button patterns for the territory planner — 6 variants, each available in all 3 size tiers.

See `_foundations.md` for size scale, focus ring, and disabled state.

---

## Variants

### Primary

**Classes:**
```
bg-[#403770] text-white rounded-lg hover:bg-[#322a5a] transition-colors
```

Combined with size tier (medium default):
```
inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
```

**Use case:** Main actions — Create Plan, Save, Submit, New Activity. One primary button per toolbar or modal footer.

**TSX example:**
```tsx
<button
  onClick={handleCreate}
  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
  Create Plan
</button>
```

**Size variants:**

```tsx
{/* Small */}
<button className="inline-flex items-center gap-2 px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
  Save
</button>

{/* Large */}
<button className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
  Create Your First Plan
</button>
```

---

### Secondary (Outlined)

**Classes:**
```
border border-[#403770] text-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors
```

Combined with size tier (medium default):
```
inline-flex items-center gap-2 px-4 py-2 text-sm font-medium border border-[#403770] text-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
```

**Use case:** Edit, secondary actions placed alongside a primary button. Never use two secondary buttons without a primary in the same group.

**TSX example:**
```tsx
<button
  onClick={() => setShowEditModal(true)}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#403770] text-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
  Edit
</button>
```

---

### Destructive

**Classes:**
```
border border-[#F37167] text-[#F37167] rounded-lg hover:bg-[#F37167] hover:text-white transition-colors
```

Combined with size tier (small default for inline use):
```
inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#F37167] text-[#F37167] rounded-lg hover:bg-[#F37167] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[#F37167]/30 focus-visible:outline-none
```

**Use case:** Delete, Remove, destructive/irreversible actions. Pair with a confirmation dialog for permanent operations.

**TSX example:**
```tsx
<button
  onClick={() => setShowDeleteConfirm(true)}
  className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#F37167] text-[#F37167] rounded-lg hover:bg-[#F37167] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[#F37167]/30 focus-visible:outline-none"
>
  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
  Delete
</button>
```

---

### Ghost

**Classes:**
```
text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors
```

Combined with size tier (medium default):
```
inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none
```

**Use case:** Cancel, toolbar actions, low-emphasis controls. No visible border at rest — the button only reveals its shape on hover.

**TSX example:**
```tsx
<button
  onClick={() => setShowDeleteConfirm(false)}
  className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  Cancel
</button>
```

---

### Icon-Only

**Classes (default):**
```
p-1.5 text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5] transition-colors
```

**Destructive variant:**
```
p-1.5 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors
```

Padding maps to size tier: small = `p-1`, medium = `p-1.5`, large = `p-2`.

**Accessibility:** Always include `aria-label` and `title`. The `title` provides a native tooltip; `aria-label` provides the accessible name for screen readers.

**Use case:** Table row actions (edit, delete, copy), close buttons, collapse toggles. Use where text labels would crowd a dense layout.

**TSX example (default):**
```tsx
<button
  onClick={handleEdit}
  aria-label="Edit district"
  title="Edit district"
  className="p-1.5 text-[#A69DC0] hover:text-[#403770] rounded-lg hover:bg-[#EFEDF5] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
  </svg>
</button>
```

**TSX example (destructive):**
```tsx
<button
  onClick={handleDelete}
  aria-label="Delete district"
  title="Delete district"
  className="p-1.5 text-[#A69DC0] hover:text-[#F37167] rounded-lg hover:bg-[#fef1f0] transition-colors focus-visible:ring-2 focus-visible:ring-[#F37167]/30 focus-visible:outline-none"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
  </svg>
</button>
```

---

### Chip/Toggle

Chip buttons are pill-shaped and used for multi-select filtering, view toggles, and category selection. They do not use the size scale — they have a fixed compact size.

**Inactive:**
```
rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white px-3 py-1 text-xs font-medium transition-colors hover:border-[#403770] hover:text-[#403770]
```

**Active:**
```
rounded-full bg-[#403770] text-white border border-transparent px-3 py-1 text-xs font-medium transition-colors
```

**Optional count badge** (append inside the chip label):
```
<span className="text-[10px] font-bold bg-white/20 rounded-full px-1.5 ml-1">{count}</span>
```

**Use case:** Filter chips (by state, status, type), view toggles, category selectors.

**TSX example:**
```tsx
{/* Inactive chip */}
<button
  onClick={() => setActiveFilter("all")}
  className="rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white px-3 py-1 text-xs font-medium transition-colors hover:border-[#403770] hover:text-[#403770] focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  All States
</button>

{/* Active chip with count badge */}
<button
  onClick={() => setActiveFilter("planned")}
  className="rounded-full bg-[#403770] text-white border border-transparent px-3 py-1 text-xs font-medium transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  Planned
  <span className="text-[10px] font-bold bg-white/20 rounded-full px-1.5 ml-1">12</span>
</button>
```

---

## States

| State | Description |
|-------|-------------|
| Default | Base variant classes as defined above |
| Hover | Each variant defines its own hover — see `hover:` classes in each section |
| Active / Pressed | `bg-[#322a5a]` for Primary; outlined variants: border color becomes fill on mousedown |
| Disabled | `opacity-50 cursor-not-allowed pointer-events-none` — see `_foundations.md` |
| Loading | Spinner replaces or precedes label; button is disabled — see Loading State below |
| Focus | `focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none` — see `_foundations.md` |

---

## Loading State

While an async action is in-flight, the button shows a spinner and is disabled to prevent double submission.

**Spinner classes:**
```
w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin
```

The spinner uses `border-current` so it inherits the button's text color. Keep the label text alongside the spinner (don't hide it) to preserve button width and prevent layout shift.

**TSX example:**
```tsx
<button
  disabled={isSubmitting}
  className={`inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none ${
    isSubmitting ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
  }`}
>
  {isSubmitting && (
    <span className="w-3.5 h-3.5 border-2 border-current border-t-transparent rounded-full animate-spin" />
  )}
  {isSubmitting ? "Saving..." : "Save"}
</button>
```

---

## Button Groups

When multiple buttons appear together horizontally:

| Size tier | Gap |
|-----------|-----|
| Small | `gap-2` |
| Medium | `gap-3` |
| Large | `gap-3` |

**Alignment:** Right-align action groups in modal footers and toolbars with `flex justify-end`. Use `flex items-center` for vertical alignment within the group.

**Common patterns:**

```tsx
{/* Modal footer — destructive left, cancel + confirm right */}
<div className="flex items-center justify-between mt-6">
  <button className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-[#F37167] text-[#F37167] rounded-lg hover:bg-[#F37167] hover:text-white transition-colors focus-visible:ring-2 focus-visible:ring-[#F37167]/30 focus-visible:outline-none">
    Delete
  </button>
  <div className="flex items-center gap-3">
    <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
      Cancel
    </button>
    <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
      Save
    </button>
  </div>
</div>

{/* Toolbar — right-aligned primary */}
<div className="flex items-center justify-between">
  <h1 className="text-xl font-bold text-[#403770]">Territory Plans</h1>
  <button className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none">
    Create Plan
  </button>
</div>
```

---

## Keyboard

Standard `<button>` keyboard behavior applies (`Enter` / `Space` to activate). See `_foundations.md` for focus ring conventions.

---

## Codebase Examples

| Button | Variant | Size | File |
|--------|---------|------|------|
| "Create Plan" header button | Primary | Medium | `src/features/shared/components/views/PlansView.tsx` |
| "Create Your First Plan" empty state | Primary | Large | `src/features/shared/components/views/PlansView.tsx` |
| "New Activity" toolbar button | Primary | Medium | `src/features/shared/components/views/PlansView.tsx` |
| "Edit" plan header button | Secondary | Small | `src/features/shared/components/views/PlansView.tsx` |
| "Delete" plan header button | Destructive | Small | `src/features/shared/components/views/PlansView.tsx` |
| "Cancel" delete confirmation | Ghost | Medium | `src/features/shared/components/views/PlansView.tsx` |
| Back arrow button (plan header) | Icon-only | Medium | `src/features/shared/components/views/PlansView.tsx` |
| Sidebar nav items | Ghost (custom active) | Large | `src/features/shared/components/navigation/Sidebar.tsx` |
| Collapse/expand toggle | Icon-only | Medium | `src/features/shared/components/navigation/Sidebar.tsx` |
| Tab navigation buttons | Ghost (with active indicator) | Medium | `src/features/plans/components/PlanTabs.tsx` |
| Filter chip badges | Chip/Toggle | — | `src/features/map/components/panels/district/signals/SignalCard.tsx` |
| SignalCard expand toggle | Icon-only (ghost text) | Small | `src/features/map/components/panels/district/signals/SignalCard.tsx` |
