# Select

Selection controls for the territory planner — covers native `<select>`, multi-select with checkboxes, and combobox/search-select. See `_foundations.md` for the canonical class string, label convention, validation patterns, and focus ring specification.

---

## When to Use

| Variant | When to use |
|---------|-------------|
| Native select | Choosing one option from a short, stable list (< 7 items). Fastest to implement, inherently accessible, works on mobile without custom UI. |
| Multi-select | Choosing multiple options from a list — filter bars, tag selection, status combinations. Use when 2+ selections are expected. |
| Combobox / search-select | Large option sets (> 7 items) where typing to filter saves scrolling. Also use when options are dynamic (loaded from data) or when label text is long. |

**Don't** build a custom single-select dropdown when native `<select>` would suffice — native controls are faster, accessible by default, and adapt automatically to mobile OS conventions.

**Don't** use multi-select for mutually exclusive choices — use a radio group instead.

---

## Variants

### Native Select

The native `<select>` element styled with the canonical input class string. `appearance-none` removes the browser's default chevron so a custom SVG chevron can be positioned absolutely inside the wrapper.

**Classes (select element):**
```
w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] appearance-none
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed
```

**Chevron wrapper:** `relative` on the container; chevron icon at `absolute right-2.5 top-1/2 -translate-y-1/2 text-[#A69DC0] pointer-events-none`

**Placeholder option** (first `<option>`, always present, not a valid selection):
```tsx
<option value="" disabled>Select a region…</option>
```

**Use case:** Region, status, priority, type — any field with a short, known set of options. Single selection only.

**TSX example:**
```tsx
<div>
  <label htmlFor="region" className="block text-xs font-medium text-[#8A80A8] mb-1">
    Region <span className="text-[#F37167]">*</span>
  </label>
  <div className="relative">
    <select
      id="region"
      value={region}
      onChange={(e) => setRegion(e.target.value)}
      className="w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
        bg-white text-[#403770] appearance-none
        focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
        disabled:bg-[#F7F5FA] disabled:border-[#E2DEEC] disabled:text-[#A69DC0] disabled:cursor-not-allowed"
    >
      <option value="" disabled>Select a region…</option>
      <option value="northeast">Northeast</option>
      <option value="southeast">Southeast</option>
      <option value="midwest">Midwest</option>
      <option value="southwest">Southwest</option>
      <option value="west">West</option>
    </select>
    <svg
      className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0] pointer-events-none"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
    </svg>
  </div>
</div>
```

**Placeholder state** — when no value is selected yet, the select text should read as muted. Add a conditional class to match the placeholder color:
```tsx
<select
  value={priority}
  onChange={(e) => setPriority(e.target.value)}
  className={`w-full px-3 py-2 text-sm border border-[#C2BBD4] rounded-lg
    bg-white appearance-none
    focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
    ${priority === "" ? "text-[#A69DC0]" : "text-[#403770]"}`}
>
  <option value="" disabled>Select priority…</option>
  <option value="low">Low</option>
  <option value="medium">Medium</option>
  <option value="high">High</option>
</select>
```

---

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
│  🔍 Search…                     │  fixed above scroll area, auto-focused on open
│  ─────────────────────────────  │
│  ▣  Select all 50 states        │  fixed above scroll area; hidden when 0 search results
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

  // Outside click — empty deps is intentional: useState setters are stable references
  // so `close` never changes identity. If your linter flags this, wrap `close` in useCallback.
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        close();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      if (max === 0) return; // nothing to navigate when list is empty
      setActiveIndex((i) => (i < max ? i + 1 : i));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      if (max === 0) return;
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

{/* Usage */}
<MultiSelect
  id="service-types"
  label="Service Types"
  countLabel="types"
  placeholder="All service types"
  options={[
    { value: "curriculum", label: "Curriculum" },
    { value: "pd", label: "Professional Development" },
    { value: "coaching", label: "Instructional Coaching" },
    { value: "assessment", label: "Assessment" },
    { value: "platform", label: "Platform License" },
  ]}
  selected={selectedServiceTypes}
  onChange={setSelectedServiceTypes}
/>
```

---

### Combobox / Search-Select

A text input combined with a filtered dropdown list. The user types to narrow the options; the dropdown shows only matching results. Useful for large lists (districts, accounts, plans) where scrolling through every option would be slow.

**Input classes** — canonical input class string with a right-padding offset for the chevron:
```
w-full px-3 pr-9 py-2 text-sm border border-[#C2BBD4] rounded-lg
bg-white text-[#403770] placeholder:text-[#A69DC0]
focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent
```

**Dropdown panel classes:**
```
absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg
border border-[#D4CFE2]/60 max-h-60 overflow-y-auto
```

**Option row (default):**
```
px-3 py-2 text-sm text-[#403770] hover:bg-[#EFEDF5] cursor-pointer
```

**Option row (highlighted / keyboard-focused):**
```
px-3 py-2 text-sm text-[#403770] bg-[#EFEDF5] cursor-pointer
```

**Option row (currently selected):**
```
px-3 py-2 text-sm text-[#403770] bg-[#F7F5FA] font-medium cursor-pointer
```

**Empty state:**
```
px-3 py-2 text-sm text-[#A69DC0] italic
```

**Use case:** District or account lookup (large lists), assigning a plan to an owner from a user list, any field where the full option set is too long to scroll comfortably.

**TSX example:**
```tsx
function Combobox({
  options,
  value,
  onChange,
  label,
  id,
  placeholder = "Search…",
}: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (value: string) => void;
  label: string;
  id: string;
  placeholder?: string;
}) {
  const [query, setQuery] = useState("");
  const [isOpen, setIsOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const listboxId = `${id}-listbox`;

  const filtered = query.trim() === ""
    ? options
    : options.filter((o) =>
        o.label.toLowerCase().includes(query.toLowerCase())
      );

  const selectedLabel = options.find((o) => o.value === value)?.label ?? "";

  // Close on outside click
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setQuery("");
        setActiveIndex(-1);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setQuery(e.target.value);
    setIsOpen(true);
    setActiveIndex(-1);
  };

  const handleSelect = (optionValue: string) => {
    onChange(optionValue);
    setQuery("");
    setIsOpen(false);
    setActiveIndex(-1);
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!isOpen && (e.key === "ArrowDown" || e.key === "ArrowUp")) {
      setIsOpen(true);
      return;
    }
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => Math.min(i + 1, filtered.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && activeIndex >= 0) {
      e.preventDefault();
      handleSelect(filtered[activeIndex].value);
    } else if (e.key === "Escape") {
      setIsOpen(false);
      setQuery("");
      setActiveIndex(-1);
    } else if (e.key === "Tab") {
      // Accept current selection and move to next field
      if (activeIndex >= 0) handleSelect(filtered[activeIndex].value);
      setIsOpen(false);
    }
  };

  return (
    <div ref={containerRef} className="relative">
      <label htmlFor={id} className="block text-xs font-medium text-[#8A80A8] mb-1">
        {label}
      </label>

      <div className="relative">
        <input
          id={id}
          type="text"
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={isOpen}
          aria-controls={listboxId}
          aria-activedescendant={
            activeIndex >= 0 ? `${id}-option-${filtered[activeIndex]?.value}` : undefined
          }
          value={isOpen ? query : selectedLabel}
          onChange={handleInputChange}
          onFocus={() => setIsOpen(true)}
          onKeyDown={handleKeyDown}
          placeholder={placeholder}
          autoComplete="off"
          className="w-full px-3 pr-9 py-2 text-sm border border-[#C2BBD4] rounded-lg
            bg-white text-[#403770] placeholder:text-[#A69DC0]
            focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
        />
        <svg
          className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0] pointer-events-none"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </div>

      {isOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg
            border border-[#D4CFE2]/60 max-h-60 overflow-y-auto"
        >
          {filtered.length === 0 ? (
            <li className="px-3 py-2 text-sm text-[#A69DC0] italic">
              No matches found
            </li>
          ) : (
            filtered.map((option, index) => {
              const isActive = index === activeIndex;
              const isSelected = option.value === value;
              return (
                <li
                  key={option.value}
                  id={`${id}-option-${option.value}`}
                  role="option"
                  aria-selected={isSelected}
                  onClick={() => handleSelect(option.value)}
                  className={`px-3 py-2 text-sm text-[#403770] cursor-pointer
                    ${isActive ? "bg-[#EFEDF5]" : isSelected ? "bg-[#F7F5FA] font-medium" : "hover:bg-[#EFEDF5]"}`}
                >
                  {option.label}
                </li>
              );
            })
          )}
        </ul>
      )}
    </div>
  );
}

{/* Usage */}
<Combobox
  id="account-select"
  label="Account"
  placeholder="Search accounts…"
  options={accounts.map((a) => ({ value: a.id, label: a.name }))}
  value={selectedAccountId}
  onChange={setSelectedAccountId}
/>
```

---

## States

States are inherited from `_foundations.md`. The native select uses them directly; multi-select and combobox apply them to their trigger / input elements.

| State | Border | Background | Text | Ring |
|-------|--------|------------|------|------|
| Default | `#C2BBD4` | `#FFFFFF` | `#403770` | — |
| Focus | transparent | `#FFFFFF` | `#403770` | Coral `#F37167` (2px) |
| Error | `#f58d85` | `#fef1f0` | `#403770` | — |
| Error + Focus | `#f58d85` | `#fef1f0` | `#403770` | Coral `#F37167` (2px) |
| Disabled | `#E2DEEC` | `#F7F5FA` | `#A69DC0` | — |

> No hover state on the input itself — focus ring on click/tab is sufficient.

**Error state (native select):**
```tsx
<div className="relative">
  <select
    id="region"
    value={region}
    onChange={(e) => setRegion(e.target.value)}
    aria-invalid="true"
    aria-describedby="region-error"
    className="w-full px-3 py-2 text-sm border border-[#f58d85] rounded-lg
      bg-[#fef1f0] text-[#403770] appearance-none
      focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent"
  >
    <option value="" disabled>Select a region…</option>
    <option value="northeast">Northeast</option>
    <option value="southeast">Southeast</option>
  </select>
  <svg className="absolute right-2.5 top-1/2 -translate-y-1/2 w-4 h-4 text-[#A69DC0] pointer-events-none"
    fill="none" stroke="currentColor" viewBox="0 0 24 24">
    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
  </svg>
</div>
<p id="region-error" className="text-xs text-[#F37167] mt-1">Region is required</p>
```

---

## Keyboard Interactions

### Native Select

| Key | Action |
|-----|--------|
| `Space` / `Enter` | Open the browser dropdown |
| `Arrow Up` / `Arrow Down` | Cycle through options |
| `Home` / `End` | Jump to first / last option |
| Type a letter | Jump to first option starting with that letter |
| `Escape` | Close without changing selection |
| `Tab` | Close and move focus to next field |

### Multi-Select

All keyboard interaction is handled on the search input (auto-focused on open). See the full keyboard table in the Multi-Select section above.

| Key | Action |
|-----|--------|
| `↓` / `↑` | Move cursor through Select All row and option rows |
| `Enter` | Toggle option at cursor; apply Select All if cursor is on Select All row |
| `Escape` (search has text) | Clear search query, reset cursor |
| `Escape` (search empty) | Close dropdown |
| `Tab` | Close dropdown and move focus to next field |

### Combobox / Search-Select

| Key | Action |
|-----|--------|
| Type | Filter the option list |
| `Arrow Up` / `Arrow Down` | Navigate the filtered list |
| `Enter` | Select the highlighted option |
| `Escape` | Close dropdown and clear the typed filter |
| `Tab` | Accept the currently highlighted option (if any) and move to next field |

---

## Do / Don't

- **DO** use native `<select>` for short lists — it is faster to build, inherently accessible, and adapts to mobile OS conventions without any extra code.
- **DON'T** build a custom single-option dropdown when native select would suffice. Custom dropdowns add complexity and require explicit ARIA management to remain accessible.
- **DO** always include a placeholder `<option>` as the first item — `<option value="" disabled>Select a region…</option>` — to signal that a choice is required. Never use a real option value as the default.
- **DON'T** use multi-select for mutually exclusive choices (e.g., a single status field). Use a radio group instead so users understand only one value can be active.
- **DO** show selected values as removable chips in multi-select — this makes the current state scannable without reopening the dropdown.
- **DON'T** suppress the focus ring on any select variant. All three variants require `focus:ring-2 focus:ring-[#F37167]` (or equivalent custom focus management in the combobox) for keyboard navigation and WCAG compliance.

---

## Accessibility

**Native select:**
- Inherently accessible — the browser manages all keyboard interaction, option announcement, and mobile UI.
- Always pair with `<label htmlFor>`. The label is the accessible name for the control.
- Add `aria-invalid="true"` and `aria-describedby` pointing to the error message element when in error state.

**Multi-select:**
- The dropdown `<ul>` needs `role="listbox"` and `aria-multiselectable="true"`.
- The trigger button needs `aria-haspopup="listbox"` and `aria-expanded={isOpen}`.
- Each `<li>` needs `role="option"` and `aria-selected={isSelected}`.
- Chip remove buttons need `aria-label="Remove [option label]"` — the × icon alone is not descriptive enough.
- Keyboard navigation inside the open list must be implemented manually (see the Keyboard Interactions table above).

**Combobox:**
- The text input needs `role="combobox"`, `aria-autocomplete="list"`, `aria-expanded`, and `aria-controls` pointing to the listbox `id`.
- Set `aria-activedescendant` to the `id` of the currently highlighted option so screen readers announce the active item as the user arrows through the list.
- Each `<li>` needs `role="option"`, a stable `id`, and `aria-selected`.
- The empty state li (`No matches found`) should not carry `role="option"` — it is informational, not selectable.

---

## Migration

Select-specific rows from the `_foundations.md` migration table, plus components with non-token color usage in their select/tag patterns:

| Current pattern | Replace with | Found in |
|----------------|-------------|----------|
| `border-gray-200`, `border-gray-300` on select | `border-[#C2BBD4]` (Border Strong) | PlanFormModal, GoalFormModal, TaskFormModal |
| `text-gray-500` on select labels | `text-[#8A80A8]` (Secondary) | PlanFormModal, GoalFormModal |
| `focus:ring-[#403770]` on select | `focus:ring-[#F37167]` (Coral) | GoalFormModal, PlanFormModal |
| `bg-[#48bb78]`, `bg-[#ed8936]` tag chips | `bg-[#F7F5FA]` chip bg with `text-[#403770]` | TagsEditor (`src/features/districts/components/TagsEditor.tsx`) |
| Tailwind gray chip backgrounds | `bg-[#F7F5FA]` (Surface Raised) | ServiceSelector (`src/features/plans/components/ServiceSelector.tsx`) |

---

## Codebase Examples

| Component | Variant | File |
|-----------|---------|------|
| GoalFormModal (status, metric type) | Native select | `src/features/goals/components/GoalFormModal.tsx` |
| PlanFormModal (district, region, owner) | Native select | `src/features/plans/components/PlanFormModal.tsx` |
| TaskFormModal (priority, status) | Native select | `src/features/tasks/components/TaskFormModal.tsx` |
| ActivityFormModal (activity type, outcome) | Native select | `src/features/activities/components/ActivityFormModal.tsx` |
| AccountForm (account type, state) | Native select | `src/features/map/components/panels/AccountForm.tsx` |
| FilterBar (status, type filters) | Multi-select pattern | `src/features/shared/components/FilterBar.tsx` |
| TagsEditor (district tags with create) | Multi-select-with-create | `src/features/districts/components/TagsEditor.tsx` |
| ServiceSelector (plan service types) | Multi-select | `src/features/plans/components/ServiceSelector.tsx` |
