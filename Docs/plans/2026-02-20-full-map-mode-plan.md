# Full Map Mode Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Allow the user to fully hide the floating left panel for an immersive, full-screen map with only the LayerBubble visible.

**Architecture:** Replace the `panelCollapsed: boolean` store field with a 3-state `panelMode: "full" | "collapsed" | "hidden"` enum. The FloatingPanel hides entirely in "hidden" mode, showing a small restore button top-left. A chevron in the IconBar progressively steps through modes: full → collapsed → hidden.

**Tech Stack:** Zustand store, Tailwind CSS transitions, React

---

### Task 1: Update Zustand Store — Replace panelCollapsed with panelMode

**Files:**
- Modify: `src/lib/map-v2-store.ts`

**Step 1: Add PanelMode type and replace state field**

In the state interface (~line 131), replace:
```ts
// Responsive
panelCollapsed: boolean;
```
with:
```ts
// Panel visibility
panelMode: "full" | "collapsed" | "hidden";
```

**Step 2: Replace action signatures**

In the actions section (~lines 241-242), replace:
```ts
setPanelCollapsed: (collapsed: boolean) => void;
togglePanel: () => void;
```
with:
```ts
setPanelMode: (mode: "full" | "collapsed" | "hidden") => void;
collapsePanel: () => void; // full→collapsed→hidden
```

**Step 3: Replace initial state**

At ~line 342, replace:
```ts
panelCollapsed: false,
```
with:
```ts
panelMode: "full",
```

**Step 4: Replace action implementations**

At ~lines 610-611, replace:
```ts
setPanelCollapsed: (collapsed) => set({ panelCollapsed: collapsed }),
togglePanel: () => set((s) => ({ panelCollapsed: !s.panelCollapsed })),
```
with:
```ts
setPanelMode: (mode) => set({ panelMode: mode }),
collapsePanel: () =>
  set((s) => ({
    panelMode: s.panelMode === "full" ? "collapsed" : "hidden",
  })),
```

**Step 5: Verify no TypeScript errors**

Run: `npx tsc --noEmit 2>&1 | head -30`
Expected: Errors only in FloatingPanel.tsx and IconBar.tsx (consumers not yet updated)

**Step 6: Commit**

```bash
git add src/lib/map-v2-store.ts
git commit -m "refactor: replace panelCollapsed boolean with panelMode enum"
```

---

### Task 2: Update FloatingPanel — Consume New State + Hidden Mode + Restore Button

**Files:**
- Modify: `src/components/map-v2/FloatingPanel.tsx`

**Step 1: Replace state consumption**

Replace these two lines at the top of the component:
```ts
const panelCollapsed = useMapV2Store((s) => s.panelCollapsed);
const setPanelCollapsed = useMapV2Store((s) => s.setPanelCollapsed);
```
with:
```ts
const panelMode = useMapV2Store((s) => s.panelMode);
const setPanelMode = useMapV2Store((s) => s.setPanelMode);
```

**Step 2: Update panelWidth logic**

Replace:
```ts
const panelWidth = panelCollapsed
```
with:
```ts
const panelWidth = panelMode === "collapsed" || panelMode === "hidden"
```

**Step 3: Update auto-collapse media query**

Replace:
```ts
if (e.matches) setPanelCollapsed(true);
```
with:
```ts
if (e.matches) setPanelMode("collapsed");
```

And update the dependency array from `[setPanelCollapsed]` to `[setPanelMode]`.

**Step 4: Update desktop panel rendering**

In the desktop section (`hidden sm:block`), wrap the panel div in a conditional so it doesn't render when hidden. Replace the entire desktop `<div className="hidden sm:block">` section with:

```tsx
<div className="hidden sm:block">
  {panelMode === "hidden" ? (
    /* Restore button */
    <button
      onClick={() => setPanelMode("full")}
      className="absolute top-10 left-12 z-10 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60 hover:shadow-xl transition-all duration-150 group animate-in fade-in duration-200"
      aria-label="Show panel"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400 group-hover:text-plum transition-colors">
        <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium text-gray-500 group-hover:text-plum transition-colors">Menu</span>
    </button>
  ) : (
    <div
      className={`
        absolute top-10 left-12 z-10
        bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg
        flex flex-row overflow-hidden
        transition-all duration-300 ease-out
        panel-v2-enter
        ${panelWidth} ${panelMode === "collapsed" ? "bottom-10" : hasDistrictDetail ? "bottom-10" : "bottom-[50%]"}
      `}
    >
      {/* Icon strip */}
      <IconBar />

      {/* Content area + optional right panel */}
      {panelMode === "full" && (
        <>
          <div className="flex-1 flex flex-col min-w-0 overflow-hidden v2-scrollbar panel-content-enter">
            <PanelContent />
          </div>
          {isInPlanWorkspace && <RightPanel />}
        </>
      )}
    </div>
  )}
</div>
```

**Step 5: Update mobile section**

Replace `panelCollapsed` references in the mobile section:
- `{panelCollapsed ? (` → `{panelMode !== "full" ? (`
- `onClick={() => setPanelCollapsed(false)}` → `onClick={() => setPanelMode("full")}`
- `onClick={() => setPanelCollapsed(true)}` → `onClick={() => setPanelMode("collapsed")}`

Also add hidden mode for mobile — when `panelMode === "hidden"`, show a restore button bottom-left:

Wrap the mobile `sm:hidden` section: if `panelMode === "hidden"`, render a bottom-left restore button instead of the drawer:

```tsx
<div className="sm:hidden">
  {panelMode === "hidden" ? (
    <button
      onClick={() => setPanelMode("full")}
      className="absolute bottom-4 left-4 z-10 flex items-center gap-2 px-3 py-2 bg-white/95 backdrop-blur-sm rounded-xl shadow-lg border border-gray-200/60"
      aria-label="Show panel"
    >
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none" className="text-gray-400">
        <path d="M2 4H14M2 8H14M2 12H10" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
      </svg>
      <span className="text-sm font-medium text-gray-500">Menu</span>
    </button>
  ) : panelMode !== "full" ? (
    /* existing collapsed mobile bar */
    ...
  ) : (
    /* existing expanded mobile drawer */
    ...
  )}
</div>
```

**Step 6: Verify TypeScript compiles**

Run: `npx tsc --noEmit 2>&1 | head -20`
Expected: No errors related to panelCollapsed

**Step 7: Commit**

```bash
git add src/components/map-v2/FloatingPanel.tsx
git commit -m "feat: add hidden panel mode with restore button in FloatingPanel"
```

---

### Task 3: Update IconBar — Add Collapse/Hide Chevron

**Files:**
- Modify: `src/components/map-v2/IconBar.tsx`

**Step 1: Add collapsePanel to the IconBar component**

Add this store subscription at the top of the `IconBar` component, alongside the existing ones:

```ts
const collapsePanel = useMapV2Store((s) => s.collapsePanel);
```

**Step 2: Add chevron button at the top of the icon strip**

Inside the `<div className="flex flex-col items-center py-3 gap-1 w-[56px] ...">`, add a collapse chevron as the **first child** (before `{tabs.map(...)}`):

```tsx
{/* Collapse / hide chevron */}
<button
  onClick={collapsePanel}
  className="w-9 h-5 rounded-md flex items-center justify-center text-gray-300 hover:text-plum hover:bg-gray-100 transition-all mb-1 group relative"
  title="Minimize panel"
  aria-label="Minimize panel"
>
  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
    <path
      d="M8.5 3.5L5 7L8.5 10.5"
      stroke="currentColor"
      strokeWidth="1.5"
      strokeLinecap="round"
      strokeLinejoin="round"
    />
  </svg>
  <span className="absolute left-full ml-2 px-2 py-1 bg-gray-800 text-white text-xs rounded-lg opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none whitespace-nowrap z-50">
    Hide panel
  </span>
</button>
```

This is a left-pointing chevron (`«`). Clicking it fires `collapsePanel()` which steps: full → collapsed → hidden.

**Step 3: Verify TypeScript compiles and dev server renders**

Run: `npx tsc --noEmit 2>&1 | head -10`
Expected: Clean (no panelCollapsed-related errors)

Visually verify in browser at `http://localhost:3005/map-v2`:
- Click chevron: panel collapses to icon bar
- Click chevron again: panel disappears, restore button appears top-left
- Click restore: full panel returns

**Step 4: Commit**

```bash
git add src/components/map-v2/IconBar.tsx
git commit -m "feat: add collapse chevron to IconBar for progressive panel hide"
```

---

### Task 4: Smoke Test & Final Commit

**Step 1: Full manual test**

At `http://localhost:3005/map-v2`:
1. Panel starts in full mode (icon bar + content)
2. Click chevron → collapsed (icon bar only)
3. Click chevron → hidden (full map, restore button visible top-left)
4. Click restore → full panel returns
5. Resize to tablet width → auto-collapses to collapsed mode
6. LayerBubble still works in all modes
7. Navigate to a plan, verify plan workspace still expands correctly

**Step 2: Verify no TypeScript errors**

Run: `npx tsc --noEmit`
Expected: Clean

**Step 3: Final commit if any tweaks were needed**

```bash
git add -A
git commit -m "polish: full map mode final adjustments"
```
