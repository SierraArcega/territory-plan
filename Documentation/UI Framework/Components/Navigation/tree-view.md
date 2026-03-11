# Tree View

Hierarchical tree navigation for nested data.

See `_foundations.md` for active state system, focus ring, and keyboard conventions.

> **New component** — not yet in codebase.

---

## Node Anatomy

```
flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-[#6E6390]
```

| State | Classes |
|---|---|
| Default | `text-[#6E6390]` |
| Hover | `bg-[#EFEDF5]` |
| Selected | `bg-[#fef1f0] text-[#F37167] border-l-3 border-[#F37167]` |

## Expand/Collapse

- **Chevron:** `w-3.5 h-3.5 text-[#8A80A8]`
- **Collapsed:** Points right
- **Expanded:** Rotated down
- **Rotation:** `transition-transform duration-150`
- **Leaf nodes:** No chevron — use a spacer matching the chevron width for alignment

## Indentation

`pl-6` per nesting level. Applied to the node container.

## Connector Lines (Optional)

For visual hierarchy in dense trees:

| Element | Classes |
|---|---|
| Vertical line | `border-l border-[#E2DEEC]` running down from parent |
| Horizontal stub | `border-t border-[#E2DEEC]` connecting to node |

## Node Icon (Optional)

`w-4 h-4` between chevron and label. Color inherits from text via `currentColor`.

## Code Example

```tsx
<div role="tree" aria-label="File tree">
  {/* Level 0 — expanded parent */}
  <div
    role="treeitem"
    aria-expanded="true"
    className="flex items-center gap-1.5 px-2 py-1.5 rounded-lg text-sm text-[#6E6390] hover:bg-[#EFEDF5] cursor-pointer transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
  >
    <svg className="w-3.5 h-3.5 text-[#8A80A8] rotate-90 transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    Districts
  </div>

  {/* Level 1 — selected child */}
  <div
    role="treeitem"
    aria-selected="true"
    className="flex items-center gap-1.5 px-2 py-1.5 pl-8 rounded-lg text-sm bg-[#fef1f0] text-[#F37167] border-l-3 border-[#F37167] cursor-pointer transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
  >
    <span className="w-3.5 h-3.5" /> {/* Spacer for leaf node */}
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
    </svg>
    North District
  </div>

  {/* Level 1 — collapsed child */}
  <div
    role="treeitem"
    aria-expanded="false"
    className="flex items-center gap-1.5 px-2 py-1.5 pl-8 rounded-lg text-sm text-[#6E6390] hover:bg-[#EFEDF5] cursor-pointer transition-colors duration-100 focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
  >
    <svg className="w-3.5 h-3.5 text-[#8A80A8] transition-transform duration-150" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 7v10a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-6l-2-2H5a2 2 0 00-2 2z" />
    </svg>
    South District
  </div>
</div>
```

## Keyboard

| Key | Behavior |
|---|---|
| Arrow Up / Down | Move between visible nodes |
| Arrow Right | Expand collapsed node, or move to first child |
| Arrow Left | Collapse expanded node, or move to parent |
| Home / End | First / last visible node |
| Enter | Select / activate node |
