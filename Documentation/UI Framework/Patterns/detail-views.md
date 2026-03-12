# Detail Views

Detail views show the full information about a single entity (district, plan, account). They share a common anatomy: back-button header, entity header, tab strip or card stack, scrollable content.

---

## Decision Tree: Which Detail Layout?

```
1. Showing a full district with all data cards?
   → District Detail Panel (card stack layout)

2. Showing a plan with sections for districts/tasks/activities?
   → Plan Workspace (icon tab strip layout)

3. Showing a district summary inside a plan workspace?
   → District Card in RightPanel (compact card layout)
```

---

## Common Anatomy

```
┌─ Back Button Header ──────────────────────┐
│  [←]  ENTITY TYPE (uppercase label)       │
├───────────────────────────────────────────┤
│  Entity Header                             │
│  - Name (text-lg font-bold text-[#403770])│
│  - Metadata line (text-xs text-[#8A80A8]) │
│  - Tags / signal badges                   │
├───────────────────────────────────────────┤
│  Tab Strip (optional)                      │
├───────────────────────────────────────────┤
│  Scrollable Content                        │
│  - Card stack or section content           │
└───────────────────────────────────────────┘
```

Outer shell is always `flex flex-col h-full`, scrollable area is `flex-1 overflow-y-auto`.

---

## Back Button Header Pattern

All detail views open with a back-button row that doubles as a breadcrumb label.

```tsx
{/* Back button header — DistrictDetailPanel */}
<div className="flex items-center gap-2 px-3 py-2.5 border-b border-[#E2DEEC]">
  <button
    onClick={goBack}
    className="w-7 h-7 rounded-lg hover:bg-[#EFEDF5] flex items-center justify-center transition-colors text-[#A69DC0] hover:text-[#403770]"
    aria-label="Go back"
  >
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
      <path
        d="M9 3L5 7L9 11"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  </button>
  <span className="text-xs font-medium text-[#A69DC0] uppercase tracking-wider">
    District
  </span>
</div>
```

**Codebase status:** `DistrictDetailPanel` still uses `border-gray-100`, `stroke="#6B7280"`, `text-gray-400`, and `hover:bg-gray-100`. Migrate to the token-based values shown above when next modified.

---

## Entity Header Variants

| Element | District Header | Plan Workspace Header |
|---------|----------------|----------------------|
| Name | `text-lg font-bold text-[#403770]` | `text-sm font-semibold text-[#403770]` |
| Account type badge | `px-2 py-0.5 text-[10px] bg-plum/10 text-plum rounded-full` | -- |
| Metadata line | State + County + LEAID in `text-xs text-[#8A80A8]` | -- |
| External links | Website + Job Board icon buttons (`w-7 h-7 rounded-lg`) | Edit button (pencil icon, `w-7 h-7 rounded-lg`) |
| Tags | Color-coded tag pills (`rounded-full text-white` + `style={{ backgroundColor }}`) | Status + FY + district count + state badges |
| Signal strip | `SignalBadge` trend indicators (compact) | -- |
| Compact stats | Enrollment, Grades, Schools in `text-xs text-[#8A80A8]` | Owner + collaborators badges |

### District Header

```tsx
{/* DistrictHeader.tsx — entity header */}
<div className="px-3 pt-3 pb-2 border-b border-[#E2DEEC] bg-gradient-to-b from-[#FFFCFA] to-white">
  <h2 className="text-lg font-bold text-[#403770] pr-8 leading-tight">
    {district.name}
  </h2>
  {/* Account type badge — only for non-district accounts */}
  {district.accountType && district.accountType !== "district" && (
    <span className="inline-block px-2 py-0.5 text-[10px] font-medium bg-plum/10 text-plum rounded-full">
      {getAccountTypeLabel(district.accountType)}
    </span>
  )}
  {/* Metadata: State · County · LEAID */}
  <div className="flex items-center gap-2 mt-1 text-xs text-[#8A80A8]">
    <span>{district.stateAbbrev}</span>
    <span>·</span>
    <span>{district.countyName} County</span>
    <span>·</span>
    <span className="font-mono">{district.leaid}</span>
  </div>
  {/* Tags — color-coded pills */}
  <div className="flex flex-wrap gap-1.5 mt-2">
    {tags.map((tag) => (
      <span
        key={tag.id}
        className="inline-flex items-center px-2.5 py-0.5 text-xs font-medium rounded-full text-white"
        style={{ backgroundColor: tag.color }}
      >
        {tag.name}
      </span>
    ))}
  </div>
  {/* Signal strip — compact trend badges */}
  <div className="flex flex-wrap gap-1.5 mt-2">
    <SignalBadge trend={trends.enrollmentTrend3yr} compact label="↑ Enrollment" />
    {/* ... additional signal badges */}
  </div>
  {/* Compact stats */}
  <div className="mt-2 text-xs text-[#8A80A8]">
    {district.enrollment.toLocaleString()} students · {formatGrades(...)} · {district.numberOfSchools} schools
  </div>
</div>
```

### Plan Workspace Header

```tsx
{/* PlanWorkspace.tsx — header with inline back button */}
<div className="px-3 pt-2.5 pb-2 border-b border-[#E2DEEC]">
  <div className="flex items-center gap-2 mb-2">
    <button onClick={goBack} className="w-7 h-7 rounded-lg hover:bg-[#EFEDF5] text-[#A69DC0] hover:text-[#403770] ..." aria-label="Go back">
      {/* ← arrow SVG */}
    </button>
    <h2 className="text-sm font-semibold text-[#403770] truncate flex-1">
      {plan.name}
    </h2>
    <button onClick={() => openRightPanel({ type: "plan_edit" })} className="w-7 h-7 rounded-lg text-[#A69DC0] hover:text-[#403770] ..." aria-label="Edit plan">
      {/* pencil SVG — uses currentColor */}
    </button>
  </div>
  {/* Badge row */}
  <div className="flex gap-1.5 flex-wrap ml-9 mb-2">
    <span className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.bg} ${badge.text} capitalize`}>
      {plan.status}
    </span>
    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-plum/10 text-plum">
      FY {plan.fiscalYear}
    </span>
    <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-[#EFEDF5] text-[#6E6390]">
      {plan.districts.length} districts
    </span>
    {/* State badges: bg-[#e8f1f5] text-[#4d7285] */}
    {/* Owner: bg-[#EFEDF5] text-[#6E6390] */}
    {/* Collaborators: bg-plum/10 text-plum */}
  </div>
</div>
```

**Codebase status (both headers):** Current code uses `border-gray-100`, `text-gray-500`, `text-gray-800`, `hover:bg-gray-100`, `stroke="#9CA3AF"`, `bg-gray-100 text-gray-600` badges. Migrate to the token-based values shown above when next modified.

---

## Tab Strip Pattern

Two variants share identical button styling.

| Variant | Component | Used by |
|---------|-----------|---------|
| `DistrictTabStrip` | Exported in `panels/district/tabs/DistrictTabStrip.tsx` | DistrictCard in right panel |
| `PlanIconStrip` | Inline function in `PlanWorkspace.tsx` (not exported) | Plan workspace |

**Shared styling:**

| Part | Classes |
|------|---------|
| Container | `flex border-b border-[#E2DEEC]` |
| Button | `flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors` |
| Active | `bg-plum/10 text-plum` |
| Inactive | `text-[#A69DC0] hover:text-[#6E6390] hover:bg-[#F7F5FA]` |
| Icon | `width="14" height="14" viewBox="0 0 16 16"`, `stroke="currentColor"` |

```tsx
{/* Tab button pattern — shared by both strip variants */}
<button
  onClick={() => onSelect(tab.key)}
  className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
    isActive
      ? "bg-plum/10 text-plum"
      : "text-[#A69DC0] hover:text-[#6E6390] hover:bg-[#F7F5FA]"
  }`}
>
  <svg width="14" height="14" viewBox="0 0 16 16" fill="none" className="shrink-0">
    <path
      d={tab.path}
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
      fill={tab.stroke ? "none" : "currentColor"}
    />
  </svg>
  <span>{tab.label}</span>
</button>
```

`DistrictTabStrip` adds a contact count badge on the "Contacts" tab:

```tsx
{/* Badge overlay on tab icon */}
{tab.key === "contacts" && contactCount > 0 && (
  <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-plum text-white text-[8px] font-bold px-0.5">
    {contactCount > 99 ? "99+" : contactCount}
  </span>
)}
```

**Codebase status:** Both tab strip variants still use `border-gray-100`, `text-gray-400`, `hover:text-gray-600`, `hover:bg-gray-50`. Migrate to the token-based values shown above when next modified.

---

## Card Stack Layout

District detail uses a vertical card stack for data sections.

**Container:** `<div className="p-3 space-y-3">` wrapping multiple `SignalCard` components.

### SignalCard Anatomy

| Part | Classes |
|------|---------|
| Shell | `border border-[#D4CFE2] rounded-lg bg-white` |
| Header row | `flex items-center justify-between px-3 pt-3 pb-1` |
| Icon | `text-[#A69DC0]` wrapper around SVG |
| Title | `text-sm font-semibold text-[#403770]` |
| Badge | Right-aligned slot (ReactNode) |
| Content | `px-3 pb-3` |
| Expand toggle | `w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-[#A69DC0] hover:text-[#403770] border-t border-[#E2DEEC]` |
| Expanded content | `px-3 pb-3 border-t border-[#E2DEEC]` |

```tsx
{/* SignalCard usage — DistrictDetailPanel */}
<SignalCard
  icon={
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19.128a9.38 ..." />
    </svg>
  }
  title={`Contacts (${contacts.length})`}
  badge={<></>}
  detail={<DetailContent />}     {/* optional — enables expand/collapse */}
  defaultExpanded={false}
>
  <ContactsList leaid={selectedLeaid} contacts={contacts} />
</SignalCard>
```

Chevron rotates on expand: `transition-transform ${expanded ? "rotate-90" : ""}`.

**Codebase status:** `SignalCard` still uses `border-gray-100`, `rounded-xl`, `border-gray-50`, `text-gray-400`. Migrate to the token-based values shown above when next modified.

---

## Loading & Error States

### Skeleton Patterns

**District detail skeleton** (`DistrictDetailPanel > LoadingSkeleton`):

| Element | Classes |
|---------|---------|
| Name placeholder | `h-5 bg-[#C4E7E6]/20 rounded w-4/5 animate-pulse` |
| Metadata placeholder | `h-3 bg-[#C4E7E6]/15 rounded w-1/3 animate-pulse` |
| Tag row | `h-5 bg-[#C4E7E6]/20 rounded-full w-20 animate-pulse` (x4) |
| Card skeleton | `border border-[#D4CFE2] rounded-lg p-3 animate-pulse space-y-2` |

**Plan workspace skeleton** (`PlanWorkspace` inline):

| Element | Classes |
|---------|---------|
| Title placeholder | `h-4 bg-[#C4E7E6]/20 rounded w-3/4 animate-pulse` |
| Badge placeholders | `h-5 bg-[#C4E7E6]/20 rounded-full w-14 animate-pulse` |

**District card skeleton** (`DistrictCard > LoadingSkeleton`):

| Element | Classes |
|---------|---------|
| Name placeholder | `h-4 bg-[#C4E7E6]/20 rounded w-3/4 animate-pulse` |
| Badge placeholder | `h-5 bg-plum/10 rounded-full w-20 animate-pulse` |
| Stat grid | `grid grid-cols-2 gap-1.5` with `rounded-lg bg-[#F7F5FA] p-2 animate-pulse` cells |

### Error / Not Found

| State | Classes | Message |
|-------|---------|---------|
| Error | `text-center py-8 text-sm text-[#F37167]` | "Failed to load district details" |
| Not found | `text-center py-8 text-sm text-[#A69DC0]` | "District not found" |

**Migration note:** Skeleton fills use on-brand `bg-[#C4E7E6]/20` in district detail but plain `bg-gray-200` in plan workspace and district card. Plan/card skeletons should migrate to `bg-[#C4E7E6]/20`.

---

## Codebase Reference

| Component | File |
|-----------|------|
| District detail panel | `src/features/map/components/panels/district/DistrictDetailPanel.tsx` |
| District header | `src/features/map/components/panels/district/DistrictHeader.tsx` |
| District tab strip | `src/features/map/components/panels/district/tabs/DistrictTabStrip.tsx` |
| Plan workspace | `src/features/map/components/panels/PlanWorkspace.tsx` |
| Signal card (expandable) | `src/features/map/components/panels/district/signals/SignalCard.tsx` |
| Signal badge (trend) | `src/features/map/components/panels/district/signals/SignalBadge.tsx` |
| District card (right panel) | `src/features/map/components/right-panels/DistrictCard.tsx` |
