# Tabs

Organize content into switchable views within a single container.

See `_foundations.md` for shared styling foundations.

For tab strip navigation mechanics (active states, keyboard, indicator styling), see `Navigation/tabs.md`. This file covers the tab container shell.

---

## When to Use

- Use when content naturally groups into parallel views within one context
- Use when the user needs to switch between related data sets without leaving the page
- Don't use when content should be visible simultaneously (just lay it out)
- Don't use when sections can be expanded/collapsed independently (use [Accordion](accordion.md) instead)

## Tab Strip Styling

### Horizontal Text Tabs

Active: `text-[#F37167]` with `h-0.5 bg-[#F37167]` bottom indicator.
Inactive: `text-[#8A80A8]`.
Hover: `text-[#403770]`.

Strip border: `border-b border-[#E2DEEC]`

See `Navigation/tabs.md` for full tab strip anatomy and TSX snippets.

### Icon Tabs (Compact)

Active: `bg-[#403770]/10 text-[#403770]`
Inactive: `text-[#A69DC0] hover:text-[#6E6390] hover:bg-[#F7F5FA]`

```tsx
{/* Icon tab button */}
<button
  className={`p-2 rounded-lg transition-colors ${
    isActive
      ? 'bg-[#403770]/10 text-[#403770]'
      : 'text-[#A69DC0] hover:text-[#6E6390] hover:bg-[#F7F5FA]'
  }`}
  aria-label={label}
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    {/* Icon path */}
  </svg>
</button>
```

## Tab Container Shell

The tab strip sits at the top of a container. Content area below switches based on active tab.

```tsx
<div className="bg-white rounded-lg shadow-sm border border-[#D4CFE2]">
  {/* Tab strip */}
  <nav className="flex items-center border-b border-[#E2DEEC]" aria-label="Tabs">
    {/* Tab buttons — see Navigation/tabs.md */}
  </nav>

  {/* Active tab content */}
  <div className="p-4">
    {activeTab === 'overview' && <OverviewContent />}
    {activeTab === 'details' && <DetailsContent />}
  </div>
</div>
```

## Badge on Tab

Count badge sitting next to tab label:

```
bg-[#403770] text-white rounded-full px-2 py-0.5 text-xs font-semibold
```

## Keyboard

- Arrow keys navigate between tabs
- `Enter` / `Space` activates a tab
- `Home` / `End` jump to first/last tab
- `Tab` key moves focus out of the tab group

## Codebase Examples

| Component | File | Conformance |
|-----------|------|-------------|
| DistrictTabStrip | `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx` | Icon tab variant, uses `bg-[#403770]/10` — conformant |
| PlanWorkspace | `src/features/map/components/panels/PlanWorkspace.tsx` | Icon tabs for plan sections — conformant |
