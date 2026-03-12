# Iconography, Emoji & Logo Guide

Cross-cutting reference for all visual assets in Mapomatic. Sits alongside `tokens.md` as a system-wide authority.

For component-specific icon sizes and overrides, see each category's `_foundations.md`.

---

## Icon System

### Library

**Lucide** (`lucide-react`) is the standard icon library for Mapomatic.

**Rationale:**
- Stroke-based by default — matches the stroke specifications already documented in `Navigation/_foundations.md`.
- React-first — tree-shakeable named imports.
- Domain coverage — strong representation for school/education, map/geography, data/analytics.
- 1,500+ icons — sufficient coverage without overwhelming catalog size.
- Active maintenance with frequent releases.

```tsx
import { MapPin, Search, Filter } from 'lucide-react';
```

### Technical Specs

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

Aligned with the existing type scale from `tokens.md`. Component `_foundations.md` files may define their own tiers — those are valid component-level overrides.

| Context | Tailwind Class | Pixel Size | Stroke Width | Usage |
|---------|---------------|------------|--------------|-------|
| Compact | `w-3.5 h-3.5` | 14px | `2` | Compact nav items, dense table rows |
| Inline / Caption | `w-4 h-4` | 16px | `2` | Inside buttons, badges, table cells |
| Default / Body | `w-5 h-5` | 20px | `2` | Navigation items, form inputs, list items |
| Heading / Standalone | `w-6 h-6` | 24px | `2` | Page headers, card titles |
| Feature / Empty State | `w-10 h-10` | 40px | `1.5` | Empty state illustrations, feature highlights |

At the Feature / Empty State size, `strokeWidth` drops to `1.5` to maintain visual weight.

### Semantic Icon Map

One concept = one icon, always. This map is canonical.

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
| Student (individual) | `UserRound` | Individual student context |

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

## Emoji Policy

Emojis serve two purposes in Mapomatic: **status feedback** and **content warmth**. They are never used as primary UI elements or replacements for Lucide icons.

### Tier 1 — Status / Feedback

Pair with (never replace) the semantic color system from `tokens.md`.

| Concept | Emoji | Where Used |
|---------|-------|------------|
| Success | ✅ | Toast confirmations, completed steps |
| Warning | ⚠️ | Alert callouts, validation messages |
| Error | ❌ | Error toasts, failed actions |
| Info | ℹ️ | Informational callouts, tips |
| In progress | ⏳ | Pending states, processing indicators |

### Tier 2 — Personality / Warmth

Used in empty states, onboarding, and conversational UI moments. Aligns with the "approachable and warm" brand voice.

| Context | Examples | Guideline |
|---------|----------|-----------|
| Empty states | 📋 🗺️ 🎯 | Optional — may use a Lucide icon (Feature size) or an emoji above the heading, not both. Existing icon-based empty states remain valid. |
| Onboarding | 👋 🎉 🚀 | Welcoming tone, used sparingly in step headers |
| Tooltips / hints | 💡 📌 | Only when the hint is informal/helpful, not critical |

### Emoji Rules

1. **Max one emoji per UI surface.** Never stack or cluster emojis.
2. **Never in navigation, table data, or form labels.** Those contexts use Lucide icons only.
3. **System emoji only.** No custom emoji images — rely on native platform rendering for consistency.
4. **No emoji in destructive/modal contexts.** Error modals and destructive confirmations use Lucide icons only for clarity. Lightweight feedback (toasts, inline alerts) may use Tier 1 emojis.
5. **Accessibility.** Emojis in HTML receive `role="img"` and `aria-label` describing their meaning. Example: `<span role="img" aria-label="Success">✅</span>`.

---

## Logo & App Icons

### Product Logo

- **Primary mark:** The Fullmind/Mapomatic wordmark.

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

1. **Never stretch, rotate, or recolor** outside the defined variants.
2. **Favicon uses the logomark only** (no wordmark) — must read at 16px.
3. **Social cards** include the wordmark + brief tagline on Plum or Off-White background.
4. **No logo on map surfaces.** The viewport stays unbranded to maximize usable space.
5. **Loading state** uses a subtle animated logomark (pulse or fade), not a generic spinner.
