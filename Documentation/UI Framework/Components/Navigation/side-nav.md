# Side Navigation

Vertical navigation patterns for app shell and panels.

See `_foundations.md` for active state system, size scale, focus ring, and keyboard conventions.

---

## App Sidebar

### Container

```
flex flex-col bg-white border-r border-[#D4CFE2]
```

| State | Width |
|---|---|
| Expanded | `w-[140px]` |
| Collapsed | `w-14` |

Transition: `transition-all duration-200 ease-in-out`

### Nav Items

Uses the **Large** size tier from foundations: `text-sm font-medium`, `px-5 py-2.5`, `w-5 h-5` icons.

Active state uses the coral accent system from `_foundations.md`:

```tsx
<nav className="flex flex-col py-2">
  {/* Active item */}
  <a
    href="/home"
    aria-current="page"
    className="flex items-center gap-2 px-5 py-2.5 border-l-3 border-[#F37167] bg-[#fef1f0] text-[#F37167] text-sm font-medium transition-colors duration-100"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" />
    </svg>
    Home
  </a>

  {/* Inactive item */}
  <a
    href="/map"
    className="flex items-center gap-2 px-5 py-2.5 border-l-3 border-transparent text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770] text-sm font-medium transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
  >
    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
    </svg>
    Map
  </a>
</nav>
```

### Divider

Between main and bottom nav sections:

```
mx-3 border-t border-[#E2DEEC]
```

### Collapse Toggle

Chevron button at sidebar bottom:

```
border-t border-[#E2DEEC]
```

See `collapsible-views.md` for the sidebar collapse pattern, including collapsed tooltips.

### Collapsed Tooltips

When sidebar is collapsed, hovering an icon shows a tooltip:

```
bg-[#403770] text-white text-sm rounded-lg shadow-lg px-2 py-1 z-50
```

---

## Icon Bar (Panel Strip)

### Container

```
flex flex-col items-center py-3 gap-1 w-[56px] border-r border-[#E2DEEC]
```

### Items

```
w-9 h-9 rounded-xl
```

Uses **Medium** icon size: `w-4 h-4`

### States

| State | Classes |
|---|---|
| Active | `bg-[#fef1f0]` tint (coral system adapted for icon-only) |
| Inactive | Default, no background |
| Inactive hover | `hover:bg-[#EFEDF5]` |

### Tooltips

Same spec as sidebar collapsed tooltips:

```
bg-[#403770] text-white text-sm rounded-lg shadow-lg px-2 py-1 z-50
```

### Quick Action Button

Sits at the bottom of the icon bar:

```
bg-[#403770] text-white rounded-xl hover:bg-[#322a5a] shadow-sm
```

```tsx
<div className="flex flex-col items-center py-3 gap-1 w-[56px] border-r border-[#E2DEEC]">
  {/* Active panel icon */}
  <button
    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#fef1f0] text-[#F37167] transition-colors duration-100"
    title="Explore"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
    </svg>
  </button>

  {/* Inactive panel icon */}
  <button
    className="w-9 h-9 rounded-xl flex items-center justify-center text-[#A69DC0] hover:bg-[#EFEDF5] hover:text-[#403770] transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
    title="Layers"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
    </svg>
  </button>

  {/* Spacer */}
  <div className="flex-1" />

  {/* Quick action */}
  <button
    className="w-9 h-9 rounded-xl flex items-center justify-center bg-[#403770] text-white hover:bg-[#322a5a] shadow-sm transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
    title="Add new"
  >
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
    </svg>
  </button>
</div>
```

---

## Migration Notes

Current codebase deviations that should be updated to match this spec:

| File | Current | Target |
|---|---|---|
| `Sidebar.tsx` | `border-gray-200` | `border-[#D4CFE2]` |
| `Sidebar.tsx` | `hover:bg-gray-50` | `hover:bg-[#EFEDF5]` |
| `IconBar.tsx` | `text-gray-300` / `text-gray-400` | `text-[#A69DC0]` |

## Keyboard

- Arrow keys navigate between nav items
- `Tab` enters/exits the nav group
- `Enter` / `Space` activates a nav item

## Codebase Examples

| Component | File |
|---|---|
| Sidebar | `src/features/shared/components/navigation/Sidebar.tsx` |
| IconBar | `src/features/map/components/IconBar.tsx` |
| AppShell | `src/features/shared/components/layout/AppShell.tsx` |
