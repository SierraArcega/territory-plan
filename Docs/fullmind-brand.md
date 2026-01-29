---
name: fullmind-brand
description: Fullmind brand guidelines for creating on-brand designs, websites, presentations, and marketing materials. Use when creating any visual content for Fullmind including web pages, documents, slides, graphics, or UI components. Covers colors, typography, logo usage, icons, photography style, and the signature dashed line element.
---

# Fullmind Brand Guide

Fullmind is a remote learning company that extends the capacity of schools. The brand is colorful, approachable, and energetic.

## Brand Colors

### Primary Colors (Required)

| Color | Hex | RGB | Use |
|-------|-----|-----|-----|
| Deep Coral | `#F37167` | 243, 113, 103 | Primary accent, buttons, headlines |
| Plum | `#403770` | 64, 55, 112 | Primary text, headers, contrast |

### Secondary Colors (For dimension)

| Color | Hex | RGB | Use |
|-------|-----|-----|-----|
| Steel Blue | `#6EA3BE` | 110, 163, 190 | Accents, dashed lines |
| Robin's Egg | `#C4E7E6` | 196, 231, 230 | Backgrounds, cards |
| Mint | `#EDFFE3` | 235, 245, 230 | Light backgrounds |
| Off-white | `#FFFCFA` | 255, 253, 248 | Page backgrounds |

### Color Rules

- Always use Deep Coral and Plum in designs
- Use off-white backgrounds to keep brand approachable (never stark white)
- **Never place Deep Coral text/elements on Plum background**

### CSS Variables

```css
:root {
  --color-coral: #F37167;
  --color-plum: #403770;
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

## The Dashed Line

Fullmind's signature element—dynamic dashed lines that add energy and originality.

### Characteristics

- Dashed stroke style
- Colors: Deep Coral (`#F37167`) or Steel Blue (`#6EA3BE`)
- Flows through and around objects (laptops, books, pens, papers)
- Creates sense of movement and learning expansion

### CSS Implementation

```css
.fullmind-line {
  border: none;
  border-top: 3px dashed #F37167;
}

.fullmind-line-blue {
  border-top: 3px dashed #6EA3BE;
}
```

### SVG Path Example

```svg
<svg viewBox="0 0 200 50">
  <path 
    d="M0,25 Q50,0 100,25 T200,25" 
    fill="none" 
    stroke="#F37167" 
    stroke-width="3" 
    stroke-dasharray="10,6"
  />
</svg>
```

## Icons

### Illustrated Icons (Marketing)

- Size: 300 × 300 pixels
- Stroke: 8pt weight
- Colors: 2 colors for subtle dimension
- Use in marketing materials for services and value propositions

### Product Icons (UI)

- Keep simple and clean
- Prioritize legibility over decoration
- Single color preferred

## Photography

### Selection Criteria

1. **Motion over posed** — Choose subjects actively engaged, not static
2. **No direct eye contact** — Avoid subjects looking at camera
3. **School atmosphere** — Show school/library settings, not just home + laptop

### On-Brand Treatment

Add the signature dashed line overlay to stock photos:
- Lines weave through and around objects
- Use Deep Coral or Steel Blue
- Creates cohesive brand look from generic stock

## Buttons

```css
.btn-primary {
  background-color: #F37167;
  color: white;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 500;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
}

.btn-secondary {
  background-color: #403770;
  color: white;
  font-family: 'Plus Jakarta Sans', sans-serif;
  font-weight: 500;
  padding: 12px 24px;
  border: none;
  border-radius: 4px;
}
```

## Web Layout Patterns

### Hero Section

- Off-white or Mint background
- Large headline in Plum (Bold)
- Deep Coral CTA button
- Photo with dashed line accent

### Cards

- Robin's Egg or white background
- Plum headlines
- Deep Coral for links/accents
- Optional dashed line underline

### Section Headers

- Deep Coral for section titles
- Dashed line accent beneath

## Tailwind CSS Configuration

```javascript
// tailwind.config.js
module.exports = {
  theme: {
    extend: {
      colors: {
        coral: '#F37167',
        plum: '#403770',
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
| Section titles | Deep Coral `#F37167` | Bold |
| Primary buttons | Deep Coral `#F37167` | Medium |
| Secondary buttons | Plum `#403770` | Medium |
| Accent lines | Deep Coral or Steel Blue | Dashed |
| Card backgrounds | Robin's Egg `#C4E7E6` | — |

## Brand Voice

- Approachable and warm
- Professional but not sterile
- Focused on extending school capacity
- Emphasizes partnership with schools (not replacement)
