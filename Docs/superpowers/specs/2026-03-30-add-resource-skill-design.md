# Add Resource Skill — Design Spec

**Date:** 2026-03-30
**Status:** Approved

## Overview

A Claude Code skill (`/add-resource`) that turns source material (PDFs, URLs, slide decks, raw notes) into branded resource pages in the Mapomatic Resources tab. Uses an adaptive intake flow that adjusts depth based on source complexity, then delegates component implementation to `/frontend-design`.

## Skill Identity

- **Name:** `add-resource`
- **Location:** `.claude/skills/add-resource/SKILL.md`
- **Trigger:** When user wants to add a resource page — e.g., "add this PDF as a resource", "create a resource page for...", `/add-resource /path/to/file.pdf`
- **Invocation:** `/add-resource` with optional file path or URL argument

## Adaptive Intake Flow

```
User invokes /add-resource [optional source]
        │
        ▼
   ┌─ INGEST ─────────────────────────────────┐
   │ Read source (PDF, URL, notes, or ask)     │
   │ Analyze: content type, length, complexity  │
   └───────────────┬───────────────────────────┘
                   ▼
   ┌─ PROPOSE ─────────────────────────────────┐
   │ Present to user:                           │
   │  • Proposed title & category               │
   │  • Content summary (key sections found)    │
   │  • Recommended treatment level:            │
   │    - Faithful (mirror source structure)     │
   │    - Restructured (reorganize for web)     │
   │    - Reimagined (interactive/scannable)    │
   │  • Suggested page structure                │
   │                                            │
   │ User confirms or adjusts                   │
   └───────────────┬───────────────────────────┘
                   ▼
   ┌─ INFRASTRUCTURE CHECK ────────────────────┐
   │ Does ResourcesView have the wiki layout?   │
   │  No → Build two-column layout + registry   │
   │  Yes → Skip                                │
   └───────────────┬───────────────────────────┘
                   ▼
   ┌─ DELEGATE ────────────────────────────────┐
   │ Generate structured brief with:            │
   │  • Page title, category, slug              │
   │  • Content sections (headings + body)      │
   │  • Visual treatment notes                  │
   │  • Component file path                     │
   │                                            │
   │ Invoke /frontend-design to build the       │
   │ component                                  │
   └───────────────┬───────────────────────────┘
                   ▼
   ┌─ REGISTER ────────────────────────────────┐
   │ Add page to RESOURCE_PAGES registry        │
   │ Verify import + rendering                  │
   └───────────────────────────────────────────┘
```

## Step Details

### 1. Ingest

Read the source material based on type:
- **PDF:** Use the Read tool with `pages` parameter. For large PDFs, read in chunks (pages 1-10, then 11-20, etc.)
- **URL:** Use WebFetch to retrieve the page content
- **File path:** Read the file directly
- **No source provided:** Ask the user what content they want to turn into a resource page
- **Verbal/notes:** User describes the content in chat; Claude structures it

After reading, analyze:
- What type of content is this? (training, methodology, reference, report, template)
- How complex is the structure? (simple prose vs. multi-section framework)
- How long is the content? (single page vs. multi-section)

### 2. Propose

Present a summary to the user for confirmation:

```
## Resource Page Proposal

**Title:** [proposed title]
**Category:** [proposed category from list]
**Treatment:** [Faithful | Restructured | Reimagined]

### Why this treatment:
[1-2 sentence rationale]

### Proposed sections:
1. [Section name] — [brief description]
2. [Section name] — [brief description]
...

Does this look right, or would you adjust anything?
```

The user confirms or adjusts. No further questions needed — move to infrastructure check.

### 3. Infrastructure Check

Grep `ResourcesView.tsx` for `RESOURCE_PAGES`. If not found:

**Build the two-column wiki layout:**

ResourcesView.tsx structure:
```
┌──────────────────────────────────────────────────────┐
│ Resources (header)                                    │
├──────────┬───────────────────────────────────────────┤
│          │                                           │
│ Category │  [Selected resource page content]         │
│  • Page  │                                           │
│  • Page  │                                           │
│          │                                           │
│ Category │                                           │
│  • Page  │                                           │
│          │                                           │
└──────────┴───────────────────────────────────────────┘
```

Layout specs (from existing resources-tab-design spec):
- Left sidebar: `w-56`, `bg-white`, `border-r border-[#E2DEEC]`, full height scroll
- Active link: `border-l-[3px] border-[#F37167] bg-[#fef1f0] text-[#F37167]`
- Inactive link: `border-l-[3px] border-transparent text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770]`
- Content area: `flex-1 overflow-y-auto`, `bg-off-white` (`#FFFCFA`), `px-6 py-6`
- Category headers: `text-xs font-semibold text-[#8A80A8] uppercase tracking-wider`

Registry pattern:
```tsx
const RESOURCE_PAGES = [
  { id: "deal-qualifying", label: "Deal Qualifying", category: "Sales Enablement", component: DealQualifyingPage },
] as const;
```

State: `activePageId` via local `useState`, defaults to first page in registry.

Create directory: `src/features/shared/components/views/resources/` for page components.

**What already exists (do NOT rebuild):**
- Sidebar tab entry with book icon — already in `MAIN_TABS`
- `TabId` type includes `"resources"` — already in `app-store.ts` and `Sidebar.tsx`
- `ResourcesView` is already imported and rendered for the resources tab

### 4. Generate Brief & Delegate

Produce a structured brief for `/frontend-design`:

```markdown
## Resource Page Brief

**Title:** [title]
**Slug:** [kebab-case-id]
**Category:** [category]
**File:** src/features/shared/components/views/resources/[PascalCaseName]Page.tsx

### Treatment
[Faithful | Restructured | Reimagined] — [description of approach]

### Content Sections
1. **[Section heading]** — [what goes here]
2. **[Section heading]** — [what goes here]
...

### Visual Treatment Notes
- [Specific UI suggestions: timelines, accordions, card grids, tables, etc.]
- [Color accent notes]
- Full brand compliance per Documentation/UI Framework/tokens.md

### Source Material
[Extracted content or path to source]
```

Then invoke `/frontend-design` to build the component. The brief provides all the context `/frontend-design` needs — content, structure, visual direction, and file location.

### 5. Register & Verify

After `/frontend-design` creates the component:

1. Import the component in `ResourcesView.tsx`
2. Add entry to `RESOURCE_PAGES` array:
   ```tsx
   { id: "[slug]", label: "[title]", category: "[category]", component: [ComponentName] },
   ```
3. Verify: run `npm run dev` and confirm no build errors

## Resource Categories

Predefined categories for grouping pages in the left sidebar:

| Category | Content Type | Examples |
|----------|-------------|----------|
| Sales Enablement | Deal frameworks, pitch guides, objection handling | Deal Qualifying (BANT/MEDPICC) |
| Training | Onboarding, methodology, how-tos | New rep onboarding guide |
| Tools & Templates | Reusable checklists, calculators, templates | Discovery call template |
| Product | Product docs, feature guides, competitive intel | Feature comparison matrix |
| Reports | Data-driven reference pages, analytics | ICP Scoring report |

The skill proposes a category from this list. If nothing fits, it suggests creating a new category — the user confirms.

## File Locations

```
.claude/skills/add-resource/SKILL.md                           — The skill itself
src/features/shared/components/views/ResourcesView.tsx          — Wiki layout + page registry
src/features/shared/components/views/resources/                 — Individual page components
src/features/shared/components/views/resources/[Name]Page.tsx   — Each resource page
```

## Token Compliance

All resource page UI follows `Documentation/UI Framework/tokens.md`. The skill delegates to `/frontend-design` which enforces brand compliance. Key tokens for the wiki layout:

| Element | Classes |
|---------|---------|
| Resource sidebar bg | `bg-white` |
| Sidebar border | `border-r border-[#E2DEEC]` |
| Active link | `border-l-[3px] border-[#F37167] bg-[#fef1f0] text-[#F37167]` |
| Inactive link | `text-[#6E6390]` |
| Inactive hover | `hover:bg-[#EFEDF5] hover:text-[#403770]` |
| Content area bg | `bg-off-white` (`#FFFCFA`) |
| Category header | `text-xs font-semibold text-[#8A80A8] uppercase tracking-wider` |
| Page title | `text-2xl font-bold text-[#403770]` |

## Example: Deal Qualifying 2025

To validate the skill design, here's how it would handle the Fullmind Deal Qualifying 2025 PDF:

**Ingest:** Read 18-page PDF. Detect: sales methodology training deck, multi-section, complex structure (two frameworks + pipeline stages).

**Propose:**
- Title: "Deal Qualifying 2025"
- Category: Sales Enablement
- Treatment: Restructured — reorganize slides into scannable web sections
- Sections: Overview, Pipeline Stages, BANT Framework, MEDPICC Framework, Stage Identification

**Infrastructure Check:** ResourcesView needs wiki layout → build it.

**Brief:** Generated with visual treatment notes — horizontal stepper for pipeline stages, expandable cards for BANT/MEDPICC, coral accents for framework letters.

**Delegate:** `/frontend-design` builds `DealQualifyingPage.tsx` with full brand compliance.

**Register:** Add to `RESOURCE_PAGES`, verify build.
