# Forms Component Guide Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Create a comprehensive forms documentation guide and Paper artboard that standardizes form implementation across the Fullmind territory planner.

**Architecture:** Two deliverables — a markdown guide (`forms.md`) following the same structure as the existing `tables.md`, and a Paper artboard showing canonical form states and layouts. The guide documents three form types (Modal, Panel, Inline), defines canonical token-aligned styling, and recommends shared primitives.

**Tech Stack:** Markdown documentation, Paper MCP (for artboard)

**Spec:** `docs/superpowers/specs/2026-03-11-forms-component-guide-design.md`
**Tokens reference:** `Documentation/UI Framework/tokens.md`
**Format reference:** `Documentation/UI Framework/Components/tables.md`

---

## Chunk 1: Forms Documentation Guide

### Task 1: Create forms.md — Header, Form Types, and Shared Foundations

**Files:**
- Create: `Documentation/UI Framework/Components/forms.md`

- [ ] **Step 1: Write the opening sections**

Create the file with the document header, three form type definitions, and shared foundations. Follow the same structure as `tables.md` (overview → types → shared foundations).

The header should match `tables.md` line 1-4 format:
```markdown
# Form Component Guide

Standard styling for all forms in the territory planner. Three form types cover every use case. All patterns use the Fullmind design token system (`tokens.md`).
```

Form types section should define each type with:
- Name and description
- **Use when:** guidance
- **Features:** list
- **Examples in codebase:** file names

Three types to document:

**Modal Forms** — Full-screen overlay dialogs for creating/editing entities.
- Use when: Creating or editing a record that needs focused attention and has multiple fields
- Features: Backdrop overlay, scrollable body, sticky header/footer, Cancel + Submit actions
- Examples: TaskFormModal, GoalFormModal, GoalEditorModal, PlanFormModal, ActivityFormModal, OutcomeModal, DistrictTargetEditor

**Panel Forms** — Embedded in sidebar panels on the map view.
- Use when: Creating or editing within the map context without leaving the current view
- Features: Back button header, tighter spacing, full-width submit, optional field toggle
- Examples: AccountForm, PlanEditForm, TaskForm (right panel), ActivityForm (right panel), PlanFormPanel

**Inline Editing** — Click-to-edit cells and card sections.
- Use when: Quick edits to a single value within a table row, card, or content block
- Features: Display-to-edit toggle, save on blur/Enter, Escape to cancel, success flash, quick-add variant
- Examples: InlineEditCell, QuickAddTask, NotesEditor

Shared Foundations section should cover the canonical input styling. Include:
- The canonical Tailwind class string for inputs
- States table (Default, Focus, Error, Error+Focus, Disabled) with token names, hex values, and Tailwind classes
- All input types: text, email, URL, tel, number, date, password, select, textarea, checkbox, toggle/switch, currency-prefixed

- [ ] **Step 2: Verify the file renders correctly**

Open `Documentation/UI Framework/Components/forms.md` and confirm:
- Markdown tables render properly (pipe alignment)
- Code blocks have correct language tags
- Structure matches `tables.md` pattern

- [ ] **Step 3: Commit**

```bash
git add "Documentation/UI Framework/Components/forms.md"
git commit -m "docs: add forms.md with types and shared foundations"
```

---

### Task 2: Add Label Convention, Layout Rules, and Validation sections

**Files:**
- Modify: `Documentation/UI Framework/Components/forms.md`

- [ ] **Step 1: Add Label Convention section**

Append after Shared Foundations. Document:
- Position: Always stacked (label above input)
- Typography: `text-xs font-medium` (Caption tier, 12px, weight 500)
- Color: Secondary `#8A80A8` → Tailwind `text-[#8A80A8]`
- Spacing: `mb-1` between label and input
- Required marker: `*` in Coral `#F37167` after label text → `text-[#F37167]`
- Disabled state: label color changes to Muted `#A69DC0`
- Error state: label color changes to Semantic Error `#f58d85`
- Accessibility: always use `<label>` with `htmlFor` wired to input `id`
- Note: use `font-semibold` only for section headings, not field labels

Include a code example:
```tsx
<label htmlFor="plan-name" className="block text-xs font-medium text-[#8A80A8] mb-1">
  Plan Name <span className="text-[#F37167]">*</span>
</label>
```

- [ ] **Step 2: Add Layout Rules section**

Document:

Field Spacing:
- Between fields within a section: `space-y-4`
- Between sections: `space-y-6`
- Panel forms (compact): `space-y-3` within sections

Field Width:
- Single column by default — inputs span full width
- Side-by-side for related pairs: `grid grid-cols-2 gap-3` (Start/End date, Status/Priority)
- Custom grid for address rows: `grid grid-cols-[1fr_60px_80px] gap-2`

Form Sections:
- Section heading: `text-xs font-semibold text-[#8A80A8] uppercase tracking-wider`
- Collapsible sections: border wrapper with chevron toggle
- Optional fields: "Show/Hide optional fields" toggle pattern

- [ ] **Step 3: Add Validation section**

Document:

Timing:
- Validate on blur, not real-time
- Submit button always active by default
- Errors display after first submit attempt or on field blur

Field-Level Errors:
- Error message: `text-xs text-[#F37167] mt-1` below input
- Input border: `border-[#f58d85]`
- Input background: `bg-[#fef1f0]`
- Label color: `text-[#f58d85]`

Form-Level Errors:
- Banner: `p-3 bg-[#fef1f0] border border-[#f58d85] rounded-lg text-sm text-[#F37167]`
- Position: above form fields
- Use for: server-side errors, cross-field validation

Help Text:
- Style: `text-xs text-[#A69DC0] mt-1`
- Position: below input (or below error message when both present)

Include code examples for error state and form-level error banner.

- [ ] **Step 4: Commit**

```bash
git add "Documentation/UI Framework/Components/forms.md"
git commit -m "docs: add labels, layout rules, and validation to forms.md"
```

---

### Task 3: Add Form Type Patterns (Modal, Panel, Inline) sections

**Files:**
- Modify: `Documentation/UI Framework/Components/forms.md`

- [ ] **Step 1: Add Modal Form Pattern section**

Document the canonical modal structure with exact classes. Reference the spec for all values:

Structure:
- Backdrop: `fixed inset-0 z-50 bg-[#403770]/40`
- Container: `bg-white rounded-2xl shadow-xl w-full max-w-md mx-4 max-h-[85vh] flex flex-col`
- Header: `px-6 py-4 border-b border-[#D4CFE2]` — title `text-lg font-bold text-[#403770]` + close button
- Body: `flex-1 overflow-y-auto px-6 py-4 space-y-4`
- Footer: `px-6 py-4 border-t border-[#D4CFE2] bg-[#F7F5FA]`

Buttons:
- Submit: `px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] disabled:opacity-50`
- Cancel: `px-4 py-2 text-sm font-medium text-[#6E6390] hover:text-[#403770]`
- Destructive: `bg-[#F37167] hover:bg-[#e05f55]`
- Pending: text changes to "Creating..." / "Saving..."

Include a complete JSX skeleton showing the full modal form layout.

- [ ] **Step 2: Add Panel Form Pattern section**

Document:
- Header: `px-3 py-2.5 border-b border-[#E2DEEC]` with back button and uppercase title
- Body: `flex-1 p-3 space-y-4 overflow-y-auto`
- Submit: `w-full py-2.5 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#403770]/90`
- No sticky footer — submit scrolls with content
- Optional fields toggle pattern

Include a JSX skeleton.

- [ ] **Step 3: Add Inline Editing Pattern section**

Document:
- Display mode: `cursor-pointer px-1.5 py-0.5 rounded hover:bg-[#C4E7E6]/30`
- Edit mode: `border border-[#C2BBD4] ring-2 ring-[#403770]` (plum ring for inline context)
- Save behaviors: blur/Enter for text/date, Ctrl+Enter for textarea, auto-save for select
- Cancel: Escape key
- Success flash: `bg-[#F7FFF2]` (Semantic Success bg)
- Quick-add variant: single-field create, Enter to save
- Click-to-edit card variant: display-to-edit toggle within a card

Include keyboard interaction table and JSX examples.

- [ ] **Step 4: Commit**

```bash
git add "Documentation/UI Framework/Components/forms.md"
git commit -m "docs: add modal, panel, and inline form patterns to forms.md"
```

---

### Task 4: Add Shared Primitives, Discrepancies, and File Reference sections

**Files:**
- Modify: `Documentation/UI Framework/Components/forms.md`

- [ ] **Step 1: Add Shared Primitives section**

Document the three recommended components with their interfaces and responsibilities. Mark as "Recommended" not "Required". Specify location as `src/features/shared/components/forms/`.

FormField:
```tsx
interface FormFieldProps {
  label: string;
  htmlFor: string;
  required?: boolean;
  error?: string;
  helpText?: string;
  disabled?: boolean;
  children: React.ReactNode;
}
```
- Renders label with correct styling and required marker
- Renders error message below input when present
- Renders help text: `text-xs text-[#A69DC0] mt-1`
- Applies error/disabled label color changes

FormSection:
```tsx
interface FormSectionProps {
  title?: string;
  children: React.ReactNode;
  compact?: boolean;
}
```

FormActions:
```tsx
interface FormActionsProps {
  onCancel: () => void;
  onSubmit?: () => void;
  submitLabel?: string;
  cancelLabel?: string;
  isPending?: boolean;
  disabled?: boolean;
  variant?: "modal" | "panel";
}
```

- [ ] **Step 2: Add Migration Guide / Discrepancies section**

Add the full discrepancy table from the spec with all 21 rows, including the "Found In" column. Title it "Migration Guide" with a note that existing forms should migrate to these patterns when next modified.

- [ ] **Step 3: Add File Reference section**

Match the `tables.md` format — a table mapping "What" to "Where" for:
- Guide output path
- Design tokens reference
- Shared primitives location (future)
- Modal form examples (all 7 files)
- Panel form examples (all 5 files)
- Inline edit examples (all 3 files)
- Login form

- [ ] **Step 4: Review the complete document**

Read the entire `forms.md` and verify:
- All hex values match `tokens.md`
- All Tailwind classes are consistent throughout
- Section structure matches `tables.md` pattern
- No duplicate or contradictory guidance
- Code examples use canonical classes

- [ ] **Step 5: Commit**

```bash
git add "Documentation/UI Framework/Components/forms.md"
git commit -m "docs: add shared primitives, migration guide, and file reference to forms.md"
```

---

## Chunk 2: Paper Artboard

### Task 5: Create Forms artboard in Paper

**Tools:** Paper MCP (`mcp__paper__*` tools)

- [ ] **Step 1: Get Paper file context**

Call `get_basic_info` on the Paper file "mapopmatic" to understand existing artboards, loaded fonts, and dimensions.

- [ ] **Step 2: Check for Plus Jakarta Sans availability**

Call `get_font_family_info` for "Plus Jakarta Sans" to confirm it's available with the required weights (400, 500, 600, 700).

- [ ] **Step 3: Create the Forms artboard**

Call `create_artboard` with:
- Name: "Forms"
- Width: 1440px (desktop)
- Height: fit-content (will grow as we add content)

- [ ] **Step 4: Add Section 1 — Input States**

Write HTML showing four input fields side by side demonstrating the four states:
- Default: `border: 1px solid #C2BBD4`, white bg
- Focus: `box-shadow: 0 0 0 2px #F37167`, transparent border
- Error: `border: 1px solid #f58d85`, `bg: #fef1f0`, error message below
- Disabled: `border: 1px solid #E2DEEC`, `bg: #F7F5FA`, muted text

Each with a label above using Secondary color `#8A80A8`. Add a section title "Input States" above.

- [ ] **Step 5: Add Section 2 — Sample Modal Form**

Write HTML showing a modal form layout based on TaskFormModal structure:
- Backdrop (simulated with gray overlay)
- Modal container with `rounded: 16px` (2xl), `shadow-xl`
- Header with title and close button
- Body with 3-4 sample fields (Plan Name, Status select, Description textarea, Due Date)
- Footer with Cancel and Submit buttons

Use all canonical token values.

- [ ] **Step 6: Take screenshot and review**

Call `get_screenshot` to evaluate the artboard. Check:
- Spacing: even gaps, clear rhythm
- Typography: correct sizes, weights, hierarchy
- Contrast: labels readable, inputs clear
- Alignment: fields and labels align vertically

Fix any issues found.

- [ ] **Step 7: Add Section 3 — Sample Panel Form**

Write HTML showing a panel form layout based on AccountForm structure:
- Panel header with back arrow and title
- Tighter body with 2-3 fields
- Full-width submit button
- Optional fields toggle

- [ ] **Step 8: Add Section 4 — Inline Edit Pattern**

Write HTML showing the three inline edit states in sequence:
- Display mode (text with hover highlight)
- Edit mode (input with plum ring)
- Success flash (green background)

- [ ] **Step 9: Add Section 5 — Token Reference Strip**

Write HTML showing color swatches for all form-related tokens:
- Border Strong, Border Subtle, Border Default
- Secondary (labels), Muted (placeholders/help text)
- Coral (focus ring, required marker, errors)
- Semantic Error bg/border/text
- Surface Raised (disabled bg, footer bg)

Each swatch with hex value label.

- [ ] **Step 10: Take final screenshot and review**

Call `get_screenshot` and evaluate against the Review Checkpoints:
- Spacing, Typography, Contrast, Alignment, Clipping, Repetition

Fix any issues.

- [ ] **Step 11: Finish working on nodes**

Call `finish_working_on_nodes` to complete the artboard.

- [ ] **Step 12: Commit any local changes**

```bash
git add "Documentation/UI Framework/Components/forms.md"
git commit -m "docs: finalize forms.md and Paper artboard"
```

(Only if there were any final tweaks to forms.md during artboard creation.)
