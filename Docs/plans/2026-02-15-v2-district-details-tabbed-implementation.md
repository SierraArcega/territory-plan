# V2 District Details Tabbed View — Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace the simplified DistrictDetailPanel in the v2 map with the full 3-tab district details view (District Info, Data + Demographics, Contacts) ported from v1.

**Architecture:** Copy v1 panel components (`src/components/panel/`) into a new `src/components/map-v2/panels/district/` directory and adapt them for the v2 floating panel context. The main adaptation is swapping `useMapStore` → `useMapV2Store`, tightening spacing to fit the v2 aesthetic, and updating the import in `PanelContent.tsx` to point at the new location.

**Tech Stack:** Next.js 16, React 19, TypeScript, Recharts (existing), TanStack React Query (existing), Zustand (existing), Tailwind CSS

---

## Reference Files

**V1 source components (copy from):**
- `src/components/panel/tabs/DistrictTabContent.tsx` — main container with 3-tab layout, CharterSchoolsSection, MiniSparkline
- `src/components/panel/DistrictHeader.tsx` — name, state, enrollment, grades, links, tags
- `src/components/panel/DistrictInfo.tsx` — address, phone, ELL/SPED counts
- `src/components/panel/FullmindMetrics.tsx` — FY revenue bars
- `src/components/panel/CompetitorSpend.tsx` — competitor spend by company
- `src/components/panel/DemographicsChart.tsx` — donut chart (Recharts)
- `src/components/panel/StudentPopulations.tsx` — ELL, SPED, absenteeism
- `src/components/panel/AcademicMetrics.tsx` — graduation rates
- `src/components/panel/FinanceData.tsx` — revenue donut, per-pupil (Recharts)
- `src/components/panel/StaffingSalaries.tsx` — FTE breakdown, salary
- `src/components/panel/ContactsList.tsx` — CRUD + Clay integration
- `src/components/panel/TagsEditor.tsx` — tag management
- `src/components/panel/NotesEditor.tsx` — notes + owner
- `src/components/panel/FindSimilarDistricts.tsx` — similarity search
- `src/components/panel/AddToPlanButton.tsx` — plan assignment

**V2 integration points:**
- `src/components/map-v2/PanelContent.tsx` — routes `panelState === "DISTRICT"` to `DistrictDetailPanel`
- `src/components/map-v2/panels/DistrictDetailPanel.tsx` — current simplified panel (will be replaced)
- `src/lib/map-v2-store.ts` — v2 zustand store (uses `goBack()`, `startNewPlan()`, `selectedLeaid`)
- `src/lib/api.ts` — all data hooks (shared, no changes needed)

**Key adaptation rules:**
- `useMapStore` → `useMapV2Store` everywhere
- `goBackToDistrictsList()` → `goBack()` (v2 uses history stack)
- `openSchoolPanel(ncessch)` → remove or adapt (v2 doesn't have school panel yet — make charter school items non-clickable for now)
- Spacing: v1 uses `px-6 py-4`, v2 uses `px-3 py-3` (tighter for floating panel)
- Sections: v1 uses `border-b border-gray-100`, v2 can keep same pattern

---

### Task 1: Create directory and main DistrictDetailPanel shell with tabs

**Files:**
- Create: `src/components/map-v2/panels/district/DistrictDetailPanel.tsx`
- Modify: `src/components/map-v2/PanelContent.tsx:5` (update import path)

**Step 1: Create the district directory**

```bash
mkdir -p src/components/map-v2/panels/district
```

**Step 2: Create the new DistrictDetailPanel.tsx**

Copy the structure from `src/components/panel/tabs/DistrictTabContent.tsx` but adapted for v2:
- Use `useMapV2Store` instead of `useMapStore`
- Use `selectedLeaid` from store instead of props
- Use `goBack()` for navigation
- Include the v2-style back button header
- Include the TabButton and DistrictSubTabs components inline
- Render tab content placeholders (will be filled in later tasks)

The component should:
1. Read `selectedLeaid` from `useMapV2Store`
2. Call `useDistrictDetail(selectedLeaid)`
3. Show loading spinner, error, or empty states
4. Render back button + DistrictHeader (placeholder for now — just district name)
5. Render tab bar with 3 tabs
6. Render selected tab content (placeholder divs with "Coming soon" for now)

**Step 3: Update PanelContent.tsx import**

Change line 5 from:
```typescript
import DistrictDetailPanel from "./panels/DistrictDetailPanel";
```
to:
```typescript
import DistrictDetailPanel from "./panels/district/DistrictDetailPanel";
```

**Step 4: Verify it compiles**

```bash
cd territory-plan && npx next build --no-lint 2>&1 | head -30
```
Or just run the dev server and navigate to a district.

**Step 5: Commit**

```bash
git add src/components/map-v2/panels/district/DistrictDetailPanel.tsx src/components/map-v2/PanelContent.tsx
git commit -m "feat(map-v2): scaffold tabbed DistrictDetailPanel shell"
```

---

### Task 2: Port DistrictHeader

**Files:**
- Create: `src/components/map-v2/panels/district/DistrictHeader.tsx`
- Modify: `src/components/map-v2/panels/district/DistrictDetailPanel.tsx` (import and use)

**Step 1: Copy and adapt DistrictHeader**

Copy from `src/components/panel/DistrictHeader.tsx`. Adaptations:
- Tighten padding: `px-6 pt-6 pb-4` → `px-3 pt-3 pb-2`
- Keep all content: name, state/county/LEAID, external links, tags, enrollment/grades/schools grid, sales executive, account name
- Keep brand colors and gradient

**Step 2: Wire into DistrictDetailPanel**

Import the new `DistrictHeader` and render it between the back button and the tab bar, passing `district`, `fullmindData`, and `tags` from the `useDistrictDetail` data.

**Step 3: Verify it renders**

Run dev server, click a district, confirm header shows with name, metadata, and links.

**Step 4: Commit**

```bash
git add src/components/map-v2/panels/district/DistrictHeader.tsx src/components/map-v2/panels/district/DistrictDetailPanel.tsx
git commit -m "feat(map-v2): port DistrictHeader to v2 panel"
```

---

### Task 3: Port District Info tab — CRM components

**Files:**
- Create: `src/components/map-v2/panels/district/FullmindMetrics.tsx`
- Create: `src/components/map-v2/panels/district/CompetitorSpend.tsx`
- Create: `src/components/map-v2/panels/district/AddToPlanButton.tsx`
- Create: `src/components/map-v2/panels/district/FindSimilarDistricts.tsx`

**Step 1: Copy FullmindMetrics**

Copy from `src/components/panel/FullmindMetrics.tsx`. Adaptations:
- Tighten padding from `px-6 py-4` to `px-3 py-3`
- Keep all FY revenue bars, collapsible behavior, formatCurrency helper

**Step 2: Copy CompetitorSpend**

Copy from `src/components/panel/CompetitorSpend.tsx`. Adaptations:
- Same padding adjustment
- Keep useQuery for `/api/districts/{leaid}/competitor-spend`

**Step 3: Copy AddToPlanButton**

Copy from `src/components/panel/AddToPlanButton.tsx`. Adaptations:
- Keep all plan selection, new plan creation, color picker
- Uses `useTerritoryPlans`, `useAddDistrictsToPlan`, `useCreateTerritoryPlan` from `@/lib/api` (no changes)

**Step 4: Copy FindSimilarDistricts**

Copy from `src/components/panel/FindSimilarDistricts.tsx`. Adaptations:
- Replace `useMapStore` → `useMapV2Store`
- The `highlightDistricts` and `clearHighlight` functions may need adaptation. Check if `useMapV2Store` has equivalent methods. If not, comment out map highlighting for now and add a TODO.

**Step 5: Verify all 4 files compile**

```bash
npx tsc --noEmit 2>&1 | grep "panels/district"
```

**Step 6: Commit**

```bash
git add src/components/map-v2/panels/district/FullmindMetrics.tsx src/components/map-v2/panels/district/CompetitorSpend.tsx src/components/map-v2/panels/district/AddToPlanButton.tsx src/components/map-v2/panels/district/FindSimilarDistricts.tsx
git commit -m "feat(map-v2): port CRM components (FullmindMetrics, CompetitorSpend, AddToPlan, FindSimilar)"
```

---

### Task 4: Port District Info tab — detail components

**Files:**
- Create: `src/components/map-v2/panels/district/DistrictInfo.tsx`
- Create: `src/components/map-v2/panels/district/CharterSchools.tsx`
- Create: `src/components/map-v2/panels/district/TagsEditor.tsx`
- Create: `src/components/map-v2/panels/district/NotesEditor.tsx`

**Step 1: Copy DistrictInfo**

Copy from `src/components/panel/DistrictInfo.tsx`. Adaptations:
- Tighten padding
- Keep address, phone, ELL/SPED counts, collapsible behavior

**Step 2: Extract CharterSchools from DistrictTabContent**

The `CharterSchoolsSection` and `MiniSparkline` are defined inline in `src/components/panel/tabs/DistrictTabContent.tsx` (lines 101-223). Extract them into a standalone `CharterSchools.tsx`:
- Replace `useMapStore((s) => s.openSchoolPanel)` — since v2 doesn't have a school panel yet, make charter school items display-only (remove the onClick/button, use a `<div>` instead)
- Keep the sparkline, enrollment display, school level labels

**Step 3: Copy TagsEditor**

Copy from `src/components/panel/TagsEditor.tsx`. No store dependencies — uses only API hooks (`useTags`, `useCreateTag`, `useAddDistrictTag`, `useRemoveDistrictTag`). Just tighten padding.

**Step 4: Copy NotesEditor**

Copy from `src/components/panel/NotesEditor.tsx`. No store dependencies — uses only `useUpdateDistrictEdits`. Just tighten padding.

**Step 5: Commit**

```bash
git add src/components/map-v2/panels/district/DistrictInfo.tsx src/components/map-v2/panels/district/CharterSchools.tsx src/components/map-v2/panels/district/TagsEditor.tsx src/components/map-v2/panels/district/NotesEditor.tsx
git commit -m "feat(map-v2): port detail components (DistrictInfo, CharterSchools, Tags, Notes)"
```

---

### Task 5: Wire District Info tab

**Files:**
- Create: `src/components/map-v2/panels/district/DistrictInfoTab.tsx`
- Modify: `src/components/map-v2/panels/district/DistrictDetailPanel.tsx` (replace placeholder)

**Step 1: Create DistrictInfoTab**

Model after the `DistrictInfoTab` function in `src/components/panel/tabs/DistrictTabContent.tsx` (lines 226-278):
- Import all sub-components from the local `district/` directory
- Props: `{ data: DistrictDetail; leaid: string }`
- Render in order: FullmindMetrics, CompetitorSpend, action buttons (AddToPlan + FindSimilar), CharterSchools, DistrictInfo, TagsEditor, NotesEditor
- Include TaskList import from `@/components/tasks/TaskList` (shared component, not copied)

**Step 2: Wire into DistrictDetailPanel**

Replace the "Coming soon" placeholder for the info tab with `<DistrictInfoTab data={data} leaid={selectedLeaid} />`.

**Step 3: Verify the info tab renders**

Run dev server, click a district, confirm info tab shows Fullmind data, competitor spend, charters, tags, notes.

**Step 4: Commit**

```bash
git add src/components/map-v2/panels/district/DistrictInfoTab.tsx src/components/map-v2/panels/district/DistrictDetailPanel.tsx
git commit -m "feat(map-v2): wire District Info tab with all sub-components"
```

---

### Task 6: Port Data + Demographics tab components

**Files:**
- Create: `src/components/map-v2/panels/district/DemographicsChart.tsx`
- Create: `src/components/map-v2/panels/district/StudentPopulations.tsx`
- Create: `src/components/map-v2/panels/district/AcademicMetrics.tsx`
- Create: `src/components/map-v2/panels/district/FinanceData.tsx`
- Create: `src/components/map-v2/panels/district/StaffingSalaries.tsx`

**Step 1: Copy DemographicsChart**

Copy from `src/components/panel/DemographicsChart.tsx`. Adaptations:
- Tighten padding
- Recharts `ResponsiveContainer` already handles width — no chart changes needed
- Keep donut chart, legend, tooltip

**Step 2: Copy StudentPopulations**

Copy from `src/components/panel/StudentPopulations.tsx`. Tighten padding. Keep ELL/SPED cards, absenteeism bar, enrollment composition.

**Step 3: Copy AcademicMetrics**

Copy from `src/components/panel/AcademicMetrics.tsx`. Tighten padding. Keep graduation rate bar with color coding.

**Step 4: Copy FinanceData**

Copy from `src/components/panel/FinanceData.tsx`. Tighten padding. Keep revenue donut (Recharts), per-pupil spending, poverty indicators.

**Step 5: Copy StaffingSalaries**

Copy from `src/components/panel/StaffingSalaries.tsx`. Tighten padding. Keep FTE breakdown, salary averages, compensation breakdown, salary distribution bar.

**Step 6: Commit**

```bash
git add src/components/map-v2/panels/district/DemographicsChart.tsx src/components/map-v2/panels/district/StudentPopulations.tsx src/components/map-v2/panels/district/AcademicMetrics.tsx src/components/map-v2/panels/district/FinanceData.tsx src/components/map-v2/panels/district/StaffingSalaries.tsx
git commit -m "feat(map-v2): port Data+Demographics components (charts, populations, finance, staffing)"
```

---

### Task 7: Wire Data + Demographics tab

**Files:**
- Create: `src/components/map-v2/panels/district/DataDemographicsTab.tsx`
- Modify: `src/components/map-v2/panels/district/DistrictDetailPanel.tsx` (replace placeholder)

**Step 1: Create DataDemographicsTab**

Model after `DataDemographicsTab` in `src/components/panel/tabs/DistrictTabContent.tsx` (lines 282-312):
- Props: `{ data: DistrictDetail }`
- Render: DemographicsChart, StudentPopulations, AcademicMetrics, FinanceData, StaffingSalaries
- Conditionally render each based on data availability

**Step 2: Wire into DistrictDetailPanel**

Replace placeholder for data tab with `<DataDemographicsTab data={data} />`.

**Step 3: Verify charts render**

Run dev server, click district, switch to Data + Demographics tab. Confirm donut charts, bars, and metrics display correctly in the floating panel width.

**Step 4: Commit**

```bash
git add src/components/map-v2/panels/district/DataDemographicsTab.tsx src/components/map-v2/panels/district/DistrictDetailPanel.tsx
git commit -m "feat(map-v2): wire Data+Demographics tab"
```

---

### Task 8: Port Contacts tab

**Files:**
- Create: `src/components/map-v2/panels/district/ContactsList.tsx`
- Create: `src/components/map-v2/panels/district/ContactsTab.tsx`
- Modify: `src/components/map-v2/panels/district/DistrictDetailPanel.tsx` (replace placeholder)

**Step 1: Copy ContactsList**

Copy from `src/components/panel/ContactsList.tsx`. Adaptations:
- Tighten padding
- Keep all CRUD: add, edit, delete, inline form
- Keep Clay lookup integration (`useTriggerClayLookup`)
- Keep persona/seniority dropdowns from `@/lib/contactTypes`

**Step 2: Create ContactsTab**

Model after `ContactsTab` in `src/components/panel/tabs/DistrictTabContent.tsx` (lines 315-329):
- Props: `{ leaid: string; contacts: Contact[] }`
- Render: `<ContactsList leaid={leaid} contacts={contacts} />`

**Step 3: Wire into DistrictDetailPanel**

Replace placeholder for contacts tab with `<ContactsTab leaid={selectedLeaid} contacts={data.contacts} />`.

**Step 4: Verify contacts render**

Run dev server, click district, switch to Contacts tab. Confirm contact list, add button, and Clay lookup work.

**Step 5: Commit**

```bash
git add src/components/map-v2/panels/district/ContactsList.tsx src/components/map-v2/panels/district/ContactsTab.tsx src/components/map-v2/panels/district/DistrictDetailPanel.tsx
git commit -m "feat(map-v2): port Contacts tab with CRUD and Clay integration"
```

---

### Task 9: Clean up old file and final verification

**Files:**
- Delete: `src/components/map-v2/panels/DistrictDetailPanel.tsx` (the old simplified version)

**Step 1: Delete the old DistrictDetailPanel**

The old file at `src/components/map-v2/panels/DistrictDetailPanel.tsx` is no longer imported anywhere (PanelContent.tsx now imports from `./panels/district/DistrictDetailPanel`). Delete it.

```bash
rm src/components/map-v2/panels/DistrictDetailPanel.tsx
```

**Step 2: Verify no broken imports**

```bash
npx tsc --noEmit 2>&1 | head -20
```

**Step 3: Full functional verification**

Test these flows in the browser:
1. Click a district on the map → tabbed panel appears with all 3 tabs
2. Search for a district → click result → same tabbed panel
3. Switch between all 3 tabs — info, data, contacts
4. Verify charts render (demographics donut, finance donut)
5. Verify collapsible sections expand/collapse
6. Test back button → returns to previous panel
7. Test "Add to Plan" button → triggers plan flow

**Step 4: Commit**

```bash
git rm src/components/map-v2/panels/DistrictDetailPanel.tsx
git add -A src/components/map-v2/panels/district/
git commit -m "feat(map-v2): complete district details tabbed view, remove old simplified panel"
```
