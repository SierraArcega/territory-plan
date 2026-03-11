# Steps

Stepper/wizard indicators for multi-step flows.

See `_foundations.md` for focus ring and keyboard conventions.

> **New component** — not yet in codebase.

---

## Anatomy

Horizontal stepper: numbered circles connected by horizontal lines, with labels below.

```
  ✓          2          3          4
  ○──────────○──────────○──────────○
Step 1     Step 2     Step 3     Step 4
```

## Circle States

| State | Circle | Text | Icon |
|---|---|---|---|
| Completed | `w-8 h-8 rounded-full bg-[#403770] text-white` | `text-xs font-medium text-[#403770]` | Checkmark `w-4 h-4` |
| Active | `w-8 h-8 rounded-full border-2 border-[#F37167] text-[#F37167] bg-white` | `text-xs font-semibold text-[#F37167]` | Step number |
| Upcoming | `w-8 h-8 rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white` | `text-xs font-medium text-[#8A80A8]` | Step number |

## Connector Lines

| State | Classes |
|---|---|
| Default | `h-0.5 bg-[#D4CFE2] flex-1` |
| Completed segment | `h-0.5 bg-[#403770] flex-1` |

## Labels

```
text-xs font-medium mt-2
```

Below each circle, centered. Color matches the circle state.

## Layout

```
flex items-center
```

`gap-0` between circles and connectors — connectors fill space with `flex-1`.

## Code Example

```tsx
<div className="flex items-center w-full">
  {/* Step 1 — Completed */}
  <div className="flex flex-col items-center">
    <div className="w-8 h-8 rounded-full bg-[#403770] text-white flex items-center justify-center">
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
      </svg>
    </div>
    <span className="text-xs font-medium mt-2 text-[#403770]">Details</span>
  </div>

  {/* Connector — completed */}
  <div className="h-0.5 bg-[#403770] flex-1" />

  {/* Step 2 — Active */}
  <div className="flex flex-col items-center">
    <div className="w-8 h-8 rounded-full border-2 border-[#F37167] text-[#F37167] bg-white flex items-center justify-center text-xs font-semibold">
      2
    </div>
    <span className="text-xs font-semibold mt-2 text-[#F37167]">Districts</span>
  </div>

  {/* Connector — default */}
  <div className="h-0.5 bg-[#D4CFE2] flex-1" />

  {/* Step 3 — Upcoming */}
  <div className="flex flex-col items-center">
    <div className="w-8 h-8 rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white flex items-center justify-center text-xs font-medium">
      3
    </div>
    <span className="text-xs font-medium mt-2 text-[#8A80A8]">Activities</span>
  </div>

  {/* Connector — default */}
  <div className="h-0.5 bg-[#D4CFE2] flex-1" />

  {/* Step 4 — Upcoming */}
  <div className="flex flex-col items-center">
    <div className="w-8 h-8 rounded-full border border-[#D4CFE2] text-[#8A80A8] bg-white flex items-center justify-center text-xs font-medium">
      4
    </div>
    <span className="text-xs font-medium mt-2 text-[#8A80A8]">Review</span>
  </div>
</div>
```

## Compact Variant

No labels — circles and lines only. For tight spaces or inline indicators.

## Keyboard

- Arrow keys move between steps (when steps are clickable for non-linear wizards)
- `Enter` activates a step
