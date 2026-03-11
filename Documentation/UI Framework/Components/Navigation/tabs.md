# Tabs

Horizontal and vertical tabbed navigation.

See `_foundations.md` for active state system, size scale, and keyboard conventions.

---

## Horizontal Tabs

### Container

```tsx
<nav className="flex items-center border-b border-[#E2DEEC]" aria-label="Tabs">
```

### Tab Button

Uses **Medium** size tier: `text-sm font-medium`, `px-6 py-3`.

```
relative flex items-center gap-2 px-6 py-3
```

### Active State

Coral bottom indicator with coral text:

```tsx
{/* Active tab */}
<button
  aria-current="page"
  className="relative flex items-center gap-2 px-6 py-3 text-sm font-medium text-[#F37167] transition-colors duration-100"
>
  <svg className="w-4 h-4 text-[#F37167]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
  </svg>
  Districts
  <span className="bg-[#403770] text-white px-2 py-0.5 text-xs font-semibold rounded-full">24</span>
  {/* Coral bottom indicator */}
  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
</button>
```

### Inactive State

```tsx
{/* Inactive tab */}
<button
  className="relative flex items-center gap-2 px-6 py-3 text-sm font-medium text-[#8A80A8] hover:text-[#403770] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
>
  <svg className="w-4 h-4 text-[#A69DC0] hover:text-[#6EA3BE]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857M7 20H2v-2a3 3 0 015.356-1.857M7 20v-2c0-.656.126-1.283.356-1.857m0 0a5.002 5.002 0 019.288 0M15 7a3 3 0 11-6 0 3 3 0 016 0z" />
  </svg>
  Contacts
  <span className="bg-[#EFEDF5] text-[#8A80A8] px-2 py-0.5 text-xs font-semibold rounded-full">8</span>
</button>
```

### Icon States

| State | Classes |
|---|---|
| Active | `text-[#F37167]` |
| Inactive | `text-[#A69DC0]` |
| Inactive hover | `text-[#6EA3BE]` |

### Count Badge

| State | Classes |
|---|---|
| Active | `bg-[#403770] text-white px-2 py-0.5 text-xs font-semibold rounded-full` |
| Inactive | `bg-[#EFEDF5] text-[#8A80A8] px-2 py-0.5 text-xs font-semibold rounded-full` |

---

## Vertical Tabs

### Container

```
flex flex-col gap-1
```

Uses the coral left-border active system from `_foundations.md` and the **Large** size tier.

```tsx
<nav className="flex flex-col gap-1" aria-label="Settings">
  {/* Active */}
  <a
    href="/settings/general"
    aria-current="page"
    className="flex items-center gap-2 px-5 py-2.5 border-l-3 border-[#F37167] bg-[#fef1f0] text-[#F37167] text-sm font-medium transition-colors duration-100"
  >
    General
  </a>

  {/* Inactive */}
  <a
    href="/settings/notifications"
    className="flex items-center gap-2 px-5 py-2.5 border-l-3 border-transparent text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770] text-sm font-medium transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
  >
    Notifications
  </a>
</nav>
```

---

## Migration Notes

Current codebase deviations that should be updated to match this spec:

| File | Current | Target |
|---|---|---|
| `PlanTabs.tsx` | `border-gray-200` | `border-[#E2DEEC]` |
| `PlanTabs.tsx` | `text-gray-500` | `text-[#8A80A8]` |
| `PlanTabs.tsx` | `bg-gray-100` (inactive badges) | `bg-[#EFEDF5]` |

## Keyboard

- Arrow keys navigate between tabs
- `Home` / `End` jump to first/last tab
- `Tab` key moves focus out of the tab group

## Codebase Examples

| Component | File |
|---|---|
| PlanTabs | `src/features/plans/components/PlanTabs.tsx` |
