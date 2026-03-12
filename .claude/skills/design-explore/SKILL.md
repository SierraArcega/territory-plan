---
name: design-explore
description: Use when exploring design approaches for a new feature. Creates 2-3 Paper prototypes with different architectural and visual directions, presents them for comparison, and iterates on user feedback until a direction is approved.
---

# Design Exploration

The creative heart of the feature pipeline. Takes requirements and component context, generates 2-3 meaningfully different approaches as Paper prototypes, presents them side-by-side, iterates on feedback.

## When to Use

- Invoked by `/new-feature` orchestrator during stages 2-3
- Standalone via `/design-explore` when exploring design directions for any UI work
- When you need to compare multiple architectural approaches visually

## Inputs

Before starting, you need:
- **Feature requirements** — what the feature does, who it's for, constraints
- **UI component candidates** — existing components found via `frontend-design` discovery
- **Backend context** (optional) — data shape and API patterns from `backend-discovery`

If invoked standalone, gather these by asking the user and running the `frontend-design` discovery workflow.

## Process

### 1. Analyze Requirements

Identify the key UX decisions:
- Layout type (panel, page, modal, inline)
- Information hierarchy (what's primary, secondary, tertiary)
- Interaction model (click-to-expand, side-by-side, overlay, tabs)
- Navigation pattern (back button, breadcrumbs, tabs, drill-down)

### 2. Generate 2-3 Approaches

Each approach must be **meaningfully different** — not variations on a theme:
- Different architectural choices (panel vs page, tabs vs scroll, modal vs inline)
- Different information hierarchy (what's prominent vs tucked away)
- Different interaction models (click-to-expand, side-by-side, overlay)

For each approach, write a 2-sentence description before prototyping.

### 3. Prototype in Paper

For each approach:

1. Read the relevant `Documentation/UI Framework/` docs via the `frontend-design` skill discovery workflow
2. Create a new artboard in the Mapomatic Design System file:
   ```
   mcp__paper__create_artboard(title: "[Feature] — Approach [A/B/C]", width: 1440, height: 900)
   ```
3. Build the prototype using `write_html` in small increments (one visual group per call — see Paper MCP instructions)
4. Use brand tokens from `tokens.md` — plum-derived colors, Plus Jakarta Sans, spacing scale
5. Apply craft principles (see Craft Guidance below)
6. Screenshot every 2-3 modifications using the Paper Review Checkpoints

### 4. Present for Comparison

Screenshot each prototype and present with:
- One-line description of the approach
- Key trade-offs (complexity, information density, interaction cost)
- Your recommendation with reasoning

Format:
```
--- Design Exploration Complete ---

Approach A: [description]
  Trade-offs: [pros/cons]

Approach B: [description]
  Trade-offs: [pros/cons]

Approach C: [description]
  Trade-offs: [pros/cons]

Recommended: [A/B/C] because [reasoning]

→ Pick a direction to refine, request changes, or ask me to explore more options.
```

### 5. Iterate

Based on user feedback:
- "I like A but with the sidebar from B" → refine in Paper
- "None of these — what about X?" → generate new approach
- "A is perfect" → proceed to refine

### 6. Refine

Once direction is chosen:
- Add detail: hover states, loading states, empty states, error states
- Check against component docs for each element used
- Screenshot and present for final approval
- Record the approved Paper artboard/node IDs for the spec

## Prototyping Fidelity

Paper prototypes are **layout and structure explorations**, not pixel-perfect mockups. Their purpose is to:
- Resolve architectural questions (panel vs page, tabs vs scroll)
- Establish information hierarchy (what's prominent, what's secondary)
- Validate component selection (which doc patterns to use)
- Explore interaction models (expand, navigate, overlay)

The prototype is a **contract for structure and hierarchy**, not for pixel measurements. Implementation may differ in spacing details — the prototype locks in the architecture.

## Craft Guidance

When prototyping in Paper, apply these principles within the Fullmind brand:

### Typography Rhythm
- Create clear hierarchy using the 5-tier scale: Display (hero) → Heading (sections) → Body (content) → Caption (metadata) → Micro (chrome)
- Vary weight within a tier for emphasis — `font-medium` vs `font-bold` at Body size creates subtle hierarchy without changing scale
- Use `tracking-wider` + `uppercase` on Caption tier for section labels — visual separation without borders

### Color Composition
- Lead with Plum (`#403770`) + Off-white (`#FFFCFA`) as the foundation
- One accent moment per view is stronger than five. A single Coral badge draws the eye; five compete
- Use plum-derived neutral tints (`#F7F5FA`, `#EFEDF5`) for depth layers instead of shadows
- Robin's Egg at low opacity (`bg-[#C4E7E6]/10`) creates warmth without demanding attention

### Spacing Composition
- Tighter within groups, generous between sections — creates "breathing room" for dense data
- Asymmetric padding (more top than bottom on headers, more left on content) creates visual flow
- Section gaps large enough that you'd never mistake two sections for one group

### Motion Design (noted for implementation, not prototyped)
- Entrance: stagger list items 30-50ms apart for cascade effect
- Hover: `transition-colors duration-100` — responsive without flashing
- Panel transitions: 200-250ms with `cubic-bezier(0.16, 1, 0.3, 1)` for natural deceleration
- Never animate layout shifts (width/height) — only opacity, transform, and color

### Composition Principles
- Hero element gets 40-60% of visual weight. Everything else supports it
- Create vertical rhythm by aligning elements across sections (labels at same x-offset, values at same x-offset)
- When balancing data density and visual appeal, solve for density first, then add warmth through color and spacing — not decoration
