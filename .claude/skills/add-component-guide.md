---
name: add-component-guide
description: Use when adding new component documentation to Documentation/UI Framework/Components/. Enforces subfolder + _foundations.md + individual file methodology.
---

# Add Component Guide

Enforces the standard methodology for adding component documentation to the UI Framework.

## Trigger

When the user asks to add a new component guide, component documentation, or UI pattern
to `Documentation/UI Framework/Components/`.

## Process

### 1. Determine Category

Check existing subfolders in `Documentation/UI Framework/Components/`:
- `Navigation/` — buttons, links, tabs, sidebar, breadcrumbs, pagination, etc.
- `Tables/` — data tables, detail tables, compact/inline tables

Ask the user: does this component belong in an existing category, or does it need a new one?

### 2. If New Category

Create the subfolder and a `_foundations.md` file:

```
Documentation/UI Framework/Components/<Category>/
├── _foundations.md
└── <component>.md
```

The `_foundations.md` must define shared patterns for the category:
- Common states (active, hover, disabled)
- Shared sizing/spacing conventions
- Shared interaction patterns (keyboard, transitions)
- Reference to `tokens.md` for all color/spacing values

### 3. If Existing Category

Read the category's `_foundations.md` to understand shared patterns the new component
must follow.

### 4. Write the Component Guide

Every component file MUST follow this structure. All styling must include complete, copy-pasteable Tailwind class strings with token hex values — not just descriptions.

```markdown
# Component Name

[One-line description of what this component is for]

See `_foundations.md` for [list relevant shared patterns].

---

## Use When
[When to use this component vs alternatives]

## Anatomy
[Visual breakdown of the component's parts]

## Variants
[Each variant with complete Tailwind class strings and TSX code examples]

## States
[Default, hover, active, disabled, focus, loading — as applicable]
[Reference _foundations.md for shared states like disabled and focus ring]

## Keyboard
[All keyboard interactions]

## Codebase Examples
[Table mapping component names to file paths in src/]
```

### 5. Validate

Before committing, verify:
- [ ] No Tailwind grays (`gray-*`) in prescriptive styling — use plum-derived tokens
- [ ] All hex values and shared patterns are traceable to `tokens.md` and `_foundations.md` — no ad-hoc values or redefinitions
- [ ] TSX code examples are complete and copy-pasteable
- [ ] Keyboard interactions are documented
- [ ] File paths in Codebase Examples are accurate

### 6. Commit

```bash
git add "Documentation/UI Framework/Components/<Category>/<component>.md"
git commit -m "docs: add <component> component guide"
```
