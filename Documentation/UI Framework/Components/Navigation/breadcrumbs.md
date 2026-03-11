# Breadcrumbs

Trail navigation for multi-level page hierarchies.

See `_foundations.md` for focus ring and keyboard conventions.

> **New component** — not yet in codebase.

---

## Anatomy

```
Home  >  Section  >  Subsection  >  Current Page
```

Each item is separated by a chevron-right icon. The last item (current page) is not clickable.

## Styling

### Clickable Ancestors

```
text-sm text-[#6EA3BE] hover:text-[#403770] hover:underline
```

Standard anchor elements. Each ancestor links to its page.

### Current Page (Last Item)

```
text-sm font-medium text-[#403770]
```

Not clickable — rendered as a `<span>`, not an `<a>`.

### Separator

Chevron-right icon between items:

```
w-3 h-3 text-[#A69DC0]
```

Gap between items and separators: `gap-1.5`

### Container

```
flex items-center gap-1.5 text-sm
```

No background, no border. Sits in page headers.

## Code Example

```tsx
<nav aria-label="Breadcrumb">
  <ol className="flex items-center gap-1.5 text-sm">
    <li>
      <a
        href="/home"
        className="text-[#6EA3BE] hover:text-[#403770] hover:underline focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none rounded"
      >
        Home
      </a>
    </li>
    <li>
      <svg className="w-3 h-3 text-[#A69DC0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </li>
    <li>
      <a
        href="/home/plans"
        className="text-[#6EA3BE] hover:text-[#403770] hover:underline focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none rounded"
      >
        Plans
      </a>
    </li>
    <li>
      <svg className="w-3 h-3 text-[#A69DC0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
      </svg>
    </li>
    <li>
      <span className="text-sm font-medium text-[#403770]">Territory Plan Q1</span>
    </li>
  </ol>
</nav>
```

## Truncation

When the path exceeds 4 levels, middle items collapse to an ellipsis button:

```tsx
<li>
  <button
    className="text-sm text-[#6EA3BE] hover:text-[#403770] hover:underline focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none rounded px-1"
    aria-label="Show full path"
  >
    ...
  </button>
</li>
```

Clicking the ellipsis expands a dropdown showing the collapsed items.

## Keyboard

- Each ancestor link is focusable via `Tab`
- `Enter` / `Space` on ellipsis button opens the dropdown
- Arrow keys navigate dropdown items
- `Escape` closes the dropdown

## Migration Note

`PlansView` currently uses a back-button chevron for navigation. Breadcrumbs should replace this when navigation depth exceeds 1 level.

## Codebase Examples

| Component | File |
|---|---|
| PlansView (back button) | `src/features/shared/components/views/PlansView.tsx` |
