# Side Panel Improvements Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Improve side panel UX by moving territory owner to header, consolidating districts into the District tab, adding hover-to-highlight, and making plans work entirely in-panel.

**Architecture:** Modify existing tab content components to be context-aware. StateTabContent loses sub-tabs and gains territory owner in header. DistrictTabContent gains a "districts list" mode when state is selected but no district. PlansTabContent gains internal navigation between list and dashboard views.

**Tech Stack:** React 19, Next.js 16, TypeScript, Zustand (store), TanStack Query (data fetching)

---

## Task 1: Move Territory Owner to StateHeader

**Files:**
- Modify: `src/components/panel/state/StateHeader.tsx`
- Modify: `src/components/panel/state/StateNotesEditor.tsx`
- Modify: `src/components/panel/tabs/StateTabContent.tsx`

**Step 1: Update StateHeader to accept and display territory owner**

In `StateHeader.tsx`, the component already receives `state` which includes `territoryOwner`. Update the header layout to show the owner prominently below the abbreviation:

```tsx
// StateHeader.tsx - Replace lines 18-34 (the header section) with:
<div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
  {/* State name and code */}
  <div className="flex items-start justify-between mb-4">
    <div>
      <h2 className="text-xl font-bold text-[#403770]">{state.name}</h2>
      <div className="flex items-center gap-2 mt-0.5">
        <span className="text-sm text-gray-500">{state.code}</span>
        {state.territoryOwner && (
          <>
            <span className="text-gray-300">•</span>
            <span className="text-sm text-[#403770] font-medium">
              {state.territoryOwner}
            </span>
          </>
        )}
      </div>
    </div>
  </div>
  {/* ... rest of quick stats row stays the same */}
```

**Step 2: Remove territory owner from StateNotesEditor**

In `StateNotesEditor.tsx`, remove the territory owner section (lines 58-105). Keep only the notes section. Also update the interface:

```tsx
// StateNotesEditor.tsx - Update interface (remove territoryOwner):
interface StateNotesEditorProps {
  stateCode: string;
  notes: string | null;
}

// Remove all owner-related state and handlers:
// - isEditingOwner state
// - ownerValue state
// - handleSaveOwner callback
// - handleCancelOwner callback
// - The entire "Territory Owner" div (lines 60-105)
```

**Step 3: Update StateTabContent to not pass territoryOwner**

In `StateTabContent.tsx`, update the StateNotesEditor call:

```tsx
// StateTabContent.tsx line 102-106 - Remove territoryOwner prop:
<StateNotesEditor
  stateCode={data.code}
  notes={data.notes}
/>
```

**Step 4: Run dev server and verify**

```bash
npm run dev
```

Open browser, select a state, verify:
- Territory owner shows next to abbreviation in header
- Notes section still works without territory owner section

**Step 5: Commit**

```bash
git add src/components/panel/state/StateHeader.tsx src/components/panel/state/StateNotesEditor.tsx src/components/panel/tabs/StateTabContent.tsx
git commit -m "feat: Move territory owner to state header

- Display territory owner next to state abbreviation
- Remove territory owner editing from StateNotesEditor
- Keep notes editing in place"
```

---

## Task 2: Add Territory Owner Editing to Header

**Files:**
- Modify: `src/components/panel/state/StateHeader.tsx`

**Step 1: Add editing state and mutation to StateHeader**

```tsx
// StateHeader.tsx - Add imports and state at the top:
"use client";

import { useState, useCallback, useEffect } from "react";
import { StateDetail, useUpdateState } from "@/lib/api";

interface StateHeaderProps {
  state: StateDetail;
}

export default function StateHeader({ state }: StateHeaderProps) {
  const [isEditingOwner, setIsEditingOwner] = useState(false);
  const [ownerValue, setOwnerValue] = useState(state.territoryOwner || "");
  const updateState = useUpdateState();
  const { aggregates } = state;

  // Sync with props
  useEffect(() => {
    setOwnerValue(state.territoryOwner || "");
  }, [state.territoryOwner]);

  const handleSaveOwner = useCallback(() => {
    updateState.mutate(
      { stateCode: state.code, territoryOwner: ownerValue },
      { onSuccess: () => setIsEditingOwner(false) }
    );
  }, [updateState, state.code, ownerValue]);

  const handleCancelOwner = useCallback(() => {
    setOwnerValue(state.territoryOwner || "");
    setIsEditingOwner(false);
  }, [state.territoryOwner]);

  // ... rest of component
```

**Step 2: Add inline editing UI to the header**

Replace the territory owner display with editable version:

```tsx
// In the header JSX, replace the territory owner display:
<div className="flex items-center gap-2 mt-0.5">
  <span className="text-sm text-gray-500">{state.code}</span>
  <span className="text-gray-300">•</span>
  {isEditingOwner ? (
    <div className="flex items-center gap-2">
      <input
        type="text"
        value={ownerValue}
        onChange={(e) => setOwnerValue(e.target.value)}
        placeholder="Owner name"
        className="px-2 py-1 text-sm border border-gray-200 rounded focus:outline-none focus:ring-1 focus:ring-[#403770]"
        autoFocus
      />
      <button
        onClick={handleSaveOwner}
        disabled={updateState.isPending}
        className="px-2 py-1 text-xs font-medium text-white bg-[#403770] rounded hover:bg-[#403770]/90 disabled:opacity-50"
      >
        {updateState.isPending ? "..." : "Save"}
      </button>
      <button
        onClick={handleCancelOwner}
        className="px-2 py-1 text-xs font-medium text-gray-500 hover:text-gray-700"
      >
        Cancel
      </button>
    </div>
  ) : (
    <button
      onClick={() => setIsEditingOwner(true)}
      className="text-sm text-[#403770] font-medium hover:text-[#F37167] transition-colors"
    >
      {state.territoryOwner || (
        <span className="text-gray-400 italic">Set owner</span>
      )}
    </button>
  )}
</div>
```

**Step 3: Test editing**

Verify you can click the owner name, edit it, save, and cancel.

**Step 4: Commit**

```bash
git add src/components/panel/state/StateHeader.tsx
git commit -m "feat: Add inline territory owner editing to state header

- Click owner name to edit
- Save/cancel buttons for editing mode
- Uses existing useUpdateState mutation"
```

---

## Task 3: Remove Sub-tabs from StateTabContent

**Files:**
- Modify: `src/components/panel/tabs/StateTabContent.tsx`

**Step 1: Remove sub-tab state and UI**

```tsx
// StateTabContent.tsx - Remove these:
// - import { useState } from "react"
// - type SubTab = "overview" | "districts"
// - const [subTab, setSubTab] = useState<SubTab>("overview")
// - The entire sub-tabs div (lines 73-95)
// - The conditional rendering based on subTab (lines 98-111)
// - import StateDistrictsList (no longer used here)
```

**Step 2: Simplify the content to show only overview**

```tsx
"use client";

import { useStateDetail } from "@/lib/api";
import StateHeader from "../state/StateHeader";
import StateStats from "../state/StateStats";
import StateNotesEditor from "../state/StateNotesEditor";

interface StateTabContentProps {
  stateCode: string | null;
}

export default function StateTabContent({ stateCode }: StateTabContentProps) {
  const { data, isLoading, error } = useStateDetail(stateCode);

  if (!stateCode) {
    // ... keep existing empty state JSX
  }

  if (isLoading) {
    // ... keep existing loading JSX
  }

  if (error) {
    // ... keep existing error JSX
  }

  if (!data) {
    return null;
  }

  return (
    <div className="flex flex-col h-full">
      <StateHeader state={data} />
      <div className="flex-1 overflow-y-auto">
        <StateStats state={data} />
        <StateNotesEditor stateCode={data.code} notes={data.notes} />
      </div>
    </div>
  );
}
```

**Step 3: Verify in browser**

Select a state - should see header + stats + notes, no sub-tabs.

**Step 4: Commit**

```bash
git add src/components/panel/tabs/StateTabContent.tsx
git commit -m "refactor: Remove sub-tabs from StateTabContent

- Remove Overview/Districts sub-tabs
- Show only overview content (stats + notes)
- Districts will be shown in District tab instead"
```

---

## Task 4: Make DistrictTabContent State-Aware

**Files:**
- Modify: `src/components/panel/tabs/DistrictTabContent.tsx`
- Modify: `src/components/panel/PanelContainer.tsx`

**Step 1: Update DistrictTabContent to accept stateCode**

```tsx
// DistrictTabContent.tsx - Update interface:
interface DistrictTabContentProps {
  leaid: string | null;
  stateCode: string | null;
}

export default function DistrictTabContent({ leaid, stateCode }: DistrictTabContentProps) {
```

**Step 2: Pass stateCode from PanelContainer**

```tsx
// PanelContainer.tsx line 133 - Update to pass stateCode:
{activeTab === "district" && (
  <DistrictTabContent leaid={selectedLeaid} stateCode={effectiveStateCode} />
)}
```

**Step 3: Add StateDistrictsList import and conditional rendering**

```tsx
// DistrictTabContent.tsx - Add import:
import StateDistrictsList from "../state/StateDistrictsList";

// In the component, add logic for state-aware mode:
export default function DistrictTabContent({ leaid, stateCode }: DistrictTabContentProps) {
  const { data, isLoading, error } = useDistrictDetail(leaid);

  // If we have a leaid, show district detail (existing behavior)
  // If no leaid but have stateCode, show districts list
  // If neither, show empty state

  if (!leaid && !stateCode) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
        {/* Keep existing empty state SVG and text */}
      </div>
    );
  }

  // Show districts list when state selected but no district
  if (!leaid && stateCode) {
    return (
      <div className="flex flex-col h-full">
        <StateDistrictsList stateCode={stateCode} />
      </div>
    );
  }

  // Rest of existing district detail code...
  if (isLoading) { /* ... */ }
  if (error) { /* ... */ }
  if (!data) { return null; }

  return (
    <div className="h-full overflow-y-auto">
      {/* Existing district detail content */}
    </div>
  );
}
```

**Step 4: Test both modes**

- Select state, click District tab → should show districts list
- Click a district → should show district detail

**Step 5: Commit**

```bash
git add src/components/panel/tabs/DistrictTabContent.tsx src/components/panel/PanelContainer.tsx
git commit -m "feat: Make DistrictTabContent state-aware

- Show districts list when state selected but no district
- Show district detail when district selected
- Pass stateCode from PanelContainer"
```

---

## Task 5: Add Hover-to-Highlight for Districts List

**Files:**
- Modify: `src/components/panel/state/StateDistrictsList.tsx`

**Step 1: Import setHoveredLeaid from store**

```tsx
// StateDistrictsList.tsx - Update import:
import { useMapStore } from "@/lib/store";

// In the component, destructure setHoveredLeaid:
const { openDistrictPanel, setHoveredLeaid } = useMapStore();
```

**Step 2: Add mouse handlers to district rows**

```tsx
// StateDistrictsList.tsx - Update the button element (around line 135):
<button
  key={district.leaid}
  onClick={() => handleDistrictClick(district.leaid)}
  onMouseEnter={() => setHoveredLeaid(district.leaid)}
  onMouseLeave={() => setHoveredLeaid(null)}
  className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
>
```

**Step 3: Test hover interaction**

Hover over districts in the list, verify they highlight on the map.

**Step 4: Commit**

```bash
git add src/components/panel/state/StateDistrictsList.tsx
git commit -m "feat: Add hover-to-highlight for districts list

- Hovering a district row highlights it on the map
- Uses existing setHoveredLeaid from store"
```

---

## Task 6: Add Back Navigation to District Detail

**Files:**
- Modify: `src/components/panel/tabs/DistrictTabContent.tsx`

**Step 1: Import useStateDetail for state name**

```tsx
// DistrictTabContent.tsx - Add import:
import { useDistrictDetail, useStateDetail } from "@/lib/api";
```

**Step 2: Add back button when viewing district from a state context**

```tsx
// DistrictTabContent.tsx - Update the district detail section:

// Add state detail query for the back link name
const districtStateCode = data?.district.stateAbbrev || null;
const { data: stateData } = useStateDetail(districtStateCode);

// At the top of the district detail return, add back link:
return (
  <div className="h-full overflow-y-auto">
    {/* Back to state districts link */}
    {stateCode && (
      <button
        onClick={() => openDistrictPanel(null)} // This clears the selected district
        className="flex items-center gap-1 px-6 py-2 text-sm text-[#403770] hover:text-[#F37167] bg-gray-50 border-b border-gray-100 w-full"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to {stateData?.name || stateCode} districts
      </button>
    )}

    {/* Rest of existing district detail content */}
    <DistrictHeader ... />
```

Wait, `openDistrictPanel(null)` won't work correctly because it sets the panel type to null. We need a way to clear the district selection while keeping the state context.

**Step 2b: Add clearSelectedDistrict action to store**

Actually, let's use a simpler approach - we can just call `setSelectedLeaid(null)` which clears the district but the PanelContainer will still have the stateCode:

```tsx
// DistrictTabContent.tsx - Import from store:
import { useMapStore } from "@/lib/store";

// In component:
const { setSelectedLeaid } = useMapStore();

// Back button onClick:
onClick={() => setSelectedLeaid(null)}
```

Actually looking at the store, `setSelectedLeaid(null)` sets `activePanelType: null` which would close the panel. We need to modify this.

**Step 2c: Add store action for clearing district while keeping state**

```tsx
// store.ts - Add new action in the interface:
clearDistrictSelection: () => void;

// In the store implementation:
clearDistrictSelection: () =>
  set((s) => ({
    selectedLeaid: null,
    // Keep state panel type if we have a state selected
    activePanelType: s.selectedStateCode ? 'state' : null,
  })),
```

Wait, this is getting complex. Looking at the flow again:
- User selects state → `openStatePanel(stateCode)` → activePanelType='state', selectedStateCode=stateCode
- User clicks District tab → tab changes to 'district', but stateCode still set
- User clicks a district → `openDistrictPanel(leaid)` → activePanelType='district', selectedLeaid=leaid, selectedStateCode=null

The issue is `openDistrictPanel` clears `selectedStateCode`. Let me check PanelContainer...

Actually looking at PanelContainer line 39: `const effectiveStateCode = selectedStateCode || filters.stateAbbrev;`

So it falls back to the filter. And the District tab content receives `stateCode={effectiveStateCode}`.

Actually the simpler fix is to NOT clear selectedStateCode in openDistrictPanel when coming from a state context. But that requires knowing the context.

Let me use a simpler approach - just keep selectedStateCode when selecting a district within a state:

```tsx
// store.ts - Modify openDistrictPanel:
openDistrictPanel: (leaid) =>
  set((s) => ({
    activePanelType: 'district',
    selectedLeaid: leaid,
    sidePanelOpen: true,
    // Don't clear state selection - keep it for back navigation context
    // selectedStateCode: null, // REMOVE this line
  })),
```

Then for going back, we just need to clear the leaid:

```tsx
// Add new action to store:
clearDistrictSelection: () =>
  set({
    selectedLeaid: null,
    // Don't change activePanelType - let PanelContainer's useEffect handle it
  }),
```

Hmm, but the useEffect in PanelContainer switches tabs based on what's selected. If we clear leaid, it won't auto-switch to state tab.

Actually, looking more carefully: the user is ON the District tab viewing a district. They click back. We want to stay on the District tab but show the districts list. So we just clear selectedLeaid and the DistrictTabContent will show the list because stateCode is still set.

Let me add a simpler action:

**Revised Step 2: Simpler approach using existing store**

```tsx
// DistrictTabContent.tsx:
const setSelectedLeaid = useMapStore((s) => s.setSelectedLeaid);

// But setSelectedLeaid(null) sets activePanelType to null...
// Let's just directly modify the state:

// Actually, looking at line 152-159:
setSelectedLeaid: (leaid) =>
  set({
    selectedLeaid: leaid,
    sidePanelOpen: leaid !== null,
    activePanelType: leaid !== null ? 'district' : null,
    selectedStateCode: leaid !== null ? null : undefined,
  }),

// The issue is it sets activePanelType to null when leaid is null.
// We need a separate action for "go back to list"
```

Let me add a dedicated action:

```tsx
// store.ts - Add to interface (around line 93):
goBackToDistrictsList: () => void;

// Add implementation (around line 183):
goBackToDistrictsList: () =>
  set({
    selectedLeaid: null,
    // Keep activePanelType as 'district' - we're staying on district tab
    // Keep selectedStateCode - we need it for the list
  }),
```

**Step 3: Use the new action in DistrictTabContent**

```tsx
// DistrictTabContent.tsx:
const goBackToDistrictsList = useMapStore((s) => s.goBackToDistrictsList);

// Back button:
<button
  onClick={goBackToDistrictsList}
  className="..."
>
```

**Step 4: Test the back navigation**

- Select state → click District tab → click a district → click Back → should show districts list

**Step 5: Commit**

```bash
git add src/lib/store.ts src/components/panel/tabs/DistrictTabContent.tsx
git commit -m "feat: Add back navigation from district detail to districts list

- Add goBackToDistrictsList action to store
- Show back link at top of district detail when state context exists
- Clicking back returns to districts list for the state"
```

---

## Task 7: Plans Tab - Internal List/Dashboard Navigation

**Files:**
- Modify: `src/components/panel/tabs/PlansTabContent.tsx`

**Step 1: Add internal navigation state**

```tsx
// PlansTabContent.tsx - Add state for current view:
import { useState } from "react";

type PlanView = { type: "list" } | { type: "dashboard"; planId: string };

export default function PlansTabContent({ stateCode }: PlansTabContentProps) {
  const [view, setView] = useState<PlanView>({ type: "list" });
  const { data: plans, isLoading, error } = useTerritoryPlans();

  // ... existing code
```

**Step 2: Convert Links to onClick handlers**

Replace `<Link href={`/plans/${plan.id}`}>` with:

```tsx
<button
  key={plan.id}
  onClick={() => setView({ type: "dashboard", planId: plan.id })}
  className="block w-full px-4 py-3 hover:bg-gray-50 transition-colors text-left"
>
```

**Step 3: Remove Link imports and convert all navigation**

Also update the "Manage Plans" link and "Create New Plan" button.

**Step 4: Add dashboard view rendering**

```tsx
// After the list view, add dashboard view:
if (view.type === "dashboard") {
  return <PlanDashboard planId={view.planId} onBack={() => setView({ type: "list" })} />;
}

// List view is the existing return...
```

**Step 5: Commit partial progress**

```bash
git add src/components/panel/tabs/PlansTabContent.tsx
git commit -m "feat: Add internal navigation state to PlansTabContent

- Track list vs dashboard view internally
- Convert Link navigation to onClick state changes
- Prepare for dashboard view component"
```

---

## Task 8: Create PlanDashboard Component

**Files:**
- Create: `src/components/panel/plans/PlanDashboard.tsx`
- Modify: `src/components/panel/tabs/PlansTabContent.tsx`

**Step 1: Create PlanDashboard component**

```tsx
// src/components/panel/plans/PlanDashboard.tsx
"use client";

import { useState } from "react";
import { useTerritoryPlan, useUpdateTerritoryPlan } from "@/lib/api";
import PlanFormModal, { type PlanFormData } from "@/components/plans/PlanFormModal";

interface PlanDashboardProps {
  planId: string;
  onBack: () => void;
}

export default function PlanDashboard({ planId, onBack }: PlanDashboardProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const { data: plan, isLoading, error } = useTerritoryPlan(planId);
  const updatePlan = useUpdateTerritoryPlan();

  // Status badge colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: "bg-green-100", text: "text-green-700" },
    draft: { bg: "bg-yellow-100", text: "text-yellow-700" },
    archived: { bg: "bg-gray-100", text: "text-gray-500" },
  };

  const handleEditPlan = async (data: PlanFormData) => {
    await updatePlan.mutateAsync({
      id: planId,
      name: data.name,
      description: data.description || undefined,
      owner: data.owner || undefined,
      color: data.color,
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });
  };

  if (isLoading) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
      </div>
    );
  }

  if (error || !plan) {
    return (
      <div className="flex-1 flex items-center justify-center p-4">
        <div className="text-center text-red-500">
          <p className="font-medium">Error loading plan</p>
          <p className="text-sm mt-1">{error?.message || "Plan not found"}</p>
          <button onClick={onBack} className="mt-4 text-[#403770] hover:text-[#F37167]">
            ← Back to plans
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <button
        onClick={onBack}
        className="flex items-center gap-1 px-4 py-2 text-sm text-[#403770] hover:text-[#F37167] bg-gray-50 border-b border-gray-100"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
        </svg>
        Back to Plans
      </button>

      {/* Plan header */}
      <div className="px-4 py-4 border-b border-gray-100">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-4 h-4 rounded-full flex-shrink-0"
              style={{ backgroundColor: plan.color }}
            />
            <div>
              <h2 className="font-semibold text-lg text-[#403770]">{plan.name}</h2>
              <div className="flex items-center gap-2 mt-1">
                <span
                  className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-medium ${
                    statusColors[plan.status]?.bg || "bg-gray-100"
                  } ${statusColors[plan.status]?.text || "text-gray-500"}`}
                >
                  {plan.status}
                </span>
              </div>
            </div>
          </div>
          <button
            onClick={() => setShowEditModal(true)}
            className="px-3 py-1.5 text-sm font-medium text-[#403770] border border-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors"
          >
            Edit
          </button>
        </div>

        {plan.description && (
          <p className="text-sm text-gray-600 mt-3">{plan.description}</p>
        )}
      </div>

      {/* Plan details */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-4 border-b border-gray-100">
          <h3 className="text-sm font-medium text-gray-700 mb-3">Details</h3>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <span className="text-gray-500">Owner</span>
              <p className="font-medium text-gray-900">{plan.owner || "—"}</p>
            </div>
            <div>
              <span className="text-gray-500">Districts</span>
              <p className="font-medium text-gray-900">{plan.districts.length}</p>
            </div>
            {plan.startDate && (
              <div>
                <span className="text-gray-500">Start Date</span>
                <p className="font-medium text-gray-900">
                  {new Date(plan.startDate).toLocaleDateString()}
                </p>
              </div>
            )}
            {plan.endDate && (
              <div>
                <span className="text-gray-500">End Date</span>
                <p className="font-medium text-gray-900">
                  {new Date(plan.endDate).toLocaleDateString()}
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Districts list */}
        <div className="px-4 py-4">
          <h3 className="text-sm font-medium text-gray-700 mb-3">
            Districts ({plan.districts.length})
          </h3>
          {plan.districts.length === 0 ? (
            <p className="text-sm text-gray-400 italic">No districts in this plan</p>
          ) : (
            <div className="space-y-2">
              {plan.districts.map((district) => (
                <div
                  key={district.leaid}
                  className="flex items-center justify-between py-2 border-b border-gray-50 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900">{district.name}</p>
                    <p className="text-xs text-gray-500">
                      {district.stateAbbrev}
                      {district.enrollment && ` • ${district.enrollment.toLocaleString()} students`}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Edit modal */}
      <PlanFormModal
        isOpen={showEditModal}
        onClose={() => setShowEditModal(false)}
        onSubmit={handleEditPlan}
        initialData={plan}
        title="Edit Plan"
      />
    </div>
  );
}
```

**Step 2: Create plans directory and add export**

```bash
mkdir -p src/components/panel/plans
```

**Step 3: Import and use in PlansTabContent**

```tsx
// PlansTabContent.tsx - Add import:
import PlanDashboard from "../plans/PlanDashboard";

// In render, before list view:
if (view.type === "dashboard") {
  return <PlanDashboard planId={view.planId} onBack={() => setView({ type: "list" })} />;
}
```

**Step 4: Test dashboard view**

Click a plan → should see dashboard with details and edit button.

**Step 5: Commit**

```bash
git add src/components/panel/plans/PlanDashboard.tsx src/components/panel/tabs/PlansTabContent.tsx
git commit -m "feat: Add PlanDashboard component for in-panel plan viewing

- Show plan details, status, owner, dates
- Display districts list in plan
- Edit button opens PlanFormModal
- Back button returns to plans list"
```

---

## Task 9: Add Create Plan Modal to Plans Tab

**Files:**
- Modify: `src/components/panel/tabs/PlansTabContent.tsx`

**Step 1: Add create plan state and modal**

```tsx
// PlansTabContent.tsx - Add state and imports:
import { useState } from "react";
import { useTerritoryPlans, useCreateTerritoryPlan } from "@/lib/api";
import PlanFormModal, { type PlanFormData } from "@/components/plans/PlanFormModal";
import PlanDashboard from "../plans/PlanDashboard";

export default function PlansTabContent({ stateCode }: PlansTabContentProps) {
  const [view, setView] = useState<PlanView>({ type: "list" });
  const [showCreateModal, setShowCreateModal] = useState(false);
  const { data: plans, isLoading, error } = useTerritoryPlans();
  const createPlan = useCreateTerritoryPlan();

  const handleCreatePlan = async (data: PlanFormData) => {
    await createPlan.mutateAsync({
      name: data.name,
      description: data.description || undefined,
      owner: data.owner || undefined,
      color: data.color,
      status: data.status,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
    });
    // Return to list after creating (plan is already there from mutation)
  };
```

**Step 2: Update the Create button**

Replace the Link-based Create New Plan button:

```tsx
// In the empty state:
<button
  onClick={() => setShowCreateModal(true)}
  className="inline-flex items-center gap-2 px-4 py-2 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#403770]/90 transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
  Create Plan
</button>

// In the footer:
<button
  onClick={() => setShowCreateModal(true)}
  className="flex items-center justify-center gap-2 w-full px-4 py-2 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#403770]/90 transition-colors"
>
  <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
  </svg>
  Create New Plan
</button>
```

**Step 3: Add modal at end of component**

```tsx
// At end of list view return, before closing div:
<PlanFormModal
  isOpen={showCreateModal}
  onClose={() => setShowCreateModal(false)}
  onSubmit={handleCreatePlan}
  title="Create Territory Plan"
/>
```

**Step 4: Remove "Manage Plans" link (no longer needed)**

Remove the Link to /plans since everything is in-panel now.

**Step 5: Test create flow**

Click Create New Plan → fill form → submit → should see new plan in list.

**Step 6: Commit**

```bash
git add src/components/panel/tabs/PlansTabContent.tsx
git commit -m "feat: Add in-panel plan creation

- Create button opens PlanFormModal
- After creating, returns to plans list
- Remove external links to /plans page"
```

---

## Task 10: Final Testing and Cleanup

**Step 1: Full flow testing**

Test each user flow:
1. Select state → verify header shows territory owner
2. Edit territory owner → verify save/cancel work
3. State tab → verify no sub-tabs, shows stats + notes
4. Click District tab → verify districts list appears
5. Hover districts → verify map highlights
6. Click district → verify detail shows with back link
7. Click back → verify returns to districts list
8. Click Plans tab → verify plans list
9. Click plan → verify dashboard
10. Edit plan → verify modal and save
11. Back to list → verify navigation
12. Create plan → verify modal and new plan appears

**Step 2: Fix any TypeScript errors**

```bash
npm run build
```

Fix any type errors that appear.

**Step 3: Run linting**

```bash
npm run lint
```

Fix any linting issues.

**Step 4: Final commit**

```bash
git add -A
git commit -m "chore: Fix any remaining TypeScript and lint errors"
```

**Step 5: Merge to main (optional - depends on workflow)**

```bash
git checkout main
git merge feature/side-panel-improvements
git push origin main
```

---

## Summary

| Task | Description | Files |
|------|-------------|-------|
| 1 | Move territory owner to header | StateHeader, StateNotesEditor, StateTabContent |
| 2 | Add territory owner editing to header | StateHeader |
| 3 | Remove sub-tabs from StateTabContent | StateTabContent |
| 4 | Make DistrictTabContent state-aware | DistrictTabContent, PanelContainer |
| 5 | Add hover-to-highlight | StateDistrictsList |
| 6 | Add back navigation to district detail | store.ts, DistrictTabContent |
| 7 | Plans tab internal navigation | PlansTabContent |
| 8 | Create PlanDashboard component | PlanDashboard.tsx, PlansTabContent |
| 9 | Add create plan modal | PlansTabContent |
| 10 | Final testing and cleanup | All files |
