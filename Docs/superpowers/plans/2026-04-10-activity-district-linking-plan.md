# Activity-District Linking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a top-level district search-and-select field to the activity modal so users can link any activity type to one or more districts.

**Architecture:** Reuse the existing `DistrictSearchInput` component and `ActivityDistrict` junction table. The change is purely frontend — move district selection from the road-trip-specific section to a universal field below Contacts. Simplify the `districtStops` state to `selectedDistricts` (no visit dates/notes). Remove the now-empty `RoadTripFields` component.

**Tech Stack:** React 19, TypeScript, TanStack Query, Next.js App Router, Prisma

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `src/features/activities/components/ActivityFormModal.tsx` | Modify | Add Districts field, rename state, simplify mutation payloads |
| `src/features/activities/components/event-fields/EventTypeFields.tsx` | Modify | Remove `districtStops` props, remove road_trip case |
| `src/features/activities/components/event-fields/RoadTripFields.tsx` | Delete | No longer needed — districts are top-level |

---

### Task 1: Add the Districts search + chips UI to ActivityFormModal

**Files:**
- Modify: `src/features/activities/components/ActivityFormModal.tsx`

- [ ] **Step 1: Rename state from `districtStops` to `selectedDistricts` and simplify type**

In `ActivityFormModal.tsx`, find the state declaration at line 86:

```tsx
const [districtStops, setDistrictStops] = useState<
  { leaid: string; name: string; stateAbbrev: string | null; visitDate: string; notes: string }[]
>([]);
```

Replace with:

```tsx
const [selectedDistricts, setSelectedDistricts] = useState<
  { leaid: string; name: string; stateAbbrev: string | null }[]
>([]);
```

- [ ] **Step 2: Update resetForm to use new state name**

In `resetForm()` (line 142), change:

```tsx
setDistrictStops([]);
```

to:

```tsx
setSelectedDistricts([]);
```

- [ ] **Step 3: Update edit-mode population**

In the edit-mode `useEffect` (lines 181-189), change:

```tsx
setDistrictStops(
  editActivity.districts?.map((d) => ({
    leaid: d.leaid,
    name: d.name || d.leaid,
    stateAbbrev: d.stateAbbrev || null,
    visitDate: d.visitDate ? d.visitDate.split("T")[0] : "",
    notes: d.notes || "",
  })) || []
);
```

to:

```tsx
setSelectedDistricts(
  editActivity.districts?.map((d) => ({
    leaid: d.leaid,
    name: d.name || d.leaid,
    stateAbbrev: d.stateAbbrev || null,
  })) || []
);
```

- [ ] **Step 4: Update the update-activity mutation payload**

In `handleSubmit`, the edit-mode path (line 288), change:

```tsx
districts: districtStops.map((s, index) => ({
  leaid: s.leaid,
  visitDate: s.visitDate || null,
  position: index,
  notes: s.notes || null,
})),
```

to:

```tsx
districts: selectedDistricts.map((d, index) => ({
  leaid: d.leaid,
  position: index,
})),
```

- [ ] **Step 5: Update the create-activity mutation payload**

In `handleSubmit`, the create path (lines 316-330), change the `districts` block:

```tsx
districts: (() => {
  // Merge district stops with auto-linked districts from contacts
  const stopLeaids = new Set(districtStops.map((s) => s.leaid));
  const contactDistricts = selectedContacts
    .filter((c) => !stopLeaids.has(c.leaid))
    .map((c, i) => ({ leaid: c.leaid, position: districtStops.length + i }));
  const stops = districtStops.map((s, i) => ({
    leaid: s.leaid,
    visitDate: s.visitDate || undefined,
    position: i,
    notes: s.notes || undefined,
  }));
  const all = [...stops, ...contactDistricts];
  return all.length > 0 ? all : undefined;
})(),
```

to:

```tsx
districts: (() => {
  const explicitLeaids = new Set(selectedDistricts.map((d) => d.leaid));
  const contactDistricts = selectedContacts
    .filter((c) => !explicitLeaids.has(c.leaid))
    .map((c, i) => ({ leaid: c.leaid, position: selectedDistricts.length + i }));
  const explicit = selectedDistricts.map((d, i) => ({
    leaid: d.leaid,
    position: i,
  }));
  const all = [...explicit, ...contactDistricts];
  return all.length > 0 ? all : undefined;
})(),
```

- [ ] **Step 6: Add the Districts field UI below Contacts**

Add a new import at the top of `ActivityFormModal.tsx`:

```tsx
import DistrictSearchInput from "./event-fields/DistrictSearchInput";
```

Then, after the Contacts auto-linked chips block (after line 644, the closing `</div>` for the Contacts section), add the Districts field:

```tsx
{/* Districts */}
<div>
  <label className="block text-xs font-medium text-[#8A80A8] mb-1">Districts</label>
  {selectedDistricts.length > 0 && (
    <div className="flex flex-wrap gap-1.5 mb-2">
      {selectedDistricts.map((d) => (
        <span
          key={d.leaid}
          className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#EFEDF5] text-[#544A78] rounded-md text-[11px]"
        >
          <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
          </svg>
          {d.name}
          {d.stateAbbrev && <span className="text-[#8A80A8]">· {d.stateAbbrev}</span>}
          <button
            type="button"
            onClick={() => setSelectedDistricts((prev) => prev.filter((x) => x.leaid !== d.leaid))}
            className="ml-0.5 text-[#A69DC0] hover:text-[#F37167] transition-colors"
          >
            ×
          </button>
        </span>
      ))}
    </div>
  )}
  <DistrictSearchInput
    excludeLeaids={selectedDistricts.map((d) => d.leaid)}
    onSelect={(d) => setSelectedDistricts((prev) => [...prev, { leaid: d.leaid, name: d.name, stateAbbrev: d.stateAbbrev }])}
  />
</div>
```

- [ ] **Step 7: Update auto-linked district chips to exclude explicitly selected districts**

In the auto-linked chips block (around line 596-644), update the `stopLeaids` reference. Change:

```tsx
const stopLeaids = new Set(districtStops.map((s) => s.leaid));
```

to:

```tsx
const stopLeaids = new Set(selectedDistricts.map((d) => d.leaid));
```

- [ ] **Step 8: Verify the app compiles**

Run: `npx next build --no-lint 2>&1 | tail -20`

This will fail because `EventTypeFields` still expects `districtStops` props. That's expected — we fix it in Task 2.

---

### Task 2: Remove district props from EventTypeFields and delete RoadTripFields

**Files:**
- Modify: `src/features/activities/components/event-fields/EventTypeFields.tsx`
- Modify: `src/features/activities/components/ActivityFormModal.tsx` (remove props passed to EventTypeFields)
- Delete: `src/features/activities/components/event-fields/RoadTripFields.tsx`

- [ ] **Step 1: Remove districtStops props from EventTypeFields**

In `EventTypeFields.tsx`, remove the `DistrictStop` interface (lines 22-28):

```tsx
interface DistrictStop {
  leaid: string;
  name: string;
  stateAbbrev: string | null;
  visitDate: string;
  notes: string;
}
```

Update the props interface (lines 30-36) from:

```tsx
interface EventTypeFieldsProps {
  type: ActivityType;
  metadata: Record<string, unknown>;
  onMetadataChange: (metadata: Record<string, unknown>) => void;
  districtStops: DistrictStop[];
  onDistrictStopsChange: (stops: DistrictStop[]) => void;
}
```

to:

```tsx
interface EventTypeFieldsProps {
  type: ActivityType;
  metadata: Record<string, unknown>;
  onMetadataChange: (metadata: Record<string, unknown>) => void;
}
```

Update the function signature (lines 38-44) from:

```tsx
export default function EventTypeFields({
  type,
  metadata,
  onMetadataChange,
  districtStops,
  onDistrictStopsChange,
}: EventTypeFieldsProps) {
```

to:

```tsx
export default function EventTypeFields({
  type,
  metadata,
  onMetadataChange,
}: EventTypeFieldsProps) {
```

- [ ] **Step 2: Remove the road_trip case and RoadTripFields import**

In `EventTypeFields.tsx`, remove the import:

```tsx
import RoadTripFields from "./RoadTripFields";
```

Remove the `road_trip` case (lines 54-60):

```tsx
case "road_trip":
  return (
    <RoadTripFields
      districtStops={districtStops}
      onDistrictStopsChange={onDistrictStopsChange}
    />
  );
```

Replace with:

```tsx
case "road_trip":
  return null;
```

- [ ] **Step 3: Update ActivityFormModal to stop passing district props to EventTypeFields**

In `ActivityFormModal.tsx`, find the `EventTypeFields` usage (lines 662-668):

```tsx
<EventTypeFields
  type={type}
  metadata={metadata}
  onMetadataChange={setMetadata}
  districtStops={districtStops}
  onDistrictStopsChange={setDistrictStops}
/>
```

Replace with:

```tsx
<EventTypeFields
  type={type}
  metadata={metadata}
  onMetadataChange={setMetadata}
/>
```

- [ ] **Step 4: Delete RoadTripFields.tsx**

Run: `rm src/features/activities/components/event-fields/RoadTripFields.tsx`

- [ ] **Step 5: Verify the build compiles**

Run: `npx next build --no-lint 2>&1 | tail -20`

Expected: Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add src/features/activities/components/ActivityFormModal.tsx \
       src/features/activities/components/event-fields/EventTypeFields.tsx
git rm src/features/activities/components/event-fields/RoadTripFields.tsx
git commit -m "feat(activities): add top-level district search field, remove road trip stops UI"
```

---

### Task 3: Smoke test and verify end-to-end

- [ ] **Step 1: Run the full test suite to check for regressions**

Run: `npx vitest run 2>&1 | tail -30`

Expected: All tests pass (no existing tests reference RoadTripFields or districtStops directly).

- [ ] **Step 2: Run the build**

Run: `npm run build 2>&1 | tail -20`

Expected: Build succeeds with no type errors.

- [ ] **Step 3: Check for any remaining references to RoadTripFields or districtStops**

Run: `grep -rn "RoadTripFields\|districtStops" src/ --include="*.tsx" --include="*.ts"`

Expected: No matches (all references have been updated).

- [ ] **Step 4: Commit if any fixes were needed**

If Step 3 found lingering references, fix them and commit:

```bash
git add -A
git commit -m "fix(activities): clean up remaining districtStops references"
```
