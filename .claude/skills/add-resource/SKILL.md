---
name: add-resource
description: Use when adding resource pages to the Mapomatic Resources tab. Ingests source material (PDFs, URLs, decks, notes), proposes a content plan, builds wiki infrastructure if needed, then delegates to /frontend-design for branded page implementation.
---

# Add Resource Page

Turn source material into branded, wiki-style resource pages in the Mapomatic Resources tab.

## When to Use

- User wants to add a resource page — "add this PDF as a resource", "create a resource page for..."
- User provides a file path, URL, or describes content for the Resources tab
- User says `/add-resource` with or without a source argument

## Process

Follow these steps in order. The process is adaptive — Step 2 adjusts depth based on source complexity.

### Step 1: Ingest Source Material

Read the source based on what the user provided:

| Source Type | How to Read |
|-------------|-------------|
| PDF | `Read` tool with `pages` parameter. For PDFs over 10 pages, read in chunks (1-10, 11-20, etc.) |
| URL | `WebFetch` to retrieve page content |
| File (markdown, text, etc.) | `Read` tool directly |
| No source provided | Ask the user: "What content should this resource page cover? You can provide a file path, URL, or describe it." |
| Verbal description | User describes content in chat — structure it from their description |

After reading, assess:
- **Content type:** training, methodology, reference, report, template, or tool
- **Structural complexity:** simple prose vs. multi-section framework vs. interactive content
- **Length:** single page vs. multi-section

### Step 2: Propose Content Plan

Present a proposal to the user for confirmation. Do NOT proceed without approval.

```
## Resource Page Proposal

**Title:** [proposed title]
**Category:** [one of: Sales Enablement, Training, Tools & Templates, Product, Reports — or suggest a new one]
**Treatment:** [Faithful | Restructured | Reimagined]

### Why this treatment:
[1-2 sentence rationale based on the source material]

### Proposed sections:
1. [Section name] — [brief description of what goes here]
2. [Section name] — [brief description]
...

Does this look right, or would you adjust anything?
```

**Treatment levels:**
- **Faithful** — mirror the source structure closely, just make it web-friendly. Best for: reference docs, templates, simple guides.
- **Restructured** — reorganize for web reading patterns. Collapse redundant sections, add scannable summaries, reorder for discoverability. Best for: slide decks, training materials, multi-page docs.
- **Reimagined** — transform into interactive/scannable web content. Turn lists into expandable cards, processes into steppers, frameworks into visual grids. Best for: methodologies, complex frameworks, process docs.

Wait for user confirmation before proceeding.

### Step 3: Infrastructure Check

Check whether the Resources tab wiki layout exists:

Use the Grep tool: pattern `RESOURCE_PAGES`, path `src/features/shared/components/views/ResourcesView.tsx`

**Path:** `src/features/shared/components/views/ResourcesView.tsx`

**If `RESOURCE_PAGES` is NOT found** — the wiki infrastructure needs to be built first:

1. Create the resource pages directory:
   ```bash
   mkdir -p src/features/shared/components/views/resources
   ```

2. Refactor `ResourcesView.tsx` into a two-column wiki layout:

   **Layout structure:**
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

   **Key specs:**
   - Left sidebar: `w-56 flex-shrink-0 bg-white border-r border-[#E2DEEC] h-full overflow-y-auto`
   - Active link: `border-l-[3px] border-[#F37167] bg-[#fef1f0] text-[#F37167]`
   - Inactive link: `border-l-[3px] border-transparent text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770]`
   - Content area: `flex-1 overflow-y-auto bg-[#FFFCFA] px-6 py-6`
   - Category headers: `text-xs font-semibold text-[#8A80A8] uppercase tracking-wider`
   - Page links: `block px-4 py-2.5 text-sm font-medium transition-colors duration-100`

   **Registry pattern:**
   ```tsx
   interface ResourcePage {
     id: string;
     label: string;
     category: string;
     component: React.FC;
   }

   const RESOURCE_PAGES: ResourcePage[] = [
     // Pages added here by /add-resource skill
   ];
   ```

   **State:** `activePageId` via `useState`, defaults to first page in registry.

   **Category grouping:** Derive categories from `RESOURCE_PAGES` using `[...new Set(pages.map(p => p.category))]`, render grouped page links in sidebar.

   **Do NOT rebuild** (these already exist):
   - Sidebar tab entry (book icon in `MAIN_TABS`)
   - `TabId` type (includes `"resources"`)
   - `ResourcesView` import in `page.tsx`

   Use the `/frontend-design` skill to build this layout with full brand compliance. Read `Documentation/UI Framework/tokens.md` first. **After `/frontend-design` completes, return here and continue with Step 4.**

**If `RESOURCE_PAGES` IS found** — skip to Step 4.

### Step 4: Generate Brief & Delegate to /frontend-design

Generate a structured brief, then invoke the `/frontend-design` skill to build the page component.

**Brief format:**

```markdown
## Resource Page Brief

**Title:** [title from Step 2]
**Slug:** [kebab-case-id, e.g., "deal-qualifying"]
**Category:** [category from Step 2]
**File:** src/features/shared/components/views/resources/[PascalCaseName]Page.tsx

### Treatment
[Treatment level from Step 2] — [description of approach]

### Content Sections
1. **[Section heading]** — [full content for this section, extracted/restructured from source]
2. **[Section heading]** — [full content]
...

### Visual Treatment Notes
[See required page structure below — then add section-specific notes]

### Source Material
[Include the key extracted content that should appear on the page. Do not just reference the source — include the actual text, lists, frameworks, etc. that the page should contain.]
```

**IMPORTANT:** The Content Sections must include the actual content from the source material, not just descriptions. The `/frontend-design` skill needs the real text to build the page.

#### Required Page Structure — Wiki Format

Every resource page MUST follow this structure. Reference `src/features/shared/components/views/resources/UnderstandingLeaderboardPage.tsx` as the canonical example.

**Layout:**
```
┌──────────────────────────────────────────────────────────┐
│  [flex gap-10]                                            │
│                                                          │
│  ┌─────────┐  ┌──────────────────────────────────────┐   │
│  │ Sticky   │  │  Hero (icon + title + subtitle)      │   │
│  │ TOC      │  │  Summary box (gradient bg)           │   │
│  │          │  │                                      │   │
│  │ On this  │  │  ── Section 1 ──────────────────     │   │
│  │ page:    │  │  Full inline content                 │   │
│  │ • Link   │  │  Cards, tables, callouts             │   │
│  │ • Link   │  │                                      │   │
│  │ • Link   │  │  ── divider ────────────────────     │   │
│  │          │  │                                      │   │
│  │          │  │  ── Section 2 ──────────────────     │   │
│  │          │  │  ...                                 │   │
│  └─────────┘  └──────────────────────────────────────┘   │
└──────────────────────────────────────────────────────────┘
```

**Required elements:**

1. **Sticky table of contents** (left side, `hidden xl:block w-44`):
   - "On this page" label: `text-[10px] font-semibold text-[#8A80A8] uppercase tracking-wider`
   - Anchor links: `text-xs text-[#6E6390] hover:text-[#403770] border-l-2 hover:border-[#F37167] pl-3`
   - Each section needs an `id` and `scroll-mt-6` for smooth anchor scrolling

2. **Hero header** with icon, title (`text-2xl font-bold`), and subtitle
   - Summary box below: `rounded-xl bg-gradient-to-r from-[#F7F5FA] to-[#EFEDF5] p-5 border border-[#E2DEEC]`

3. **Inline sections** (NOT accordions) — all content visible, separated by `border-t border-[#E2DEEC] mb-12` dividers
   - Section headings: `text-lg font-bold text-[#403770]` with a Lucide icon
   - Body text: `text-sm text-[#6E6390] leading-relaxed`
   - Content fills the page width (`flex-1 min-w-0 max-w-4xl`)

4. **Visual elements** to break up text — choose from:
   - **Card grids** (2-col or 3-col) with icon + title + description for concepts, features, tabs
   - **Data tables** with `rounded-xl` borders, `bg-[#F7F5FA]` headers, alternating row tints
   - **Callout boxes** — info: `bg-[#e8f1f5] border-[#8bb5cb]`, warning: `bg-[#FFF8EE] border-[#ffd98d]`, tip: `border-l-4 border-[#F37167]`
   - **Flow diagrams** using inline flex with arrow icons between steps
   - **Stacked progression** for ranked/tiered content with colored backgrounds per tier
   - **Tip cards** with coral left border: `border-l-4 border-[#F37167] bg-white border border-[#E2DEEC] rounded-xl px-5 py-4`

5. **FAQ section** (if applicable) — expandable items inside a bordered container. This is the ONE section that uses expand/collapse; everything else is inline.

**Do NOT use:**
- Accordion/collapsible sections for main content (all sections should be open/visible)
- `max-w-3xl` or other narrow constraints — pages should fill the content area
- Generic Tailwind grays — use plum-derived neutrals only

After writing the brief, invoke the `/frontend-design` skill to build the component. Pass the brief as context. **After `/frontend-design` completes, return here and continue with Step 5.** The component should:
- Be a React component in `src/features/shared/components/views/resources/[Name]Page.tsx`
- Use `"use client"` directive
- Accept no props (content is baked in)
- Follow Fullmind brand tokens
- Be fully self-contained (no API calls — content is static)
- Follow the wiki page structure above

### Step 5: Register & Verify

After `/frontend-design` creates the page component:

1. **Import** the component in `ResourcesView.tsx`:
   ```tsx
   import [ComponentName] from "./resources/[ComponentName]";
   ```

2. **Add to registry** — add an entry to `RESOURCE_PAGES`:
   ```tsx
   { id: "[slug]", label: "[title]", category: "[category]", component: [ComponentName] },
   ```

3. **Verify** — check for TypeScript errors:
   ```bash
   npx tsc --noEmit
   ```
   If clean, start the dev server (`npm run dev`) and confirm the page appears in the Resources tab sidebar and renders correctly.

## Resource Categories

Use these predefined categories when proposing in Step 2:

| Category | For | Examples |
|----------|-----|---------|
| Sales Enablement | Deal frameworks, pitch guides, objection handling | Deal Qualifying (BANT/MEDPICC), Pitch Deck Guide |
| Training | Onboarding, methodology, how-tos | New Rep Onboarding, Product Training |
| Tools & Templates | Reusable checklists, calculators, templates | Discovery Call Template, ROI Calculator |
| Product | Product docs, feature guides, competitive intel | Feature Comparison, Product FAQ |
| Reports | Data-driven pages, analytics, scoring | ICP Scoring Report |

If nothing fits, suggest a new category and confirm with the user.

## File Locations

```
.claude/skills/add-resource/SKILL.md                           — This skill
src/features/shared/components/views/ResourcesView.tsx          — Wiki layout + page registry
src/features/shared/components/views/resources/                 — Individual page components
src/features/shared/components/views/resources/[Name]Page.tsx   — Each resource page
```

## Key References

- Design spec: `docs/superpowers/specs/2026-03-30-add-resource-skill-design.md`
- Brand tokens: `Documentation/UI Framework/tokens.md`
- Frontend design skill: `.claude/skills/frontend-design/SKILL.md`
- Existing ResourcesView: `src/features/shared/components/views/ResourcesView.tsx`
