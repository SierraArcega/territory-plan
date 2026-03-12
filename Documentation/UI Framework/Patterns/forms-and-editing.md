# Forms & Editing

Forms open in two contexts: **RightPanel** (editing within the plan workspace, 280px) or **main PanelContent** (creating new entities like plans/accounts, full-width). This doc covers shared patterns across both; see `Components/forms.md` for canonical input styling and token-based target values.

---

## Decision Tree: Which Form Pattern?

```
1. Creating a new plan?
   -> PlanFormPanel in main PanelContent (full-width panel form)

2. Editing plan metadata?
   -> PlanEditForm in RightPanel (280px secondary panel)

3. Creating/editing a task or activity?
   -> TaskForm / ActivityForm in RightPanel (280px)

4. Creating a new account from the map?
   -> AccountForm in main PanelContent (replaces panel content)
```

> `contact_form` exists as a `RightPanelContent` type but has no standalone panel component yet -- contacts are created inline via `ContactsList.tsx`. Follow the TaskForm pattern if building one.

---

## Form Field Conventions

Standard field pattern used across all RightPanel forms (TaskForm, ActivityForm, PlanEditForm):

```tsx
{/* Text input */}
<div>
  <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
    Field Label
  </label>
  <input
    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200
      focus:border-gray-400 focus:outline-none focus:ring-0
      transition-colors placeholder:text-gray-300"
  />
</div>

{/* Textarea -- identical styling + resize-none */}
<div>
  <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
    Description
  </label>
  <textarea
    rows={2}
    className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200
      focus:border-gray-400 focus:outline-none focus:ring-0
      transition-colors placeholder:text-gray-300 resize-none"
  />
</div>

{/* Select -- same base, add text-gray-700 */}
<select
  className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200
    focus:border-gray-400 focus:outline-none focus:ring-0
    transition-colors text-gray-700"
/>
```

**Migration note:** These RightPanel forms diverge from `Components/forms.md` canonical styling:

| Current (RightPanel) | Target (tokens) | Token name |
|----------------------|-----------------|------------|
| `text-gray-400` label | `text-[#8A80A8]` | Secondary |
| `text-[10px]` label | `text-xs` (12px) | Caption tier |
| `border-gray-200` | `border-[#C2BBD4]` | Border Strong |
| `focus:border-gray-400` | `focus:ring-2 focus:ring-[#F37167] focus:border-transparent` | Coral ring |
| `focus:ring-0` | `focus:ring-2 focus:ring-[#F37167]` | Coral ring |
| `placeholder:text-gray-300` | `placeholder:text-[#A69DC0]` | Muted |

PanelContent forms (PlanFormPanel, AccountForm) already use closer-to-token values: `bg-gray-50`, `border-gray-200/60`, `rounded-xl`, `focus:ring-plum/20`.

---

## Form State Management

All forms use the same state pattern -- no form libraries (no react-hook-form, no formik).

| Concern | Pattern |
|---------|---------|
| Field state | One `useState` per field |
| Create vs. edit mode | `isEditing = !!entityId` derived from presence of ID prop |
| Pre-fill (edit mode) | `useEffect` watching `existingEntity` from query |
| API calls | React Query mutations (`useCreateX`, `useUpdateX`, `useDeleteX`) |
| Pending state | `mutation.isPending` for button disabled |
| Dismiss | `closeRightPanel()` from Zustand store after success |

```tsx
// Canonical create/edit dual-mode pattern (condensed from TaskForm)
interface EntityFormProps {
  entityId?: string;        // present = edit mode
  preLinkedLeaid?: string;  // optional pre-selection for create mode
}

export default function EntityForm({ entityId, preLinkedLeaid }: EntityFormProps) {
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);

  // Queries
  const { data: existing, isLoading } = useEntity(entityId ?? null);
  const createMutation = useCreateEntity();
  const updateMutation = useUpdateEntity();

  const isEditing = !!entityId;

  // Field state
  const [title, setTitle] = useState("");

  // Pre-fill from existing data
  useEffect(() => {
    if (isEditing && existing) {
      setTitle(existing.title);
    }
  }, [isEditing, existing]);

  const handleSave = async () => {
    if (!title.trim()) return;
    if (isEditing && entityId) {
      await updateMutation.mutateAsync({ entityId, title: title.trim() });
    } else {
      await createMutation.mutateAsync({ title: title.trim() });
    }
    closeRightPanel(); // dismiss on success
  };

  const isSaving = createMutation.isPending || updateMutation.isPending;

  if (isEditing && isLoading) return <LoadingSkeleton />;

  return (
    <div className="space-y-4">
      {/* ... fields ... */}
      <button
        onClick={handleSave}
        disabled={!title.trim() || isSaving}
        className="w-full py-2 bg-gray-800 text-white text-xs font-medium rounded-lg
          hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
      >
        {isSaving ? "Saving..." : isEditing ? "Update" : "Create"}
      </button>
    </div>
  );
}
```

---

## Save / Cancel / Delete Flow

| Action | Pattern | Styling |
|--------|---------|---------|
| Save | Full-width primary button | `w-full py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 disabled:opacity-40 disabled:cursor-not-allowed` |
| Cancel | No explicit cancel button | Dismiss via close button in RightPanel header (`closeRightPanel()`) |
| Delete | Two-phase confirmation | Step 1: text button. Step 2: inline confirmation card |

### Delete Confirmation Pattern

```tsx
const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
const deleteEntity = useDeleteEntity();
const isDeleting = deleteEntity.isPending;

{/* Step 1: trigger button (edit mode only) */}
{isEditing && !showDeleteConfirm && (
  <button
    onClick={() => setShowDeleteConfirm(true)}
    className="w-full py-2 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
  >
    Delete Task
  </button>
)}

{/* Step 2: inline confirmation card */}
{isEditing && showDeleteConfirm && (
  <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
    <p className="text-xs text-red-600 font-medium">
      Delete this task permanently?
    </p>
    <div className="flex gap-2">
      <button
        onClick={handleDelete}
        disabled={isDeleting}
        className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg
          hover:bg-red-600 transition-colors disabled:opacity-50"
      >
        {isDeleting ? "Deleting..." : "Delete"}
      </button>
      <button
        onClick={() => setShowDeleteConfirm(false)}
        className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg
          border border-gray-200 hover:bg-gray-50 transition-colors"
      >
        Cancel
      </button>
    </div>
  </div>
)}
```

**Migration note:** Save button uses `bg-gray-800` (should be `bg-[#403770]` Plum). PanelContent forms (PlanFormPanel, AccountForm) already use `bg-plum`.

---

## Priority Selector Pattern

Button-group selector reusable for any enum field (priority, status, activity type). Each option highlights with its config color when selected.

```tsx
// From TaskForm -- priority selector
<div className="flex gap-1">
  {TASK_PRIORITIES.map((p) => {
    const config = TASK_PRIORITY_CONFIG[p]; // { label, color, icon }
    const isSelected = priority === p;
    return (
      <button
        key={p}
        onClick={() => setPriority(p)}
        className={`flex-1 flex items-center justify-center gap-0.5 px-2 py-1.5 rounded-lg text-[10px] font-medium transition-all
          ${isSelected
            ? "ring-1 ring-offset-1"
            : "bg-gray-50 text-gray-400 hover:bg-gray-100"
          }`}
        style={
          isSelected
            ? {
                backgroundColor: `${config.color}18`, // color at ~10% opacity
                color: config.color,
                "--tw-ring-color": config.color,       // dynamic ring color
              }
            : undefined
        }
      >
        <span className="text-[9px]">{config.icon}</span>
        {config.label}
      </button>
    );
  })}
</div>
```

Priority config values (`src/features/tasks/types.ts`):

| Priority | Color | Icon |
|----------|-------|------|
| Low | `#6EA3BE` | `\u2193` |
| Medium | `#F59E0B` | `\u2192` |
| High | `#F37167` | `\u2191` |
| Urgent | `#DC2626` | `\u26A1` |

ActivityForm uses the same pattern for status selectors with `ACTIVITY_STATUS_CONFIG`.

---

## Linked Entity Checkboxes

Scrollable checkbox list for linking districts (or plans) to tasks/activities.

| Element | Classes |
|---------|---------|
| Container | `max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-100 p-1.5` |
| Row | `flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors` |
| Checkbox | `w-3.5 h-3.5 rounded border-gray-300 text-gray-700 focus:ring-0 focus:ring-offset-0` |
| Label text | `text-xs text-gray-600 truncate` |
| State badge | `text-[9px] text-gray-400 shrink-0` |

```tsx
<div className="max-h-32 overflow-y-auto space-y-0.5 rounded-lg border border-gray-100 p-1.5">
  {planDistricts.map((d) => (
    <label
      key={d.leaid}
      className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-gray-50 cursor-pointer transition-colors"
    >
      <input
        type="checkbox"
        checked={linkedLeaids.has(d.leaid)}
        onChange={() => toggleDistrict(d.leaid)}
        className="w-3.5 h-3.5 rounded border-gray-300 text-gray-700 focus:ring-0 focus:ring-offset-0"
      />
      <span className="text-xs text-gray-600 truncate">{d.name}</span>
      {d.stateAbbrev && (
        <span className="text-[9px] text-gray-400 shrink-0">{d.stateAbbrev}</span>
      )}
    </label>
  ))}
</div>
```

State is managed as `Set<string>` with a toggle helper:

```tsx
const [linkedLeaids, setLinkedLeaids] = useState<Set<string>>(new Set());

const toggleDistrict = (leaid: string) => {
  setLinkedLeaids((prev) => {
    const next = new Set(prev);
    next.has(leaid) ? next.delete(leaid) : next.add(leaid);
    return next;
  });
};
```

---

## Loading Skeleton for Forms

Shown when editing an existing entity and the query is loading. All elements use `animate-pulse`.

| Element | Classes |
|---------|---------|
| Label placeholder | `h-2 bg-gray-200 rounded w-12 mb-1.5 animate-pulse` (width varies: `w-10`-`w-20`) |
| Input placeholder | `h-9 bg-gray-100 rounded-lg animate-pulse` |
| Textarea placeholder | `h-16 bg-gray-100 rounded-lg animate-pulse` |
| Priority/status row | `flex gap-1` with N equal `flex-1 h-8 bg-gray-100 rounded-lg animate-pulse` blocks |
| Button placeholder | `h-9 bg-gray-200 rounded-lg animate-pulse` |

```tsx
function LoadingSkeleton() {
  return (
    <div className="space-y-4">
      {/* Title skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-12 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Description skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-20 mb-1.5 animate-pulse" />
        <div className="h-16 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Priority selector skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-14 mb-1.5 animate-pulse" />
        <div className="flex gap-1">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="flex-1 h-8 bg-gray-100 rounded-lg animate-pulse" />
          ))}
        </div>
      </div>
      {/* Due date skeleton */}
      <div>
        <div className="h-2 bg-gray-200 rounded w-16 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      {/* Button skeleton */}
      <div className="h-9 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}
```

---

## Codebase Reference

| Component | File |
|-----------|------|
| Task form (create/edit) | `src/features/map/components/right-panels/TaskForm.tsx` |
| Activity form | `src/features/map/components/right-panels/ActivityForm.tsx` |
| Plan edit form | `src/features/map/components/right-panels/PlanEditForm.tsx` |
| Plan creation form | `src/features/map/components/panels/PlanFormPanel.tsx` |
| Account form | `src/features/map/components/panels/AccountForm.tsx` |
| Right panel host | `src/features/map/components/RightPanel.tsx` |
| Task priority config | `src/features/tasks/types.ts` |
| Canonical input styling | `Documentation/UI Framework/Components/forms.md` |
| Container foundations | `Documentation/UI Framework/Components/Containers/_foundations.md` |
