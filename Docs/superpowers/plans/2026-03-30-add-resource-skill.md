# Add Resource Skill — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a `/add-resource` Claude Code skill that turns source material into branded resource pages in the Mapomatic Resources tab.

**Architecture:** Single SKILL.md file in `.claude/skills/add-resource/` that orchestrates a 5-step adaptive intake flow (ingest → propose → infrastructure check → delegate to /frontend-design → register). The skill handles both the wiki infrastructure bootstrap and individual page creation.

**Tech Stack:** Claude Code skill (Markdown), references existing `/frontend-design` skill for component building.

**Spec:** `docs/superpowers/specs/2026-03-30-add-resource-skill-design.md`

---

### Task 1: Create the add-resource skill file

**Files:**
- Create: `.claude/skills/add-resource/SKILL.md`

- [ ] **Step 1: Create the skill directory**

```bash
mkdir -p .claude/skills/add-resource
```

- [ ] **Step 2: Write the SKILL.md file**

Create `.claude/skills/add-resource/SKILL.md` with the full skill content:

```markdown
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

```
Grep ResourcesView.tsx for "RESOURCE_PAGES"
```

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
     component: React.ComponentType;
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

   Use the `/frontend-design` skill to build this layout with full brand compliance. Read `Documentation/UI Framework/tokens.md` first.

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
- [Specific UI patterns to use: accordions, card grids, timelines, tables, steppers, etc.]
- [Color accent suggestions using brand palette]
- [Any interactive elements: expandable sections, tabs within the page, etc.]
- Full brand compliance per Documentation/UI Framework/tokens.md

### Source Material
[Include the key extracted content that should appear on the page. Do not just reference the source — include the actual text, lists, frameworks, etc. that the page should contain.]
```

**IMPORTANT:** The Content Sections must include the actual content from the source material, not just descriptions. The `/frontend-design` skill needs the real text to build the page.

After writing the brief, invoke the `/frontend-design` skill to build the component. Pass the brief as context. The component should:
- Be a React component in `src/features/shared/components/views/resources/[Name]Page.tsx`
- Use `"use client"` directive
- Accept no props (content is baked in)
- Follow Fullmind brand tokens
- Be fully self-contained (no API calls — content is static)

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

3. **Verify** — run the dev server and confirm no build errors:
   ```bash
   npm run dev
   ```
   Check that the page appears in the Resources tab sidebar and renders correctly.

## Resource Categories

Use these predefined categories when proposing in Step 2:

| Category | For | Examples |
|----------|-----|----------|
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
```

- [ ] **Step 3: Verify skill is recognized**

Run a quick check that the file exists and has valid frontmatter:

```bash
head -5 .claude/skills/add-resource/SKILL.md
```

Expected output:
```
---
name: add-resource
description: Use when adding resource pages to the Mapomatic Resources tab. Ingests source material (PDFs, URLs, decks, notes), proposes a content plan, builds wiki infrastructure if needed, then delegates to /frontend-design for branded page implementation.
---
```

- [ ] **Step 4: Commit**

```bash
git add .claude/skills/add-resource/SKILL.md
git commit -m "feat: add /add-resource skill for creating resource wiki pages"
```

---

### Task 2: Commit the design spec

**Files:**
- Already created: `docs/superpowers/specs/2026-03-30-add-resource-skill-design.md`

- [ ] **Step 1: Stage and commit the spec**

```bash
git add docs/superpowers/specs/2026-03-30-add-resource-skill-design.md
git commit -m "docs: add design spec for /add-resource skill"
```

---

### Task 3: Verify end-to-end with a dry run

This task validates the skill works by mentally walking through the Deal Qualifying PDF example. No code changes — just verification.

- [ ] **Step 1: Confirm skill appears in skill list**

The skill should appear when Claude Code lists available skills. Invoke `/add-resource` and verify it loads the SKILL.md content.

- [ ] **Step 2: Verify referenced files exist**

Check that all files the skill references are present:

```bash
ls src/features/shared/components/views/ResourcesView.tsx
ls Documentation/UI\ Framework/tokens.md
ls .claude/skills/frontend-design/SKILL.md
```

All three should exist.

- [ ] **Step 3: Verify infrastructure detection logic**

The skill says to grep for `RESOURCE_PAGES` in ResourcesView.tsx. Confirm it's NOT there yet (so infrastructure step would trigger):

```bash
grep "RESOURCE_PAGES" src/features/shared/components/views/ResourcesView.tsx
```

Expected: no match (the current file has `RESOURCES` not `RESOURCE_PAGES`).

- [ ] **Step 4: Confirm complete**

The skill is ready to use. The first invocation of `/add-resource` will:
1. Ingest the source material
2. Propose a content plan
3. Build the wiki infrastructure (since `RESOURCE_PAGES` doesn't exist yet)
4. Generate a brief and delegate to `/frontend-design`
5. Register the page and verify
