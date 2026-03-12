# Iconography, Emoji & Logo Guide — Design Spec

## Overview

A comprehensive visual vocabulary for Mapomatic, establishing the standard icon library, emoji usage policy, and logo/app icon specifications. This document serves as the authoritative cross-cutting reference for all visual assets in the product, sitting alongside `tokens.md` and `forms.md` in the UI Framework.

### Goals

- Adopt a single icon library that aligns with existing stroke-based SVG conventions
- Define when and where emojis are appropriate vs. icons
- Codify logo usage rules and app icon derivatives
- Provide a semantic icon map linking Mapomatic concepts to specific icon names
- Enable consistency across all UI surfaces without ad-hoc visual decisions

### Non-Goals

- Designing custom icons or commissioning illustration work
- Defining animation behavior for icons (covered by `tokens.md` animation tokens)
- Replacing existing component `_foundations.md` files — this supplements them

---

## Document Structure

The deliverable is a single top-level file at `Documentation/UI Framework/iconography.md` organized in three sections:

1. **Icon System** — library, specs, size scale, semantic map, rules
2. **Emoji Policy** — tiers, approved set, placement rules
3. **Logo & App Icons** — product logo, derivatives, usage rules

Each component `_foundations.md` file will be updated to reference `iconography.md` for canonical icon assignments, with component-specific overrides noted inline.

---

## Section 1: Icon System

### Library Choice

**Lucide** (`lucide-react`) is the standard icon library for Mapomatic.

**Rationale:**
- Stroke-based by default — ships with `fill="none" stroke="currentColor"`, `strokeWidth={2}`, `strokeLinecap="round"`, `strokeLinejoin="round"`. This matches the existing specs already documented in `Navigation/_foundations.md` with zero adaptation.
- React-first — tree-shakeable named imports (`import { MapPin } from 'lucide-react'`).
- Domain coverage — strong representation for school/education, map/geography, data/analytics, and organizational concepts.
- 1,500+ icons — sufficient coverage without the overwhelming catalog size of larger libraries.
- Active maintenance with frequent releases.

### Technical Specifications

These consolidate and canonicalize the icon specs currently scattered across component foundation files.

| Property | Value |
|----------|-------|
| Format | Stroke-based SVG |
| Fill | `none` |
| Stroke | `currentColor` |
| Stroke width | `2` |
| Stroke line cap | `round` |
| Stroke line join | `round` |
| ViewBox | `0 0 24 24` |
| Sizing | Via Tailwind `w-` and `h-` utility classes |
| Color | Inherited via `currentColor` — never hardcode a color directly on an icon |
| Spacing from text | `gap-2` |

### Size Scale

Aligned with the existing type scale from `tokens.md`.

| Context | Tailwind Class | Pixel Size | Usage |
|---------|---------------|------------|-------|
| Inline / Caption | `w-4 h-4` | 16px | Inside buttons, badges, table cells |
| Default / Body | `w-5 h-5` | 20px | Navigation items, form inputs, list items |
| Heading / Standalone | `w-6 h-6` | 24px | Page headers, empty states, card titles |

### Semantic Icon Map

One concept = one icon, always. This map is the canonical lookup. Organized by domain.

#### Navigation & Chrome

| Concept | Lucide Icon | Notes |
|---------|-------------|-------|
| Expand / Open | `ChevronDown` | |
| Collapse / Close section | `ChevronUp` | |
| Close / Dismiss | `X` | Modals, flyouts, toasts |
| Menu / Hamburger | `Menu` | Mobile nav toggle |
| Back | `ArrowLeft` | |
| Search | `Search` | |
| Settings / Preferences | `Settings` | Gear icon |
| Home | `Home` | |
| External link | `ExternalLink` | Opens in new tab |
| More actions | `MoreHorizontal` | Overflow menus |
| Breadcrumb separator | `ChevronRight` | |

#### Territory & Map

| Concept | Lucide Icon | Notes |
|---------|-------------|-------|
| Location / Pin | `MapPin` | Single point on map |
| Territory / Zone | `Map` | Area or region |
| Layers | `Layers` | Map layer controls |
| Compass / Orientation | `Compass` | |
| Globe / Overview | `Globe` | High-level geographic view |
| Route / Path | `Route` | Travel or connectivity |
| Zoom in | `ZoomIn` | |
| Zoom out | `ZoomOut` | |

#### Schools & Education

| Concept | Lucide Icon | Notes |
|---------|-------------|-------|
| School | `School` | School building |
| Students / Users | `Users` | Group of people |
| Graduation | `GraduationCap` | Achievement, completion |
| Book / Curriculum | `BookOpen` | |
| Calendar / Schedule | `Calendar` | |
| Backpack / Student | `Backpack` | Individual student context |

#### Data & Actions

| Concept | Lucide Icon | Notes |
|---------|-------------|-------|
| Filter | `Filter` | |
| Sort ascending | `ArrowUpNarrowWide` | |
| Sort descending | `ArrowDownWideNarrow` | |
| Download / Export | `Download` | |
| Upload / Import | `Upload` | |
| Edit | `Pencil` | |
| Delete / Remove | `Trash2` | |
| Add / Create | `Plus` | |
| Copy / Duplicate | `Copy` | |
| Save | `Save` | |
| Refresh | `RefreshCw` | |
| Undo | `Undo2` | |
| Redo | `Redo2` | |

#### Status & Feedback

| Concept | Lucide Icon | Notes |
|---------|-------------|-------|
| Success / Complete | `Check` | |
| Warning | `AlertTriangle` | |
| Error | `AlertCircle` | |
| Info | `Info` | |
| Loading / Spinner | `Loader2` | Use with `animate-spin` |
| Help | `HelpCircle` | |
| Lock / Restricted | `Lock` | |
| Unlock / Accessible | `Unlock` | |
| Eye / Visible | `Eye` | Show/reveal toggle |
| Eye off / Hidden | `EyeOff` | Hide toggle |

### Icon Rules

1. **One concept = one icon, always.** Do not use `X` for close in one place and `XCircle` in another. The semantic map above is canonical.
2. **Lucide only.** If Lucide does not have what you need, request a custom icon built to the same stroke specs. Do not mix icon libraries.
3. **Icons are functional, not decorative.** Every icon must serve a purpose — wayfinding, action identification, or status communication. Do not add icons for visual flair.
4. **Never hardcode color.** Icons inherit color via `currentColor`. Color changes happen on the parent element, not the SVG.
5. **Always pair with accessible text.** Standalone icons (not next to a visible label) require `aria-label` or an adjacent `sr-only` span. Icons next to visible text get `aria-hidden="true"`.

---

## Section 2: Emoji Policy

Emojis serve two purposes in Mapomatic: **status feedback** and **content warmth**. They are never used as primary UI elements or replacements for Lucide icons.

### Tier 1 — Status / Feedback

Used in toasts, alerts, and inline status indicators. These pair with (never replace) the semantic color system from `tokens.md`.

| Concept | Emoji | Where Used |
|---------|-------|------------|
| Success | ✅ | Toast confirmations, completed steps |
| Warning | ⚠️ | Alert callouts, validation messages |
| Error | ❌ | Error toasts, failed actions |
| Info | ℹ️ | Informational callouts, tips |
| In progress | ⏳ | Pending states, processing indicators |

### Tier 2 — Personality / Warmth

Used in empty states, onboarding flows, and conversational UI moments to align with the "approachable and warm" brand voice.

| Context | Examples | Guideline |
|---------|----------|-----------|
| Empty states | 📋 🗺️ 🎯 | One emoji per empty state, placed above the heading |
| Onboarding | 👋 🎉 🚀 | Welcoming tone, used sparingly in step headers |
| Tooltips / hints | 💡 📌 | Only when the hint is informal/helpful, not critical |

### Emoji Rules

1. **Max one emoji per UI surface.** Never stack or cluster emojis.
2. **Never in navigation, table data, or form labels.** Those contexts use Lucide icons only.
3. **System emoji only.** No custom emoji images — rely on native platform rendering for consistency.
4. **No emoji in error-critical paths.** Error modals and destructive confirmations use icons only for clarity.
5. **Accessibility.** Emojis in HTML receive `role="img"` and `aria-label` describing their meaning. Example: `<span role="img" aria-label="Success">✅</span>`.

---

## Section 3: Logo & App Icons

### Product Logo

- **Primary mark:** The Fullmind/Mapomatic wordmark.
- **Color variants:**

| Variant | Color | Background | Usage |
|---------|-------|------------|-------|
| Full color | Plum `#403770` | Light / Off-White | Default, most contexts |
| Reversed | Off-White `#FFFCFA` | Dark / Plum | Dark headers, branded backgrounds |
| Monochrome | Single color | Constrained contexts | Favicons, watermarks |

- **Clear space:** Minimum padding equal to the cap-height of the wordmark on all sides.
- **Minimum size:** Never render the wordmark below 24px height in-app.
- **Placement:** Top-left of the sidebar or header; links to home/dashboard.

### App Icon Derivatives

| Asset | Size | Format | Usage |
|-------|------|--------|-------|
| Favicon | 32x32, 16x16 | `.ico` or `.svg` | Browser tab |
| Apple Touch Icon | 180x180 | `.png` | iOS home screen |
| PWA Icons | 192x192, 512x512 | `.png` | Android / PWA manifest |
| Open Graph / Social | 1200x630 | `.png` | Link previews (Slack, Twitter, etc.) |
| Splash / Loading | Scalable | `.svg` | App loading state |

### Logo Rules

1. **Never stretch, rotate, or recolor** the logo outside the defined variants.
2. **Favicon uses the logomark only** (no wordmark) — it must read clearly at 16px.
3. **Social cards** include the wordmark plus a brief tagline on a Plum or Off-White background.
4. **No logo on map surfaces.** The map viewport stays unbranded to maximize usable space.
5. **Loading state** uses a subtle animated logomark (pulse or fade), not a generic spinner.

---

## Integration with Existing Docs

### New file

- `Documentation/UI Framework/iconography.md` — the deliverable produced from this spec.

### Updated files

Each component category `_foundations.md` will be updated to:
1. Remove any inline icon specifications that are now canonicalized in `iconography.md`.
2. Add a reference: *"See `iconography.md` for the icon library, size scale, and semantic map."*
3. Retain any component-specific icon overrides inline with a note explaining the deviation.

Specifically:
- `Navigation/_foundations.md` — currently contains the most icon specs; these move to `iconography.md`.
- `Display/_foundations.md` — empty state icons reference the emoji policy.
- `Containers/_foundations.md` — close/dismiss icon standardized to `X`.

### No changes to

- `tokens.md` — remains focused on color, type, spacing, elevation, animation tokens.
- `forms.md` — no icon-specific content.
- Individual component files (e.g., `modal.md`, `tabs.md`) — these reference their `_foundations.md` which in turn references `iconography.md`.

---

## Open Questions

1. **Custom icons:** If Lucide gaps are discovered during implementation, should custom icons be added to a project-level SVG sprite, or as individual React components?
2. **Icon map growth:** At what threshold (50+ entries? 75+?) should the semantic icon map be extracted to a separate `icon-map.md` lookup table?
3. **Emoji rendering variance:** Should the doc include a note about cross-platform emoji rendering differences (Windows vs. macOS vs. mobile), or is native rendering acceptable as-is?
