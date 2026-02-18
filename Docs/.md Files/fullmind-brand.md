
---
name: fullmind-brand
description: Fullmind brand guidelines for the territory planning product. Covers colors, semantic color system, typography, component patterns, spacing, and responsive behavior. For graphic design and marketing guidelines (logo, photography, dashed line element), see the marketing brand guide.
---

# Fullmind Brand Guide

Fullmind is a remote learning company that extends the capacity of schools. The brand is colorful, approachable, and energetic.

## Brand Colors

### Primary Colors (Required)

| Color | Hex | RGB | Use |
|-------|-----|-----|-----|
| Deep Coral | `#F37167` | 243, 113, 103 | Negative signals, warnings, declining trends, competitor data |
| Plum | `#403770` | 64, 55, 112 | Primary text, headers, buttons, contrast |

### Secondary Colors (For dimension)

| Color | Hex | RGB | Use |
|-------|-----|-----|-----|
| Golden | `#FFCF70` | 255, 207, 112 | Caution signals, at-risk indicators, secondary warnings |
| Steel Blue | `#6EA3BE` | 110, 163, 190 | Neutral data, baselines, benchmarks, informational accents |
| Robin's Egg | `#C4E7E6` | 196, 231, 230 | Selection states, informational backgrounds, cards |
| Mint | `#EDFFE3` | 235, 245, 230 | Positive signals, growth indicators, success states |
| Off-white | `#FFFCFA` | 255, 253, 248 | Page backgrounds |

### Color Rules

- Always use Plum as the primary text and UI color
- Use Off-white backgrounds to keep brand approachable (never stark white)
- **Never place Deep Coral text/elements on Plum background**
- **Warm colors (Deep Coral, Golden) are reserved for negative/cautionary signals** — never use them to highlight positive outcomes, success states, or growth

### Semantic Color System

| Meaning | Color | Example uses |
|---------|-------|-------------|
| Negative / declining | Deep Coral `#F37167` | Enrollment drops, lost districts, negative trends, competitor presence |
| Caution / at-risk | Golden `#FFCF70` | Budget warnings, expiring contracts, stagnant metrics |
| Neutral / baseline | Steel Blue `#6EA3BE` | Industry averages, benchmarks, no-change indicators, planned status |
| Positive / growth | Mint `#EDFFE3` shades | Enrollment growth, won districts, improving ratios, success confirmations |
| Selected / active | Robin's Egg `#C4E7E6` | Selected rows, active tabs, current filters, informational cards |
| Primary UI | Plum `#403770` | Text, headers, primary buttons, form submits |

### Data Visualization Palette

When building charts, metrics, and trend indicators:

| Data type | Color | Notes |
|-----------|-------|-------|
| Positive trend (up arrow, growth line) | Mint shades (`#EDFFE3` → `#a6b39f`) | Use darker shades for lines/text, lighter for fills |
| Negative trend (down arrow, decline line) | Deep Coral shades (`#F37167` → `#fde3e1`) | Darker for lines/text, lighter for fills |
| Caution / mixed | Golden shades (`#FFCF70` → `#fff5e2`) | Darker for lines/text, lighter for fills |
| Neutral / baseline / comparison | Steel Blue shades (`#6EA3BE` → `#e2edf2`) | Darker for lines/text, lighter for fills |
| Your data (primary series) | Plum `#403770` | When comparing your data against benchmarks |

### Form States

| State | Color | Usage |
|-------|-------|-------|
| Warning (soft) | Deep Coral `#F37167` | Field-level warnings, non-blocking validation |
| Error (hard) | Red `#EF4444` (Tailwind red-500) | Required field errors, submission failures |
| Success | Mint shades | Saved confirmations, valid fields, success messages |
| Focus | Plum `#403770` | `focus:ring-[#403770]` on all inputs |
| Disabled | Gray-300 | Standard Tailwind gray for disabled controls |

### Badges & Tags

All badges and tags use the **soft style** — tinted background with darker text in the same color family.

```tsx
{/* Negative signal badge */}
<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#F37167]/15 text-[#c25a52]">
  Declining
</span>

{/* Caution badge */}
<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#FFCF70]/20 text-[#997c43]">
  At Risk
</span>

{/* Neutral badge */}
<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#6EA3BE]/15 text-[#4d7285]">
  Stable
</span>

{/* Positive badge */}
<span className="px-2 py-0.5 text-xs font-medium rounded-full bg-[#EDFFE3] text-[#5f665b]">
  Growing
</span>

{/* Count badge */}
<span className="px-1.5 py-0.5 text-[10px] font-bold rounded-full bg-[#403770]/10 text-[#403770] min-w-[18px] text-center">
  3
</span>
```

### Tints & Shades

Each brand color has a 10-step tint (lighter) and shade (darker) scale for hover states, disabled states, backgrounds, and depth.

#### Deep Coral `#F37167`

| Step | Shades (darker) | Tints (lighter) |
|------|-----------------|-----------------|
| 10% | `#db665d` | `#f47f76` |
| 20% | `#c25a52` | `#f58d85` |
| 30% | `#aa4f48` | `#f79c95` |
| 40% | `#92443e` | `#f8aaa4` |
| 50% | `#7a3934` | `#f9b8b3` |
| 60% | `#612d29` | `#fac6c2` |
| 70% | `#49221f` | `#fbd4d1` |
| 80% | `#311715` | `#fde3e1` |
| 90% | `#180b0a` | `#fef1f0` |

#### Golden `#FFCF70`

| Step | Shades (darker) | Tints (lighter) |
|------|-----------------|-----------------|
| 10% | `#e6ba65` | `#ffd47e` |
| 20% | `#cca65a` | `#ffd98d` |
| 30% | `#b3914e` | `#ffdd9b` |
| 40% | `#997c43` | `#ffe2a9` |
| 50% | `#806838` | `#ffe7b8` |
| 60% | `#66532d` | `#ffecc6` |
| 70% | `#4d3e22` | `#fff1d4` |
| 80% | `#332916` | `#fff5e2` |
| 90% | `#1a150b` | `#fffaf1` |

#### Plum `#403770`

| Step | Shades (darker) | Tints (lighter) |
|------|-----------------|-----------------|
| 10% | `#3a3265` | `#534b7e` |
| 20% | `#332c5a` | `#665f8d` |
| 30% | `#2d274e` | `#79739b` |
| 40% | `#262143` | `#8c87a9` |
| 50% | `#201c38` | `#a09bb8` |
| 60% | `#1a162d` | `#b3afc6` |
| 70% | `#131122` | `#c6c3d4` |
| 80% | `#0d0b16` | `#d9d7e2` |
| 90% | `#06060b` | `#ecebf1` |

#### Steel Blue `#6EA3BE`

| Step | Shades (darker) | Tints (lighter) |
|------|-----------------|-----------------|
| 10% | `#6393ab` | `#7dacc5` |
| 20% | `#588298` | `#8bb5cb` |
| 30% | `#4d7285` | `#9abfd2` |
| 40% | `#426272` | `#a8c8d8` |
| 50% | `#37525f` | `#b7d1df` |
| 60% | `#2c414c` | `#c5dae5` |
| 70% | `#213139` | `#d4e3ec` |
| 80% | `#162126` | `#e2edf2` |
| 90% | `#0b1013` | `#f1f6f9` |

#### Robin's Egg `#C4E7E6`

| Step | Shades (darker) | Tints (lighter) |
|------|-----------------|-----------------|
| 10% | `#b0d0cf` | `#cae9e9` |
| 20% | `#9db9b8` | `#d0eceb` |
| 30% | `#89a2a1` | `#d6eeee` |
| 40% | `#768b8a` | `#dcf1f0` |
| 50% | `#627473` | `#e2f3f3` |
| 60% | `#4e5c5c` | `#e7f5f5` |
| 70% | `#3b4545` | `#edf8f8` |
| 80% | `#272e2e` | `#f3fafa` |
| 90% | `#141717` | `#f9fdfd` |

#### Mint `#EDFFE3`

| Step | Shades (darker) | Tints (lighter) |
|------|-----------------|-----------------|
| 10% | `#d5e6cc` | `#efffe6` |
| 20% | `#beccb6` | `#f1ffe9` |
| 30% | `#a6b39f` | `#f2ffeb` |
| 40% | `#8e9988` | `#f4ffee` |
| 50% | `#778072` | `#f6fff1` |
| 60% | `#5f665b` | `#f8fff4` |
| 70% | `#474d44` | `#fafff7` |
| 80% | `#2f332d` | `#fbfff9` |
| 90% | `#181a17` | `#fdfffc` |

#### Off-white `#FFFCFA`

| Step | Shades (darker) | Tints (lighter) |
|------|-----------------|-----------------|
| 10% | `#e6e3e1` | `#fffcfb` |
| 20% | `#cccac8` | `#fffdfb` |
| 30% | `#b3b0af` | `#fffdfc` |

| 40% | `#999796` | `#fffdfc` |
| 50% | `#807e7d` | `#fffefd` |
| 60% | `#666564` | `#fffefd` |
| 70% | `#4d4c4b` | `#fffefe` |
| 80% | `#333232` | `#fffefe` |
| 90% | `#1a1919` | — |

### CSS Variables

```css
:root {
  --color-coral: #F37167;
  --color-plum: #403770;
  --color-golden: #FFCF70;
  --color-steel-blue: #6EA3BE;
  --color-robins-egg: #C4E7E6;
  --color-mint: #EDFFE3;
  --color-off-white: #FFFCFA;
}
```

## Typography

**Font Family:** Plus Jakarta Sans (Google Fonts)





```css
@import url('https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;700&display=swap');
```

### Weight Usage

| Weight | Use | CSS |
|--------|-----|-----|
| Bold (700) | Headlines, titles | `font-weight: 700` |
| Medium (500) | Subheaders, emphasis | `font-weight: 500` |
| Regular (400) | Body text | `font-weight: 400` |

### CSS Implementation

```css
body {
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 400;
  color: #403770;
}

h1, h2, h3 {
  font-weight: 700;
  color: #403770;
}



h4, h5, h6 {
  font-weight: 500;
}
```

## Logo

- Logo should always be **one color, one word**
- Provide sufficient clear space around logo
- **Never place Deep Coral logo on Plum background**

## The Dashed Line (Graphic Design Only)

The dashed line is Fullmind's signature graphic design element for marketing materials, presentations, and external communications. **Do not use dashed lines as UI elements in the product.**

- Dashed stroke style in Deep Coral or Steel Blue
- Flows through and around objects in marketing imagery
- Not applicable to product UI — use solid borders and standard dividers instead

## Icons

### Product Icons (UI)

- Keep simple and clean
- Prioritize legibility over decoration
- Single color preferred (Plum or gray)

## Buttons

```css
.btn-primary {
  background-color: #403770;
  color: white;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 500;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
}

.btn-secondary {
  background-color: transparent;
  color: #403770;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 500;
  padding: 12px 24px;
  border: 1px solid #403770;
  border-radius: 4px;
}
```

### Button Context Rules

- **Primary actions** (submit, save, create): Plum background (`bg-[#403770]`)
- **Secondary actions** (cancel, back): Plum outline or text-only with `hover:bg-gray-100`
- **Destructive actions** (delete): Red (`bg-red-500`), never brand colors
- **Never use Deep Coral or Golden for buttons** — warm colors are reserved for data signals

## Loading & Skeleton States

Use brand-tinted shimmer for loading placeholders:

```tsx
{/* Skeleton block */}
<div className="animate-pulse rounded bg-[#C4E7E6]/30 h-4 w-3/4" />

{/* Skeleton card */}
<div className="animate-pulse space-y-3 p-4 rounded-lg bg-[#FFFCFA]">
  <div className="h-4 bg-[#C4E7E6]/20 rounded w-2/3" />
  <div className="h-3 bg-[#C4E7E6]/15 rounded w-1/2" />
  <div className="h-3 bg-[#C4E7E6]/15 rounded w-5/6" />
</div>
```

Rules:
- Use Robin's Egg at 15–30% opacity for shimmer blocks
- Off-white (`#FFFCFA`) for skeleton card backgrounds
- Standard `animate-pulse` for animation

## Tooltips & Popovers

Light style — white background with shadow and Plum text:

```tsx
<div className="bg-white rounded-lg shadow-lg border border-gray-200 px-3 py-2 text-sm text-[#403770] max-w-xs">
  Tooltip content here
</div>
```

Rules:
- Background: `bg-white`
- Border: `border border-gray-200`
- Shadow: `shadow-lg`
- Text: `text-sm text-[#403770]`
- Max width: `max-w-xs` (adjust per context)
- Arrow/caret optional, match white background

## Spacing Scale

Standard spacing values for consistency across the product:

| Context | Value | Tailwind | Notes |
|---------|-------|----------|-------|
| Page padding | 24px | `p-6` | Main content area margins |
| Section gap | 24px | `gap-6` | Space between major sections |
| Card padding | 16px | `p-4` | Interior of cards and panels |
| Card gap | 16px | `gap-4` | Space between cards in a grid |
| Compact padding | 8px | `p-2` | Dense UI (table cells, chips) |
| Inline gap | 8px | `gap-2` | Space between inline elements |
| Tight gap | 4px | `gap-1` | Icon + label, badge groups |
| Form field gap | 12px | `gap-3` or `space-y-3` | Between form fields |
| Button padding | 12px × 24px | `px-6 py-3` | Standard buttons |
| Compact button padding | 8px × 12px | `px-3 py-2` | Table actions, inline buttons |

## Responsive Breakpoints

| Breakpoint | Width | Behavior |
|------------|-------|----------|
| `sm` | 640px | Stack mobile nav, single-column cards |
| `md` | 768px | Side panels collapse, tables scroll horizontally |
| `lg` | 1024px | Full layout — side panels visible, multi-column grids |
| `xl` | 1280px | Wider content areas, more table columns visible |

### Collapse rules

- **Right panel** (calendar, detail): visible at `lg+`, collapsed with toggle at `md`, hidden at `sm`
- **Sidebar navigation**: full at `lg+`, icon-only at `md`, hamburger menu at `sm`
- **Data tables**: full columns at `lg+`, priority columns only at `md`, horizontal scroll at `sm`
- **Card grids**: 3 columns at `lg`, 2 at `md`, 1 at `sm`
- **Form layouts**: side-by-side fields at `md+`, stacked at `sm`

## Component Patterns

### Data Tables

Standard styling for CRM-style data tables. See `Docs/components/tables.md` for full implementation details.

**Wrapper:**
- `border border-gray-200 rounded-lg bg-white shadow-sm`
- `overflow-hidden` + `overflow-x-auto` for horizontal scroll

**Header (`<thead>`):**
- Background: `bg-gray-50/80`
- Font: `text-[11px] font-semibold text-gray-500 uppercase tracking-wider`
- Padding: `px-4 py-3`

**Rows (`<tbody>`):**
- No `divide-y` — use conditional `border-b border-gray-100` except last row
- `group` class on `<tr>` for hover-reveal actions
- Hover: `hover:bg-gray-50/70` with `transition-colors duration-100`

**Cell text sizing:**

| Content type | Class |
|---|---|
| Primary name/title | `text-sm font-medium text-[#403770]` |
| Standard data | `text-[13px] text-gray-600` |
| Secondary/muted | `text-[13px] text-gray-400` |
| Empty placeholder | `text-[13px] text-gray-300` with `—` |

**Actions column (hover-reveal icons):**
- `opacity-0 group-hover:opacity-100 transition-opacity duration-150`
- Icon buttons: `p-1.5 text-gray-400 rounded-md`, icon size `w-3.5 h-3.5`
- Edit hover: `hover:text-[#403770] hover:bg-gray-100`
- Delete hover: `hover:text-red-500 hover:bg-red-50`

**Footer:**
- `bg-gray-50/60 border-t border-gray-100`
- Text: `text-[12px] font-medium text-gray-400 tracking-wide`

**Checkbox selection:**
- Checkbox: `w-4 h-4 rounded border-gray-300 text-[#403770] focus:ring-[#403770]/30`
- Selected row: `bg-[#C4E7E6]/15 hover:bg-[#C4E7E6]/25`

**Inline editing:**
- Use `InlineEditCell` component (`src/components/common/InlineEditCell.tsx`)
- Focus ring: `focus:ring-[#403770]`
- Mint flash on successful save

### Calendar

Acuity-style week calendar view. See `Docs/components/calendar.md` for full implementation details.

**Layout:** Two-panel — week grid (left, flex-1) + collapsible right panel (280px fixed).

**Header:**
- `bg-white` with `border-b border-gray-200`
- Nav arrows: `p-1.5`, icon `w-5 h-5`, `text-gray-400 hover:text-[#403770]`
- TODAY button: `text-sm font-semibold tracking-wide uppercase`, Plum text
- Week title: `text-lg font-bold text-[#403770]`

**Day columns:**
- Day name: `text-xs font-semibold text-gray-400 uppercase tracking-wider`
- Date number: `w-7 h-7 text-sm font-medium rounded-full`
- Today's date: `bg-[#403770] text-white` (Plum circle)
- Today's column: `bg-[#EDFFE3]/30` (Mint at 30%)
- Normal column hover: `hover:bg-[#C4E7E6]/10` (Robin's Egg at 10%)

**Event chips:**
- Left border: `3px solid` in status color
- Text: `text-xs`, title `font-medium text-gray-700`
- Type label: `text-[10px] text-gray-400 uppercase tracking-wide`

**Status colors:**

| Status | Border | Background |
|---|---|---|
| Planned | `#6EA3BE` (Steel Blue) | light blue tint |
| Completed | `#8AA891` (Sage) | light green tint |
| Cancelled | `#9CA3AF` (Gray) | light gray tint |

**Mini-month calendar (right panel):**
- Today: `bg-[#403770] text-white font-bold` (Plum circle)
- Active week: `bg-[#C4E7E6] text-[#403770] font-medium`
- Normal: `text-[#403770] hover:bg-gray-100`
- Out-of-month: `text-gray-300`

**Quick-add form:**
- `shadow-xl border border-gray-200 rounded-lg p-3`
- Date label: `text-[10px] font-medium text-gray-400 uppercase tracking-wider`
- Inputs: `border-gray-300 rounded-md`, focus ring `focus:ring-[#403770]`
- Submit: Plum background

**Badges (panel toggle, unscheduled count):**
- Soft style: `text-[10px] font-bold rounded-full bg-[#403770]/10 text-[#403770]`

### Confirmation Modals

```tsx
<div className="fixed inset-0 z-50 flex items-center justify-center">
  <div className="absolute inset-0 bg-black/50" onClick={onCancel} />
  <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
    <h3 className="text-lg font-semibold text-[#403770] mb-2">Title</h3>
    <p className="text-gray-600 text-sm mb-6">Description text.</p>
    <div className="flex justify-end gap-3">
      <button className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg">
        Cancel
      </button>
      <button className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg">
        Confirm
      </button>
    </div>
  </div>
</div>
```

### Empty States

- Centered layout with `py-12`
- Icon: `w-16 h-16 mx-auto text-gray-300 mb-4`
- Title: `text-lg font-medium text-gray-600 mb-2`
- Description: `text-sm text-gray-500 max-w-sm mx-auto`

## Tailwind CSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        coral: '#F37167',
        plum: '#403770',
        golden: '#FFCF70',
        'steel-blue': '#6EA3BE',
        'robins-egg': '#C4E7E6',
        mint: '#EDFFE3',
        'off-white': '#FFFCFA',
      },
      fontFamily: {
        sans: ['Plus Jakarta Sans', 'sans-serif'],
      },
    },
  },
}
```

## Quick Reference

| Element | Color | Weight |
|---------|-------|--------|
| Page background | Off-white `#FFFCFA` | — |
| Body text | Plum `#403770` | Regular |
| Headlines | Plum `#403770` | Bold |
| Primary buttons | Plum `#403770` | Medium |
| Negative signals | Deep Coral `#F37167` | — |
| Caution signals | Golden `#FFCF70` | — |
| Neutral / baseline data | Steel Blue `#6EA3BE` | — |
| Positive signals / success | Mint `#EDFFE3` shades | — |
| Selection / active | Robin's Egg `#C4E7E6` | — |
| Card backgrounds | Robin's Egg `#C4E7E6` | — |
| Table headers | `text-[11px] gray-500 uppercase` | Semibold |
| Table cell text | `text-[13px] gray-600` | Regular |
| Skeleton shimmer | Robin's Egg at 15–30% | — |
| Tooltips | White bg, Plum text | Regular |

## Brand Voice

- Approachable and warm
- Professional but not sterile
- Focused on extending school capacity
- Emphasizes partnership with schools (not replacement)
