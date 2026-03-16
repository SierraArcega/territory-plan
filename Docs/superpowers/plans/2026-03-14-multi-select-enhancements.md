# Multi-Select Enhancements Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Update the canonical multi-select UI spec to document the enhanced pattern (search, Select All, persistent cursor, keyboard nav) and migrate the LayerBubble state dropdown to match.

**Architecture:** Two independent changes. First, rewrite the Multi-Select section of `select.md` with a complete TSX example. Second, migrate the existing `LayerBubble.tsx` state dropdown inline — no new files, no extracted component, just targeted edits to the existing implementation.

**Tech Stack:** React 18, TypeScript, Tailwind CSS, Next.js. No new dependencies.

**Spec:** `Docs/superpowers/specs/2026-03-14-multi-select-enhancements-design.md`

---

## Chunk 1: Rewrite select.md Multi-Select section

### Task 1: Replace Multi-Select section in select.md

**Files:**
- Modify: `Documentation/UI Framework/Components/Forms/select.md:98-288`

The existing Multi-Select section (lines 98–288) documents a basic dropdown-checkbox with no search, no Select All, and no keyboard cursor. Replace it entirely with the spec below.

- [ ] **Step 1: Open the file and locate the section boundary**

Open `Documentation/UI Framework/Components/Forms/select.md`. The Multi-Select section starts at line 98 (`### Multi-Select (Dropdown Checkbox List)`) and ends at line 288 (the `---` separator before the Combobox section). Everything in between gets replaced.

- [ ] **Step 2: Replace the Multi-Select section**

Replace lines 98–288 with the following content (everything from `### Multi-Select` through the closing `---`):

````markdown
### Multi-Select (Dropdown Checkbox List)

A custom dropdown with a sticky search input, a Select All row with tri-state logic, and a scrollable checkbox list. Selected items render as removable chips below the trigger. A persistent cursor (`activeIndex`) tracks the last interacted row for both mouse and keyboard.

**Use when:** 2+ simultaneous selections are expected and the option list is large enough to benefit from search filtering (~10+ options).

#### Component Contract

```tsx
interface MultiSelectOption {
  value: string;
  label: string;
}

interface MultiSelectProps {
  id: string;
  label: string;
  options: MultiSelectOption[];
  selected: string[];            // controlled — array of currently selected values
  onChange: (values: string[]) => void;  // always called with full new array
  placeholder?: string;          // trigger text when nothing selected
  countLabel?: string;           // unit for "N {countLabel}" trigger (default: "items")
  searchPlaceholder?: string;    // search input placeholder (default: "Search…")
  disabled?: boolean;
}
```

**Trigger label rules:**
| Selection count | Trigger text |
|----------------|-------------|
| 0 | `placeholder` prop |
| 1 | The selected option's `label` |
| 2–3 | Labels joined with comma: `"CA, TX, NY"` |
| 4+ | `"{N} {countLabel}"` (e.g., `"12 states"`) |

#### Panel Structure

```
┌─────────────────────────────────┐
│  [trigger button]               │  always visible, outside dropdown
├─────────────────────────────────┤
│  🔍 Search…                     │  sticky, auto-focused on open
│  ─────────────────────────────  │
│  ▣  Select all 50 states        │  sticky <div>; hidden when 0 search results
│  ─────────────────────────────  │
│  □  Alabama              AL     │  scrollable <ul role="listbox">
│  ✓  Alaska               AK     │  cursor row = bg-[#EDE9F7]
│  ✓  Arizona              AZ     │
│  □  Arkansas             AR     │
│  …                              │
└─────────────────────────────────┘
```

The search input and Select All row are rendered **outside** the `<ul role="listbox">` so they remain sticky without invalidating the listbox's child element structure.

#### Visual Spec

**Trigger button (default):**
```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-left flex items-center justify-between
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
```

**Trigger button (disabled):**
```
opacity-50 cursor-not-allowed pointer-events-none
```
Chips are hidden when disabled. The dropdown panel never renders.

**Dropdown panel:**
```
absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg
border border-[#D4CFE2]/60 overflow-hidden
```
No `overflow-y-auto` on the panel — only the list zone scrolls.

**Search input:**
```
w-full px-3 py-2 text-sm border-b border-[#E2DEEC]
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none
```
No focus ring — this input is always focused while the panel is open.

**Select All row:**
```
flex items-center gap-2 px-3 py-2 text-sm font-medium
text-[#403770] border-b border-[#E2DEEC] bg-[#FDFCFF]
hover:bg-[#F7F5FA] cursor-pointer select-none
```
Hidden (`display: none` / conditional render) when search returns zero results.

**Select All tri-state checkbox variants** — the wrapper `<div>` carries `role="checkbox"` and `aria-checked`; the inner SVG is `aria-hidden="true"`:

Unchecked: `w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0`

Indeterminate (dash `—` icon):
```
w-4 h-4 rounded border border-[#403770] bg-[#403770]
flex items-center justify-center flex-shrink-0
```
Dash SVG (16×16): `<rect x="3" y="7.5" width="10" height="1" rx="0.5" fill="white"/>`

Checked (checkmark `✓` icon): same container classes as indeterminate.
Checkmark SVG (16×16): `<path d="M3 8L6.5 11.5L13 5" stroke="white" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>`

**Option row — default:**
```
flex items-center gap-2 px-3 py-2 text-sm text-[#403770]
hover:bg-[#F7F5FA] cursor-pointer select-none
```

**Option row — cursor active** (`activeIndex` matches this row):
```
flex items-center gap-2 px-3 py-2 text-sm text-[#403770]
bg-[#EDE9F7] cursor-pointer select-none
```
Apply as a **mutually exclusive conditional** — one complete string or the other, never both.

**Option checkbox:**
```
w-4 h-4 rounded border border-[#C2BBD4] text-[#403770] flex-shrink-0
```
Use `tabIndex={-1}` and `aria-hidden="true"`.

**Empty state (no search results):**
```
px-3 py-2 text-sm text-[#A69DC0] italic
```

**Chips (below trigger):**
```
inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]
```
Chip remove button: `text-[#A69DC0] hover:text-[#403770] transition-colors`

Chips render in insertion order (`selected` array order). If a value has no matching entry in `options` (stale data), render the raw value string as the label — don't skip it silently.

#### Select All Logic

| Filtered selection state | `aria-checked` | Clicking does |
|--------------------------|---------------|---------------|
| None selected | `"false"` | `onChange(allFilteredValues)` |
| Some selected | `"mixed"` | `onChange(allFilteredValues)` |
| All selected | `"true"` | `onChange(selected without filteredValues)` |

"Filtered" = options matching the current search query. When no search is active, filtered = all options.

**Select All label:**
- No search active: `"Select all {N}"` (N = total option count)
- Search active with results: `"Select {N} results"` (N = filtered count)
- Search active with zero results: row is hidden

#### Cursor (`activeIndex`) Behavior

`activeIndex` is an integer: `-1` = no row highlighted, `0` = Select All row, `1…N` = filtered option rows.

Updates on:
- `mousedown` on any row (sets to that row's index AND toggles it)
- `ArrowDown` / `ArrowUp` keystrokes

Hover does **not** update `activeIndex`.

**Keyboard table** (all handled on the search input):

| Key | `activeIndex` before | Result |
|-----|---------------------|--------|
| `↓` | `-1` | Move to `0` (Select All) |
| `↓` | `0` | Move to `1` |
| `↓` | `1…N-1` | Increment |
| `↓` | `N` | Stay (clamp) |
| `↑` | `-1` | Move to `0` (Select All) |
| `↑` | `0` | Stay (clamp) |
| `↑` | `1` | Move to `0` |
| `↑` | `2…N` | Decrement |
| `Enter` | `0` | Apply Select All logic |
| `Enter` | `1…N` | Toggle option at index |
| `Enter` | `-1` | No-op |
| `Escape` | search has text | Clear search, reset `activeIndex` to `-1` |
| `Escape` | search empty | Close dropdown |
| `Tab` | any | Close dropdown, move focus to next field |

Both `↓` and `↑` from `-1` move to `0` — the first keypress always activates the top of the list.

When a keyboard move lands outside the visible scroll area, call `element.scrollIntoView({ block: "nearest" })`.

#### Accessibility

- Trigger button: `aria-haspopup="listbox"`, `aria-expanded={isOpen}`
- Search input: `aria-label="Search options"`, `aria-controls="{id}-listbox"`, `aria-activedescendant` = `"{id}-option-{value}"` for active option rows, `"{id}-select-all"` for the Select All row, omitted when `activeIndex === -1`
- Select All `<div>`: `id="{id}-select-all"`, `role="checkbox"`, `aria-checked="true|false|mixed"`, `tabIndex={-1}`, `aria-label` = `"Select all {N}"` or `"Select {N} results"` (matches visible label)
- Option list `<ul>`: `role="listbox"`, `aria-multiselectable="true"`, `id="{id}-listbox"`, `aria-label={label}`
- Each option `<li>`: `role="option"`, `aria-selected={isSelected}`, `id="{id}-option-{value}"`
- Chip remove buttons: `aria-label="Remove {label}"`
- Option checkboxes: `tabIndex={-1}`, `aria-hidden="true"`

#### TSX Example

```tsx
function MultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = "Select…",
  countLabel = "items",
  searchPlaceholder = "Search…",
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const selectAllRef = useRef<HTMLDivElement>(null);

  const filtered = query.trim()
    ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
    : options;

  // Tri-state: how many of filtered are selected?
  const filteredSelected = filtered.filter((o) => selected.includes(o.value));
  const selectAllState: "true" | "false" | "mixed" =
    filteredSelected.length === 0
      ? "false"
      : filteredSelected.length === filtered.length
      ? "true"
      : "mixed";

  const selectAllLabel =
    query.trim()
      ? `Select ${filtered.length} results`
      : `Select all ${options.length}`;

  // Trigger label
  const triggerText = (() => {
    if (selected.length === 0) return placeholder;
    if (selected.length === 1) {
      return options.find((o) => o.value === selected[0])?.label ?? selected[0];
    }
    if (selected.length <= 3) {
      return selected
        .map((v) => options.find((o) => o.value === v)?.label ?? v)
        .join(", ");
    }
    return `${selected.length} ${countLabel}`;
  })();

  // Open/close
  const open = () => {
    setIsOpen(true);
    setQuery("");
    setActiveIndex(-1);
    requestAnimationFrame(() => searchRef.current?.focus());
  };

  const close = () => {
    setIsOpen(false);
    setQuery("");
    setActiveIndex(-1);
  };

  // Outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  // Scroll active row into view
  useEffect(() => {
    if (activeIndex === 0) {
      selectAllRef.current?.scrollIntoView({ block: "nearest" });
    } else if (activeIndex > 0) {
      optionRefs.current[activeIndex - 1]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const toggleOption = (value: string) => {
    onChange(
      selected.includes(value)
        ? selected.filter((v) => v !== value)
        : [...selected, value]
    );
  };

  const applySelectAll = () => {
    if (selectAllState === "true") {
      // Uncheck all filtered
      const filteredValues = new Set(filtered.map((o) => o.value));
      onChange(selected.filter((v) => !filteredValues.has(v)));
    } else {
      // Check all filtered (merge with existing selection)
      const filteredValues = filtered.map((o) => o.value);
      const existing = new Set(selected);
      onChange([...selected, ...filteredValues.filter((v) => !existing.has(v))]);
    }
  };

  const activeDescendant =
    activeIndex === 0
      ? `${id}-select-all`
      : activeIndex > 0
      ? `${id}-option-${filtered[activeIndex - 1]?.value}`
      : undefined;

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const max = filtered.length; // indices 1…max
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i < max ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i <= 0 ? 0 : i - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex === 0) applySelectAll();
      else if (activeIndex > 0) toggleOption(filtered[activeIndex - 1].value);
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (query) {
        setQuery("");
        setActiveIndex(-1);
      } else {
        close();
      }
    } else if (e.key === "Tab") {
      close();
    }
  };

  const selectedLabels = selected.map((v) => ({
    value: v,
    label: options.find((o) => o.value === v)?.label ?? v, // fallback to raw value
  }));

  if (disabled) {
    return (
      <div>
        <label className="block text-xs font-medium text-[#8A80A8] mb-1">{label}</label>
        <button
          type="button"
          disabled
          className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
            bg-white text-left flex items-center justify-between
            opacity-50 cursor-not-allowed pointer-events-none"
        >
          <span className="text-[#A69DC0]">{placeholder}</span>
          <svg className="w-4 h-4 text-[#A69DC0]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </button>
      </div>
    );
  }

  return (
    <div ref={containerRef} className="relative">
      <label className="block text-xs font-medium text-[#8A80A8] mb-1">{label}</label>

      {/* Trigger */}
      <button
        id={id}
        type="button"
        onClick={() => (isOpen ? close() : open())}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
        className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
          bg-white text-left flex items-center justify-between
          focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
      >
        <span className={selected.length === 0 ? "text-[#A69DC0]" : "text-[#403770] truncate"}>
          {triggerText}
        </span>
        <svg
          className={`w-4 h-4 text-[#A69DC0] flex-shrink-0 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg
          border border-[#D4CFE2]/60 overflow-hidden">

          {/* Search */}
          <input
            ref={searchRef}
            type="text"
            value={query}
            onChange={(e) => {
              setQuery(e.target.value);
              setActiveIndex(-1);
            }}
            onKeyDown={handleKeyDown}
            placeholder={searchPlaceholder}
            aria-label="Search options"
            aria-controls={`${id}-listbox`}
            aria-activedescendant={activeDescendant}
            autoComplete="off"
            className="w-full px-3 py-2 text-sm border-b border-[#E2DEEC]
              bg-white text-[#403770] placeholder:text-[#A69DC0] focus:outline-none"
          />

          {/* Select All row — hidden when search returns 0 results */}
          {filtered.length > 0 && (
            <div
              ref={selectAllRef}
              id={`${id}-select-all`}
              role="checkbox"
              aria-checked={selectAllState}
              aria-label={selectAllLabel}
              tabIndex={-1}
              onMouseDown={(e) => {
                e.preventDefault(); // keep focus on search input
                setActiveIndex(0);
                applySelectAll();
              }}
              className="flex items-center gap-2 px-3 py-2 text-sm font-medium
                text-[#403770] border-b border-[#E2DEEC] bg-[#FDFCFF]
                hover:bg-[#F7F5FA] cursor-pointer select-none"
            >
              {/* Tri-state checkbox */}
              <div
                aria-hidden="true"
                className={
                  selectAllState === "false"
                    ? "w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0"
                    : "w-4 h-4 rounded border border-[#403770] bg-[#403770] flex items-center justify-center flex-shrink-0"
                }
              >
                {selectAllState === "mixed" && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <rect x="3" y="7.5" width="10" height="1" rx="0.5" fill="white" />
                  </svg>
                )}
                {selectAllState === "true" && (
                  <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                    <path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                  </svg>
                )}
              </div>
              <span>{selectAllLabel}</span>
            </div>
          )}

          {/* Scrollable list */}
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-60 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#A69DC0] italic">
                No matches found
              </li>
            ) : (
              filtered.map((option, i) => {
                const isSelected = selected.includes(option.value);
                const isCursor = activeIndex === i + 1;
                return (
                  <li
                    key={option.value}
                    ref={(el) => { optionRefs.current[i] = el; }}
                    id={`${id}-option-${option.value}`}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={(e) => {
                      e.preventDefault(); // keep focus on search input
                      setActiveIndex(i + 1);
                      toggleOption(option.value);
                    }}
                    className={
                      isCursor
                        ? "flex items-center gap-2 px-3 py-2 text-sm text-[#403770] bg-[#EDE9F7] cursor-pointer select-none"
                        : "flex items-center gap-2 px-3 py-2 text-sm text-[#403770] hover:bg-[#F7F5FA] cursor-pointer select-none"
                    }
                  >
                    <input
                      type="checkbox"
                      checked={isSelected}
                      onChange={() => {}} // controlled via onMouseDown on <li>
                      tabIndex={-1}
                      aria-hidden="true"
                      className="w-4 h-4 rounded border border-[#C2BBD4] text-[#403770] flex-shrink-0"
                    />
                    {option.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}

      {/* Chips */}
      {selectedLabels.length > 0 && (
        <div className="flex flex-wrap gap-1.5 mt-2">
          {selectedLabels.map(({ value, label: chipLabel }) => (
            <span
              key={value}
              className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]"
            >
              {chipLabel}
              <button
                type="button"
                onClick={() => onChange(selected.filter((v) => v !== value))}
                aria-label={`Remove ${chipLabel}`}
                className="text-[#A69DC0] hover:text-[#403770] transition-colors"
              >
                <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
```

````

- [ ] **Step 3: Verify the surrounding sections are intact**

After the edit, confirm:
- The Native Select section above (lines 23–96) is unchanged
- The `---` separator before the Combobox section follows immediately after the replaced content
- The Combobox section below is unchanged

- [ ] **Step 4: Commit**

```bash
git add "Documentation/UI Framework/Components/Forms/select.md"
git commit -m "docs: rewrite Multi-Select section with enhanced spec (search, Select All, cursor, keyboard nav)"
```

---

## Chunk 2: Migrate LayerBubble state dropdown

### Task 2: Rename stateHighlight → activeIndex and fix initial value

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx:495` (state declaration)
- Modify: `src/features/map/components/LayerBubble.tsx:656-657` (open handler reset)
- Modify: `src/features/map/components/LayerBubble.tsx:710-711` (search change reset)

The current code initialises `stateHighlight` to `0`. The spec requires `-1` (no row highlighted on open). All reset points must also change to `-1`.

- [ ] **Step 1: Rename the state variable and fix initial value**

Find line 495:
```tsx
const [stateHighlight, setStateHighlight] = useState(0);
```
Change to:
```tsx
const [activeIndex, setActiveIndex] = useState(-1);
```

- [ ] **Step 2: Fix the open handler reset**

Find in the trigger button's `onClick` (around line 656):
```tsx
setStateSearch("");
setStateHighlight(0);
```
Change to:
```tsx
setStateSearch("");
setActiveIndex(-1);
```

- [ ] **Step 3: Fix the search change reset**

Find in the search input's `onChange` (around line 710):
```tsx
setStateSearch(e.target.value);
setStateHighlight(0);
```
Change to:
```tsx
setStateSearch(e.target.value);
setActiveIndex(-1);
```

- [ ] **Step 4: Update all remaining references to stateHighlight**

Search the file for any remaining `stateHighlight` references and rename to `activeIndex`. Replace **every** occurrence — do not stop after finding a few. Use a global find-and-replace to be safe. Key locations to confirm were updated: ArrowDown handler, ArrowUp handler, Enter handler, option row `ref` condition, option row `className` condition.

- [ ] **Step 5: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "refactor: rename stateHighlight to activeIndex, init to -1 in state dropdown"
```

---

### Task 3: Add mousedown tracking to option rows

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx:749-773` (option row `<label>` elements)

Currently, clicking a state label toggles via `onChange` on the checkbox but does **not** update `activeIndex`. The spec requires `mousedown` on any row to set `activeIndex` to that row's index.

Note: The current rows use `<label>` wrapping a checkbox. The `mousedown` handler must call `e.preventDefault()` to prevent the search input from losing focus.

- [ ] **Step 1: Find the option row elements**

After Task 2, the file has `activeIndex` (renamed from `stateHighlight`). Locate the `filtered.map((s, i) => (` block (around line 749). Each row is a `<label>` element that now reads:
```tsx
<label
  key={s.abbrev}
  ref={(el) => {
    if (i === activeIndex && el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }}
  className={...}
>
```
(This is the post-Task-2 state — `stateHighlight` has already been renamed to `activeIndex` but the index comparison is still 0-based here.)

- [ ] **Step 2: Add onMouseDown to each option row**

Add `onMouseDown` to the `<label>` element:
```tsx
<label
  key={s.abbrev}
  ref={(el) => {
    if (i === activeIndex - 1 && el) {
      el.scrollIntoView({ block: "nearest" });
    }
  }}
  onMouseDown={(e) => {
    e.preventDefault(); // keep focus on search input
    setActiveIndex(i + 1);
  }}
  className={...}
>
```

Note: The `ref` callback condition changes from `i === activeIndex` to `i === activeIndex - 1` because after the Select All row is added, option row `i` (0-based) maps to `activeIndex === i + 1`.

- [ ] **Step 3: Verify scroll-into-view still works**

The `ref` callback scrolls the highlighted row into view. After the rename, the condition is `i === activeIndex - 1` (option index maps to activeIndex = i+1). Confirm this is correct.

- [ ] **Step 4: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "feat: add mousedown cursor tracking to state dropdown option rows"
```

---

### Task 4: Add Select All row to state dropdown

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx` — inside the open dropdown, between the search input and the `filtered.map` list

This is the main new feature. Insert a sticky Select All row with tri-state logic between the `<input>` (search) and the `{filtered.map(...)}` list. The row uses `setFilterStates` from the store to update state.

- [ ] **Step 1: Locate the insertion point**

Find the block inside `{stateDropdownOpen && (() => { ... })()}` (around line 693). The structure is:
```tsx
<div className="absolute z-20 ...">
  <div className="px-2 pt-2 pb-1 border-b border-gray-100">
    <input ref={stateSearchRef} ... />  {/* search input */}
  </div>
  <div className="max-h-48 overflow-y-auto">
    {filterStates.length > 0 && (   {/* Clear selection button */}
      ...
    )}
    {filtered.length === 0 && ( ... )}  {/* empty state */}
    {filtered.map((s, i) => ( ... ))}   {/* option rows */}
  </div>
</div>
```

- [ ] **Step 2: Compute tri-state values above the return**

Inside the IIFE (before `return (`), add:
```tsx
const filteredValues = filtered.map((s) => s.abbrev);
const filteredSelected = filteredValues.filter((abbrev) => filterStates.includes(abbrev));
const selectAllState: "true" | "false" | "mixed" =
  filteredSelected.length === 0
    ? "false"
    : filteredSelected.length === filteredValues.length
    ? "true"
    : "mixed";
const selectAllLabel = q
  ? `Select ${filteredValues.length} results`
  : `Select all ${states.length}`;

const applySelectAll = () => {
  if (selectAllState === "true") {
    // Uncheck all filtered
    const filteredSet = new Set(filteredValues);
    setFilterStates(filterStates.filter((s) => !filteredSet.has(s)));
  } else {
    // Check all filtered (merge with existing)
    const existing = new Set(filterStates);
    setFilterStates([...filterStates, ...filteredValues.filter((v) => !existing.has(v))]);
  }
};
```

- [ ] **Step 3: Insert the Select All row**

Inside the scrollable `<div className="max-h-48 overflow-y-auto">`, add the Select All row as the first child (before the Clear selection button, which should be removed — the Select All row's "uncheck all" action replaces it):

```tsx
<div className="max-h-48 overflow-y-auto">
  {/* Select All row — hidden when search returns 0 results */}
  {filtered.length > 0 && (
    <div
      id="state-select-all"
      role="checkbox"
      aria-checked={selectAllState}
      aria-label={selectAllLabel}
      tabIndex={-1}
      onMouseDown={(e) => {
        e.preventDefault();
        setActiveIndex(0);
        applySelectAll();
      }}
      className="flex items-center gap-2 px-2.5 py-1.5 text-sm font-medium
        text-gray-700 border-b border-gray-100 bg-gray-50/50
        hover:bg-gray-50 cursor-pointer select-none"
    >
      <div
        aria-hidden="true"
        className={
          selectAllState === "false"
            ? "w-4 h-4 rounded border border-gray-300 bg-white flex-shrink-0"
            : "w-4 h-4 rounded border border-plum bg-plum flex items-center justify-center flex-shrink-0"
        }
      >
        {selectAllState === "mixed" && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <rect x="3" y="7.5" width="10" height="1" rx="0.5" fill="white" />
          </svg>
        )}
        {selectAllState === "true" && (
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8L6.5 11.5L13 5" stroke="white" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        )}
      </div>
      <span>{selectAllLabel}</span>
    </div>
  )}

  {/* Remove the old "Clear selection" button — Select All's uncheck-all replaces it */}

  {filtered.length === 0 && (
    <div className="px-2.5 py-2 text-xs text-gray-400 italic">
      No states match &ldquo;{stateSearch}&rdquo;
    </div>
  )}
  {/* Leave the existing filtered.map(...) option rows in place — they were already updated in Task 3 with onMouseDown and the corrected ref condition. Do not re-paste or modify them here. */}
</div>
```

Note: The Select All row is placed at the top of the scrollable `<div className="max-h-48 overflow-y-auto">` rather than outside it. This is an intentional deviation from the generic spec (which calls for sticky positioning outside the scroll container). In LayerBubble's compact panel the list is short enough that sticky is not worth the structural refactor — placing it first in the scrollable div is sufficient.

Note: LayerBubble uses Tailwind theme tokens (`text-plum`, `border-plum`) rather than raw hex values — match that convention here rather than using `#403770` directly.

- [ ] **Step 3b: Remove the old "Clear selection" button**

The Select All row's "uncheck all" action replaces the existing "Clear selection" button. Find and delete this block from inside the scrollable div:
```tsx
{filterStates.length > 0 && (
  <button
    type="button"
    onClick={() => setFilterStates([])}
    className="w-full text-left text-xs text-plum hover:bg-gray-50 px-2.5 py-1.5 border-b border-gray-100"
  >
    Clear selection
  </button>
)}
```

- [ ] **Step 4: Update the keyboard Enter and Escape handlers**

Find the full `onKeyDown` handler on the search input (around line 713). Replace the `Enter` and `Escape` branches:

**Enter** — find:
```tsx
} else if (e.key === "Enter") {
  e.preventDefault();
  if (filtered[activeIndex]) {
    toggleFilterState(filtered[activeIndex].abbrev);
  }
}
```
Replace with:
```tsx
} else if (e.key === "Enter") {
  e.preventDefault();
  if (activeIndex === 0) {
    applySelectAll();
  } else if (activeIndex > 0 && filtered[activeIndex - 1]) {
    toggleFilterState(filtered[activeIndex - 1].abbrev);
  }
}
```

**Escape** — find:
```tsx
} else if (e.key === "Escape") {
  e.preventDefault();
  setStateDropdownOpen(false);
}
```
Replace with two-stage Escape (first clears query, second closes):
```tsx
} else if (e.key === "Escape") {
  e.preventDefault();
  if (stateSearch) {
    setStateSearch("");
    setActiveIndex(-1);
  } else {
    setStateDropdownOpen(false);
  }
}
```

- [ ] **Step 5: Update the ArrowDown/ArrowUp handlers for the new index range**

Find the arrow key handlers (around lines 714–719):
```tsx
if (e.key === "ArrowDown") {
  e.preventDefault();
  setActiveIndex((h) => Math.min(h + 1, filtered.length - 1));
} else if (e.key === "ArrowUp") {
  e.preventDefault();
  setActiveIndex((h) => Math.max(h - 1, 0));
}
```
Change to (index 0 = Select All, 1…N = options):
```tsx
if (e.key === "ArrowDown") {
  e.preventDefault();
  setActiveIndex((h) => Math.min(h + 1, filtered.length)); // max is filtered.length (last option)
} else if (e.key === "ArrowUp") {
  e.preventDefault();
  setActiveIndex((h) => (h <= 0 ? 0 : h - 1));
}
```

- [ ] **Step 6: Add ARIA attributes to the search input and aria-activedescendant**

The search input currently has no ARIA attributes. Add `aria-label`, `aria-controls`, and `aria-activedescendant`:
```tsx
aria-label="Search states"
aria-controls="state-listbox"
aria-activedescendant={
  activeIndex === 0
    ? "state-select-all"
    : activeIndex > 0 && filtered[activeIndex - 1]
    ? `state-option-${filtered[activeIndex - 1].abbrev}`
    : undefined
}
```

Also add `id="state-listbox"` to the `<div className="max-h-48 overflow-y-auto">` wrapper, and `id` attributes to option rows:
```tsx
<label
  key={s.abbrev}
  id={`state-option-${s.abbrev}`}
  ...
>
```

- [ ] **Step 7: Verify the dropdown renders and Select All toggles correctly**

Open the app, open the map, open the state filter dropdown. Verify:
1. "Select all 50 states" row appears at top
2. Clicking it checks all states (trigger shows "50 states")
3. Clicking again unchecks all (trigger shows "All States")
4. With search "cal", row shows "Select N results" for however many state names contain "cal" (e.g., California). Clicking selects only those filtered states.
5. Select All row is hidden when search returns 0 results

- [ ] **Step 8: Commit**

```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "feat: add Select All row with tri-state logic to state dropdown"
```

---

### Task 5: Align trigger label and verify

**Files:**
- Modify: `src/features/map/components/LayerBubble.tsx:670-674` (trigger label)

The existing trigger label logic shows `filterStates.sort().join(", ")` for ≤3 selected — this uses abbreviations, which is correct and intentional for the compact LayerBubble UI. The threshold (0/1–3/4+) already matches the spec. Verify there are no changes needed.

- [ ] **Step 1: Read the existing trigger label logic**

Locate lines 670–674:
```tsx
{filterStates.length === 0
  ? "All States"
  : filterStates.length <= 3
    ? filterStates.sort().join(", ")
    : `${filterStates.length} states`}
```

- [ ] **Step 2: Confirm this matches the spec thresholds**

The spec says: 0 → placeholder, 1 → label, 2–3 → joined, 4+ → count. The current code:
- 0 → "All States" ✓
- 1–3 → abbreviations joined ✓ (showing abbreviations is intentional here — state abbreviations are the label in the LayerBubble context)
- 4+ → "N states" ✓

No changes needed. Document this intentional deviation from the generic `MultiSelect` TSX example (which would show full names) in a code comment if desired.

- [ ] **Step 3: Final visual verification**

Open the state dropdown and test:
1. `↓` from open state → Select All row highlights
2. `↑` from open state → Select All row highlights
3. `↓` again → first option row highlights
4. `Enter` → that state toggles
5. Click a state row with the mouse → that row stays highlighted (cursor persists)
6. Move mouse away → cursor does not move
7. `Escape` with search text → clears search
8. `Escape` with empty search → closes dropdown
9. `Tab` → closes dropdown, focus moves to next field

- [ ] **Step 4: Final commit (only if changes were made)**

If Step 1 revealed that the trigger label logic needed adjustments, commit them:
```bash
git add src/features/map/components/LayerBubble.tsx
git commit -m "fix: align LayerBubble state dropdown trigger label with multi-select spec"
```
If no changes were needed (existing logic already matches), skip this step — do not create an empty commit.
