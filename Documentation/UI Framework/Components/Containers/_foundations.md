# Container Foundations

Containers are layout components that establish spatial relationships, visual hierarchy, and interaction patterns. They form the structural backbone of our UI, organizing content and controlling how users interact with information.

## Container Selection Decision Tree

```
Does the content need:
├─ A temporary overlay that dismisses content underneath?
│  ├─ Center of screen with focused interaction?
│  │  └─ Modal
│  ├─ Adjacent to trigger element?
│  │  └─ Popover
│  └─ Full-screen takeover from edge?
│     └─ Flyout
├─ Persistent on-canvas space with distinct visual separation?
│  ├─ Full-height edge placement?
│  │  └─ Panel
│  └─ Inline with other content?
│     └─ Card
├─ Multiple mutually exclusive content sections?
│  ├─ Horizontal organization?
│  │  └─ Tabs
│  └─ Vertical collapse/expand?
│     └─ Accordion
└─ Fixed position at viewport edge?
   └─ Bottom Bar
```

## Border Tiers

All containers use these border tiers to communicate visual hierarchy and context:

| Tier | Usage | Tailwind Class | Example |
|------|-------|---|---|
| **Tier 1** | Default container separation | `border border-neutral-200` | Cards, panels, modals |
| **Tier 2** | Emphasized or interactive containers | `border-2 border-neutral-300` | Highlighted sections, form containers |
| **Tier 3** | Critical or high-emphasis states | `border-2 border-danger-300` | Error states, warnings |

## Radius Tiers

Container corner radius follows a measured scale:

| Tier | Value | Tailwind Class | When to Use |
|------|-------|---|---|
| **None** | 0px | `rounded-none` | Edges touching viewport or frame edges |
| **Tier 1** | 8px | `rounded-lg` | Default cards, panels, standard containers |
| **Tier 2** | 12px | `rounded-xl` | Modals, featured containers, elevated components |
| **Tier 3** | 16px | `rounded-2xl` | Maximum radius for large overlay containers |

## Shadow Scale

Shadows establish depth and visual layering:

| Level | Use Case | Tailwind Class | Z-index Context |
|-------|----------|---|---|
| **None** | On-canvas static elements | `shadow-none` | Base layers |
| **Light** | Subtle elevation | `shadow-sm` | Hover states, minor elevation |
| **Medium** | Standard layering | `shadow-md` | Cards, panels, standard overlays |
| **Large** | Prominent elevation | `shadow-lg` | Modals, flyouts, top-level overlays |
| **Extra Large** | Maximum depth | `shadow-xl` | Full-screen modals, critical overlays |

## Close Button Pattern

Close buttons provide explicit dismissal and follow a consistent pattern:

```jsx
<button
  onClick={() => onDismiss?.()}
  className="absolute top-4 right-4 p-2 rounded-lg hover:bg-neutral-100"
  aria-label="Close"
>
  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
  </svg>
</button>
```

### Close Button Placement
- **Modals & Flyouts**: Top right corner, inside container
- **Popovers**: Top right corner, if content exceeds 200px height
- **Panels**: Top right corner, inside container
- **Cards**: Only for dismissible cards (temporary status, notifications)
- **Tabs & Accordion**: Never include close buttons

### Close Button Accessibility
- Always include `aria-label="Close"` for screen readers
- Ensure minimum 44x44px touch target
- Use standard X icon or text label
- Position outside main content scroll area

## Backdrop Pattern

Backdrops create visual separation for overlay containers:

```jsx
// Semi-transparent backdrop
<div className="fixed inset-0 bg-black bg-opacity-50 transition-opacity duration-200" />

// No backdrop (use for inline containers like panels)
// Card and panel components don't use backdrops
```

### Backdrop Usage
- **Modals**: Always use backdrop
- **Flyouts**: Optional backdrop for depth emphasis
- **Popovers**: No backdrop (adjacent to trigger)
- **Panels**: No backdrop (persistent on-canvas)
- **Cards**: No backdrop (static content)

## Dismiss Behavior

Containers implement dismissal based on context:

### Click Outside
```jsx
useEffect(() => {
  const handleClickOutside = (e) => {
    if (containerRef.current && !containerRef.current.contains(e.target)) {
      onDismiss?.();
    }
  };

  document.addEventListener('mousedown', handleClickOutside);
  return () => document.removeEventListener('mousedown', handleClickOutside);
}, [onDismiss]);
```

### Keyboard Escape
```jsx
useEffect(() => {
  const handleKeyDown = (e) => {
    if (e.key === 'Escape') {
      onDismiss?.();
    }
  };

  document.addEventListener('keydown', handleKeyDown);
  return () => document.removeEventListener('keydown', handleKeyDown);
}, [onDismiss]);
```

### Dismiss by Container Type
| Container | Click Outside | Escape Key | Close Button | Context Menu |
|-----------|---|---|---|---|
| Modal | Yes | Yes | Yes | No |
| Popover | Yes | Yes | Optional | Yes |
| Flyout | Yes | Yes | Yes | No |
| Panel | No | No | Yes | Yes |
| Card | No | No | Optional | Yes |
| Tabs | N/A | N/A | No | Yes |
| Accordion | N/A | N/A | No | Yes |
| Bottom Bar | Yes | Yes | Yes | No |

## Padding Rhythm

Container padding follows a consistent vertical and horizontal scale:

| Container Type | Horizontal Padding | Vertical Padding | Tailwind Class |
|---|---|---|---|
| **Small** (Compact modals, popovers) | 16px | 12px | `px-4 py-3` |
| **Medium** (Standard containers, cards) | 20px | 16px | `px-5 py-4` |
| **Large** (Panels, flyouts, featured content) | 24px | 20px | `px-6 py-5` |

### Padding Adjustments
- Reduce padding by 25% for mobile viewports
- Add `gap-4` or `gap-6` between stacked sections
- Apply padding to individual content blocks, not wrapper
- Use `px-0 py-0` for full-bleed content sections

## Header Pattern

Container headers establish context and support interactions:

```jsx
<div className="flex items-center justify-between gap-4 border-b border-neutral-200 px-6 py-4">
  <div className="flex-1">
    <h2 className="text-lg font-semibold text-neutral-900">Header Title</h2>
    <p className="text-sm text-neutral-600">Optional subtitle or description</p>
  </div>
  <div className="flex items-center gap-2">
    {/* Action buttons or controls */}
  </div>
</div>
```

### Header Guidelines
- Use consistent heading hierarchy (h2 for modals/panels, h3 for cards)
- Always include bottom border separator (`border-b border-neutral-200`)
- Support subtitle for additional context
- Right-align action buttons or secondary controls
- Apply full-width padding consistent with container body
- Keep header height to ~64px minimum for touch accessibility
