# Resources Tab — Design Spec

**Date:** 2026-03-15
**Status:** Approved

## Overview

Add a "Resources" tab to the main app sidebar that opens a wiki-style knowledge base. Left sidebar lists resource pages, right content area renders the selected page. First page: ICP Scoring report (migrated from `/admin/icp-scoring`).

## Sidebar Changes

### TabId update
Add `"resources"` to the `TabId` union type in:
- `src/features/shared/lib/app-store.ts`
- `src/features/shared/components/navigation/Sidebar.tsx`

### Tab position
After "Progress", before "Profile" (bottom). In `MAIN_TABS` array, last item.

### Icon
Lucide `BookOpen` — import from `lucide-react`. Render as inline SVG matching the existing icon pattern (stroke-based, `w-5 h-5`, `currentColor`). If the codebase uses custom SVG icons instead of Lucide imports in the sidebar, match that pattern — create a `ResourcesIcon` component with a book-open SVG path.

### VALID_TABS
Add `"resources"` to the `VALID_TABS` array in `src/app/page.tsx`.

### renderContent
Add case for `"resources"` in the tab content switch in `page.tsx`:
```tsx
case "resources":
  return <ResourcesView />;
```

---

## ResourcesView Component

**File:** `src/features/shared/components/views/ResourcesView.tsx`

### Layout
Two-column flex layout filling the AppShell content area:

```
┌──────────────────────────────────────────────────────┐
│ Resources (header)                                    │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ ICP      │  [Selected resource page content]         │
│ Scoring  │                                           │
│          │                                           │
│ (future  │                                           │
│  pages)  │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

### Left sidebar
- Width: `w-56` fixed, `flex-shrink-0`
- Background: `bg-white`
- Right border: `border-r border-[#E2DEEC]`
- Full height: `h-full overflow-y-auto`

**Page links:**
- Each link: `block px-4 py-2.5 text-sm font-medium transition-colors duration-100`
- Active: `border-l-[3px] border-[#F37167] bg-[#fef1f0] text-[#F37167]`
- Inactive: `border-l-[3px] border-transparent text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770]`

### Right content area
- `flex-1 overflow-y-auto h-full`
- Background: `bg-off-white` (`#FFFCFA`)
- Padding: `px-6 py-6`
- Renders the selected page component

### Page registry
```tsx
const RESOURCE_PAGES = [
  { id: "icp-scoring", label: "ICP Scoring", component: IcpScoringReport },
] as const;
```

Adding a future page = one line in this array + creating the component.

### State
- `activePageId` — local `useState`, defaults to first page in registry
- No URL param sync needed for v1 (can add `?resource=icp-scoring` later)

---

## IcpScoringReport Component

**File:** `src/features/resources/components/IcpScoringReport.tsx`

A thin wrapper that extracts the report content from the standalone admin page. It:
1. Calls `useDistrictScores()` from `src/app/admin/icp-scoring/hooks`
2. Renders the same loading/error/empty states
3. Renders the same 7 section components (HeroSection, TierDistribution, etc.)
4. Does NOT render the sticky page header or Export CSV button (those are in the ResourcesView or omitted since the AppShell provides the header context)

The 7 section components stay in `src/app/admin/icp-scoring/components/` — they're imported from there. No duplication.

The standalone `/admin/icp-scoring` page remains as-is for direct access.

---

## Token Compliance

All new UI follows `Documentation/UI Framework/tokens.md`:

| Element | Classes |
|---------|---------|
| Resource sidebar bg | `bg-white` |
| Sidebar border | `border-r border-[#E2DEEC]` |
| Active link | `border-l-[3px] border-[#F37167] bg-[#fef1f0] text-[#F37167]` |
| Inactive link | `text-[#6E6390]` |
| Inactive hover | `hover:bg-[#EFEDF5] hover:text-[#403770]` |
| Content area bg | `bg-off-white` (`#FFFCFA`) |
| Page link text | `text-sm font-medium` |

Active state matches the sidebar's existing coral accent pattern from `Navigation/_foundations.md`.

---

## Files Changed

```
Modify: src/features/shared/lib/app-store.ts                    — TabId + "resources"
Modify: src/features/shared/components/navigation/Sidebar.tsx    — Resources tab + icon
Modify: src/app/page.tsx                                         — VALID_TABS + renderContent case
Create: src/features/shared/components/views/ResourcesView.tsx   — Two-column layout + page router
Create: src/features/resources/components/IcpScoringReport.tsx   — Report wrapper importing existing sections
```
