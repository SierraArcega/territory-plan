# Lineup Visual Alignment & Associated Contacts Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Align the Lineup tab visually with the Activities tab, add a sortable table view with an Assignee column, replace chip filters with canonical MultiSelect dropdowns, and add an optional "Associated person" field to activities.

**Architecture:** Five sequential chunks: (1) build the standalone `MultiSelect` component with full tests; (2) update the Prisma schema and API to add `assignedTo`, `associatedUserId`, and `associatedContactId`; (3) extend `ActivitiesTable` with an optional Assignee column; (4) rework `LineupView` with visual alignment, table toggle, and MultiSelect filters; (5) add the associated person picker to `ActivityFormModal`.

**Tech Stack:** React 18, Tailwind CSS, Vitest + @testing-library/react, Prisma ORM, Next.js App Router, TypeScript

---

## Chunk 1: MultiSelect Component

**Files:**
- Create: `src/features/shared/components/MultiSelect.tsx`
- Create: `src/features/shared/components/__tests__/MultiSelect.test.tsx`

**Spec reference:** `docs/superpowers/specs/2026-03-14-multi-select-enhancements-design.md`

---

### Task 1: Write MultiSelect tests

- [ ] **Step 1: Create the test file**

Create `src/features/shared/components/__tests__/MultiSelect.test.tsx`:

```tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { MultiSelect } from "../MultiSelect";
import type { MultiSelectOption } from "../MultiSelect";

const OPTIONS: MultiSelectOption[] = [
  { value: "ca", label: "California" },
  { value: "tx", label: "Texas" },
  { value: "ny", label: "New York" },
  { value: "fl", label: "Florida" },
  { value: "wa", label: "Washington" },
];

function setup(props: Partial<React.ComponentProps<typeof MultiSelect>> = {}) {
  const onChange = vi.fn();
  const utils = render(
    <MultiSelect
      id="test"
      label="States"
      options={OPTIONS}
      selected={[]}
      onChange={onChange}
      placeholder="All States"
      countLabel="states"
      {...props}
    />
  );
  return { ...utils, onChange };
}

describe("MultiSelect — trigger label", () => {
  it("shows placeholder when nothing selected", () => {
    setup({ selected: [] });
    expect(screen.getByRole("button", { name: /All States/i })).toBeInTheDocument();
  });

  it("shows option label for 1 selected", () => {
    setup({ selected: ["ca"] });
    expect(screen.getByRole("button", { name: /California/i })).toBeInTheDocument();
  });

  it("shows comma-joined labels for 2 selected", () => {
    setup({ selected: ["ca", "tx"] });
    expect(screen.getByRole("button", { name: /California, Texas/i })).toBeInTheDocument();
  });

  it("shows comma-joined labels for 3 selected", () => {
    setup({ selected: ["ca", "tx", "ny"] });
    expect(screen.getByRole("button", { name: /California, Texas, New York/i })).toBeInTheDocument();
  });

  it("shows count label for 4+ selected", () => {
    setup({ selected: ["ca", "tx", "ny", "fl"] });
    expect(screen.getByRole("button", { name: /4 states/i })).toBeInTheDocument();
  });
});

describe("MultiSelect — open/close", () => {
  it("opens dropdown on trigger click", () => {
    setup();
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /All States/i }));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("closes dropdown on second trigger click", () => {
    setup();
    const trigger = screen.getByRole("button", { name: /All States/i });
    fireEvent.click(trigger);
    fireEvent.click(trigger);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("does not open when disabled", () => {
    setup({ disabled: true });
    fireEvent.click(screen.getByRole("button"));
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("MultiSelect — option selection", () => {
  it("calls onChange with added value when option clicked", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button", { name: /All States/i }));
    fireEvent.click(screen.getByRole("option", { name: /California/i }));
    expect(onChange).toHaveBeenCalledWith(["ca"]);
  });

  it("calls onChange with value removed when selected option clicked", () => {
    const { onChange } = setup({ selected: ["ca"] });
    fireEvent.click(screen.getByRole("button", { name: /California/i }));
    fireEvent.click(screen.getByRole("option", { name: /California/i }));
    expect(onChange).toHaveBeenCalledWith([]);
  });
});

describe("MultiSelect — search", () => {
  it("filters options by query", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "cal" } });
    expect(screen.getByRole("option", { name: /California/i })).toBeInTheDocument();
    expect(screen.queryByRole("option", { name: /Texas/i })).not.toBeInTheDocument();
  });

  it("shows no-results state when search has no matches", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "zzz" } });
    expect(screen.getByText(/No results/i)).toBeInTheDocument();
  });
});

describe("MultiSelect — Select All", () => {
  it("renders Select All row with count when open", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("checkbox", { name: /Select all 5/i })).toBeInTheDocument();
  });

  it("Select All hidden when search returns 0 results", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "zzz" } });
    expect(screen.queryByRole("checkbox", { name: /Select all/i })).not.toBeInTheDocument();
  });

  it("clicking Select All (unchecked) checks all filtered options", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    fireEvent.click(screen.getByRole("checkbox", { name: /Select all 5/i }));
    expect(onChange).toHaveBeenCalledWith(["ca", "tx", "ny", "fl", "wa"]);
  });

  it("clicking Select All (checked) unchecks all filtered options", () => {
    const { onChange } = setup({ selected: ["ca", "tx", "ny", "fl", "wa"] });
    fireEvent.click(screen.getByRole("button"));
    const selectAll = screen.getByRole("checkbox", { name: /Select all 5/i });
    expect(selectAll).toHaveAttribute("aria-checked", "true");
    fireEvent.click(selectAll);
    expect(onChange).toHaveBeenCalledWith([]);
  });

  it("Select All is indeterminate when some filtered options selected", () => {
    setup({ selected: ["ca"] });
    fireEvent.click(screen.getByRole("button"));
    const selectAll = screen.getByRole("checkbox", { name: /Select all 5/i });
    expect(selectAll).toHaveAttribute("aria-checked", "mixed");
  });

  it("Select All label adapts to search query", () => {
    setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    // "ali" matches only "California"
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "ali" } });
    expect(screen.getByRole("checkbox", { name: /Select 1 results/i })).toBeInTheDocument();
  });
});

describe("MultiSelect — keyboard navigation", () => {
  it("ArrowDown from initial state activates Select All (index 0)", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" });
    expect(screen.getByRole("checkbox", { name: /Select all/i })).toHaveClass("bg-[#EDE9F7]");
  });

  it("Escape closes when query is empty", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Escape" });
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });

  it("Escape clears query (not close) when query has text", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "cal" } });
    fireEvent.keyDown(input, { key: "Escape" });
    expect(input).toHaveValue("");
    expect(screen.getByRole("listbox")).toBeInTheDocument();
  });

  it("Enter on Select All (index 0) applies Select All logic", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    fireEvent.keyDown(input, { key: "ArrowDown" }); // → index 0 (Select All)
    fireEvent.keyDown(input, { key: "Enter" });
    expect(onChange).toHaveBeenCalledWith(["ca", "tx", "ny", "fl", "wa"]);
  });

  it("Enter at activeIndex -1 (no selection) is a no-op", () => {
    const { onChange } = setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    // Do NOT press ArrowDown — activeIndex stays at -1
    fireEvent.keyDown(screen.getByRole("textbox"), { key: "Enter" });
    expect(onChange).not.toHaveBeenCalled();
  });

  it("ArrowDown clamps at last option (index N)", () => {
    setup({ selected: [] });
    fireEvent.click(screen.getByRole("button"));
    const input = screen.getByRole("textbox");
    // N = 5 options; press down 6 times to go past the end: -1→0→1→2→3→4→5(clamp)
    for (let i = 0; i < 7; i++) fireEvent.keyDown(input, { key: "ArrowDown" });
    // Last option "Washington" (index 5) should have cursor class
    const options = screen.getAllByRole("option");
    expect(options[options.length - 1]).toHaveClass("bg-[#EDE9F7]");
  });

  it("outside click closes the dropdown", () => {
    setup();
    fireEvent.click(screen.getByRole("button"));
    expect(screen.getByRole("listbox")).toBeInTheDocument();
    fireEvent.mouseDown(document.body);
    expect(screen.queryByRole("listbox")).not.toBeInTheDocument();
  });
});

describe("MultiSelect — chips", () => {
  it("renders chips for selected values", () => {
    setup({ selected: ["ca", "tx"] });
    expect(screen.getByText("California")).toBeInTheDocument();
    expect(screen.getByText("Texas")).toBeInTheDocument();
  });

  it("chip remove button calls onChange without that value", () => {
    const { onChange } = setup({ selected: ["ca", "tx"] });
    fireEvent.click(screen.getByRole("button", { name: "Remove California" }));
    expect(onChange).toHaveBeenCalledWith(["tx"]);
  });

  it("chips hidden when disabled", () => {
    setup({ selected: ["ca"], disabled: true });
    expect(screen.queryByText("California")).not.toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to confirm they fail**

```bash
npx vitest run src/features/shared/components/__tests__/MultiSelect.test.tsx
```

Expected: `FAIL — cannot find module '../MultiSelect'`

---

### Task 2: Implement MultiSelect component

- [ ] **Step 3: Create `src/features/shared/components/MultiSelect.tsx`**

```tsx
"use client";

import { useState, useRef, useEffect, useMemo, useCallback } from "react";

export interface MultiSelectOption {
  value: string;
  label: string;
}

export interface MultiSelectProps {
  id: string;
  label: string;
  options: MultiSelectOption[];
  selected: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  countLabel?: string;
  searchPlaceholder?: string;
  disabled?: boolean;
}

type TriState = "unchecked" | "indeterminate" | "checked";

function getTriggerLabel(
  selected: string[],
  options: MultiSelectOption[],
  placeholder: string,
  countLabel: string
): string {
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
}

function getTriState(filtered: MultiSelectOption[], selected: string[]): TriState {
  if (filtered.length === 0) return "unchecked";
  const count = filtered.filter((o) => selected.includes(o.value)).length;
  if (count === 0) return "unchecked";
  if (count === filtered.length) return "checked";
  return "indeterminate";
}

export function MultiSelect({
  id,
  label,
  options,
  selected,
  onChange,
  placeholder = "Select...",
  countLabel = "items",
  searchPlaceholder = "Search...",
  disabled = false,
}: MultiSelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(-1);
  const containerRef = useRef<HTMLDivElement>(null);
  const searchRef = useRef<HTMLInputElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const selectAllRef = useRef<HTMLDivElement>(null);

  const filtered = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter((o) => o.label.toLowerCase().includes(q));
  }, [options, query]);

  const triState = getTriState(filtered, selected);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen]);

  // Auto-focus search on open and reset state
  useEffect(() => {
    if (isOpen) {
      setQuery("");
      setActiveIndex(-1);
      // setTimeout gives the panel time to mount before focusing
      setTimeout(() => searchRef.current?.focus(), 0);
    }
  }, [isOpen]);

  // Scroll active row into view when activeIndex changes
  useEffect(() => {
    if (activeIndex === 0) {
      selectAllRef.current?.scrollIntoView({ block: "nearest" });
    } else if (activeIndex >= 1) {
      optionRefs.current[activeIndex - 1]?.scrollIntoView({ block: "nearest" });
    }
  }, [activeIndex]);

  const handleToggleOption = useCallback(
    (value: string) => {
      if (selected.includes(value)) {
        onChange(selected.filter((v) => v !== value));
      } else {
        onChange([...selected, value]);
      }
    },
    [selected, onChange]
  );

  const handleSelectAll = useCallback(() => {
    if (filtered.length === 0) return;
    const filteredValues = filtered.map((o) => o.value);
    if (triState === "checked") {
      onChange(selected.filter((v) => !filteredValues.includes(v)));
    } else {
      const toAdd = filteredValues.filter((v) => !selected.includes(v));
      onChange([...selected, ...toAdd]);
    }
  }, [filtered, triState, selected, onChange]);

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    const N = filtered.length;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((prev) => (prev === -1 ? 0 : Math.min(prev + 1, N)));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((prev) => (prev <= 0 ? 0 : prev - 1));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (activeIndex === 0) handleSelectAll();
      else if (activeIndex >= 1 && activeIndex <= N) handleToggleOption(filtered[activeIndex - 1].value);
    } else if (e.key === "Escape") {
      if (query) {
        setQuery("");
        setActiveIndex(-1);
      } else {
        setIsOpen(false);
      }
    } else if (e.key === "Tab") {
      setIsOpen(false);
    }
  };

  const triggerLabel = getTriggerLabel(selected, options, placeholder, countLabel);

  const activeDescendant =
    activeIndex === 0
      ? `${id}-select-all`
      : activeIndex >= 1
      ? `${id}-option-${filtered[activeIndex - 1]?.value}`
      : undefined;

  const selectAllLabel = query.trim()
    ? `Select ${filtered.length} results`
    : `Select all ${options.length}`;

  return (
    <div ref={containerRef} className="relative">
      {/* Trigger */}
      <button
        type="button"
        onClick={() => !disabled && setIsOpen((v) => !v)}
        disabled={disabled}
        className={`h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] flex items-center gap-2 min-w-[120px] ${
          disabled ? "opacity-50 cursor-not-allowed pointer-events-none" : ""
        }`}
        aria-haspopup="listbox"
        aria-expanded={isOpen}
      >
        <span className="truncate flex-1 text-left">{triggerLabel}</span>
        <svg
          className={`w-4 h-4 flex-shrink-0 text-gray-400 transition-transform ${isOpen ? "rotate-180" : ""}`}
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
          aria-hidden="true"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Chips */}
      {!disabled && selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-1">
          {selected.map((value) => {
            const opt = options.find((o) => o.value === value);
            const chipLabel = opt?.label ?? value;
            return (
              <span
                key={value}
                className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]"
              >
                {chipLabel}
                <button
                  type="button"
                  onClick={() => onChange(selected.filter((v) => v !== value))}
                  className="text-[#A69DC0] hover:text-[#403770] transition-colors"
                  aria-label={`Remove ${chipLabel}`}
                >
                  ×
                </button>
              </span>
            );
          })}
        </div>
      )}

      {/* Dropdown panel */}
      {isOpen && (
        <div className="absolute z-10 mt-1 w-full min-w-[200px] bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden">
          {/* Search input — always auto-focused, no focus ring needed */}
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
            className="w-full px-3 py-2 text-sm border-b border-[#E2DEEC] bg-white text-[#403770] placeholder:text-[#A69DC0] focus:outline-none"
            aria-label="Search options"
            aria-controls={`${id}-listbox`}
            aria-activedescendant={activeDescendant}
          />

          {/* Select All row — hidden when 0 results */}
          {filtered.length > 0 && (
            <div
              ref={selectAllRef}
              id={`${id}-select-all`}
              role="checkbox"
              aria-checked={
                triState === "checked" ? true : triState === "indeterminate" ? "mixed" : false
              }
              aria-label={selectAllLabel}
              tabIndex={-1}
              onMouseDown={() => setActiveIndex(0)}
              onClick={handleSelectAll}
              className={`flex items-center gap-2 px-3 py-2 text-sm font-medium text-[#403770] border-b border-[#E2DEEC] cursor-pointer select-none ${
                activeIndex === 0 ? "bg-[#EDE9F7]" : "bg-[#FDFCFF] hover:bg-[#F7F5FA]"
              }`}
            >
              {/* Tri-state checkbox visual */}
              {triState === "unchecked" ? (
                <span
                  className="w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0"
                  aria-hidden="true"
                />
              ) : (
                <span
                  className="w-4 h-4 rounded border border-[#403770] bg-[#403770] flex items-center justify-center flex-shrink-0"
                  aria-hidden="true"
                >
                  {triState === "indeterminate" ? (
                    <svg viewBox="0 0 16 16" className="w-4 h-4">
                      <rect x="3" y="7.5" width="10" height="1" rx="0.5" fill="white" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" className="w-4 h-4">
                      <path
                        d="M3 8L6.5 11.5L13 5"
                        stroke="white"
                        strokeWidth="1.5"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  )}
                </span>
              )}
              {selectAllLabel}
            </div>
          )}

          {/* Scrollable option list */}
          <ul
            id={`${id}-listbox`}
            role="listbox"
            aria-multiselectable="true"
            aria-label={label}
            className="max-h-60 overflow-y-auto"
          >
            {filtered.length === 0 ? (
              <li className="px-3 py-2 text-sm text-[#A69DC0] italic">No results</li>
            ) : (
              filtered.map((opt, i) => {
                const isSelected = selected.includes(opt.value);
                const isCursor = activeIndex === i + 1;
                return (
                  <li
                    key={opt.value}
                    id={`${id}-option-${opt.value}`}
                    ref={(el) => {
                      optionRefs.current[i] = el;
                    }}
                    role="option"
                    aria-selected={isSelected}
                    onMouseDown={() => setActiveIndex(i + 1)}
                    onClick={() => handleToggleOption(opt.value)}
                    className={`flex items-center gap-2 px-3 py-2 text-sm text-[#403770] cursor-pointer select-none ${
                      isCursor ? "bg-[#EDE9F7]" : "hover:bg-[#F7F5FA]"
                    }`}
                  >
                    {isSelected ? (
                      <span
                        className="w-4 h-4 rounded border border-[#403770] bg-[#403770] flex items-center justify-center flex-shrink-0"
                        aria-hidden="true"
                        tabIndex={-1}
                      >
                        <svg viewBox="0 0 16 16" className="w-4 h-4">
                          <path
                            d="M3 8L6.5 11.5L13 5"
                            stroke="white"
                            strokeWidth="1.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                          />
                        </svg>
                      </span>
                    ) : (
                      <span
                        className="w-4 h-4 rounded border border-[#C2BBD4] bg-white flex-shrink-0"
                        aria-hidden="true"
                        tabIndex={-1}
                      />
                    )}
                    {opt.label}
                  </li>
                );
              })
            )}
          </ul>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 4: Run tests to verify they pass**

```bash
npx vitest run src/features/shared/components/__tests__/MultiSelect.test.tsx
```

Expected: all tests PASS

- [ ] **Step 5: Commit**

```bash
git add src/features/shared/components/MultiSelect.tsx src/features/shared/components/__tests__/MultiSelect.test.tsx
git commit -m "feat: add canonical MultiSelect component with full test coverage"
```

---

## Chunk 2: Data Model + API

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `src/features/shared/types/api-types.ts`
- Modify: `src/app/api/activities/route.ts`
- Modify: `src/app/api/activities/[id]/route.ts`

**Spec reference:** `docs/superpowers/specs/2026-03-15-lineup-visual-alignment-design.md` — Part 3 (Data Model, API Changes)

---

### Task 3: Update Prisma schema

- [ ] **Step 6: Add columns and relation to `prisma/schema.prisma`**

In the `Activity` model, after the `assignedToUserId` line, add:

```prisma
  // Associated person — a teammate or external contact involved but not the owner.
  // associatedUserId is a bare FK (no @relation) — consistent with assignedToUserId pattern.
  associatedUserId    String?  @map("associated_user_id") @db.Uuid
  // Contact.id is Int, not UUID.
  associatedContactId Int?     @map("associated_contact_id")
  associatedContact   Contact? @relation("ActivityAssociatedContact", fields: [associatedContactId], references: [id], onDelete: SetNull)
```

In the `Activity` model `@@index` block, add:

```prisma
  @@index([associatedUserId])
  @@index([associatedContactId])
```

In the `Contact` model, after the existing `activityLinks ActivityContact[]` line, add:

```prisma
  associatedActivities Activity[] @relation("ActivityAssociatedContact")
```

- [ ] **Step 7: Generate and apply migration**

```bash
npx prisma migrate dev --name add_activity_associated_person
```

Expected: migration created and applied, Prisma client regenerated. If running against Supabase (not local), copy the generated SQL from `prisma/migrations/<timestamp>_add_activity_associated_person/migration.sql` and run it in the Supabase SQL editor.

- [ ] **Step 8: Verify schema compiles**

```bash
npx prisma validate
```

Expected: no errors

---

### Task 4: Update ActivityListItem type

- [ ] **Step 9: Add `assignedTo`, `associatedUser`, `associatedContact` to `ActivityListItem` in `src/features/shared/types/api-types.ts`**

Find the `ActivityListItem` interface and add three fields after `assignedToUserId`:

```ts
export interface ActivityListItem {
  id: string;
  type: ActivityType;
  category: ActivityCategory;
  title: string;
  startDate: string | null;
  endDate: string | null;
  status: ActivityStatus;
  source: "manual" | "calendar_sync";
  outcomeType: string | null;
  assignedToUserId: string | null;
  // Resolved user object for the assignee — populated by the API layer.
  assignedTo: { id: string; fullName: string | null; avatarUrl: string | null } | null;
  // Optional single associated person — either an internal user or external contact.
  associatedUser: { id: string; fullName: string | null; avatarUrl: string | null } | null;
  associatedContact: { id: number; name: string } | null;
  needsPlanAssociation: boolean;
  hasUnlinkedDistricts: boolean;
  planCount: number;
  districtCount: number;
  stateAbbrevs: string[];
}
```

---

### Task 5: Update GET /api/activities to resolve new fields

- [ ] **Step 10: Update `src/app/api/activities/route.ts`**

**5a.** In the `prisma.activity.findMany` `select` block (around line 114), add four new fields after `assignedToUserId: true`. Note: `assignedToUserId` is a bare FK with no Prisma `@relation` — there is no `assignedToUser` relation to select. User resolution happens via a batch lookup below.

```ts
          assignedToUserId: true,
          associatedUserId: true,
          associatedContactId: true,
          // associatedContact has a @relation so Prisma can resolve it here directly
          associatedContact: {
            select: { id: true, name: true },
          },
```

To resolve `assignedTo` and `associatedUser`, batch-load user profiles after the main query. Add this block after the `planDistricts` query (around line 150):

```ts
    // Batch-load user profiles needed for assignedTo and associatedUser resolution.
    // Using a Set to avoid duplicate lookups.
    const userIdSet = new Set<string>();
    for (const a of activities) {
      if (a.assignedToUserId) userIdSet.add(a.assignedToUserId);
      if (a.associatedUserId) userIdSet.add(a.associatedUserId);
    }
    const userIds = Array.from(userIdSet);
    const userProfiles =
      userIds.length > 0
        ? await prisma.userProfile.findMany({
            where: { id: { in: userIds } },
            select: { id: true, fullName: true, avatarUrl: true },
          })
        : [];
    const userProfileMap = new Map(userProfiles.map((u) => [u.id, u]));
```

**5b.** In the `transformed` map (around line 177), update the return object to include the three new fields:

```ts
          assignedToUserId: activity.assignedToUserId ?? null,
          assignedTo: activity.assignedToUserId
            ? (userProfileMap.get(activity.assignedToUserId) ?? null)
            : null,
          associatedUser: activity.associatedUserId
            ? (userProfileMap.get(activity.associatedUserId) ?? null)
            : null,
          associatedContact: activity.associatedContact
            ? { id: activity.associatedContact.id, name: activity.associatedContact.name }
            : null,
```

---

### Task 6: Update POST /api/activities

- [ ] **Step 10b: Update `src/app/api/activities/route.ts` — POST handler**

In the POST body destructuring (around line 238), add the two new optional fields:

```ts
    const {
      type, title, notes, startDate, endDate, status = "planned",
      assignedToUserId = user.id,
      planIds = [], districtLeaids = [], contactIds = [], stateFips = [],
      associatedUserId = null,
      associatedContactId = null,
    } = body;
```

In the `prisma.activity.create` `data` block, add:

```ts
        associatedUserId: associatedUserId ?? null,
        associatedContactId: associatedContactId ?? null,
```

The POST response returns the full created activity. Add `associatedUser` and `associatedContact` resolution to the response. After `pushActivityToCalendar`, resolve using the same batch-lookup pattern if needed, or resolve inline:

```ts
    // Resolve associated user for response
    const associatedUserProfile = associatedUserId
      ? await prisma.userProfile.findUnique({
          where: { id: associatedUserId },
          select: { id: true, fullName: true, avatarUrl: true },
        })
      : null;
```

Then include in the returned JSON:

```ts
      associatedUser: associatedUserProfile ?? null,
      associatedContact: associatedContactId
        ? { id: activity.associatedContact?.id, name: activity.associatedContact?.name }
        : null,
```

Note: the POST response shape is used internally by `ActivityFormModal` after create. If the modal does not use `associatedUser`/`associatedContact` from the POST response (it closes after create), these fields can be omitted from the response for now — only the GET list response needs them for the table view.

---

### Task 7: Update PATCH /api/activities/[id]

- [ ] **Step 11: Update `src/app/api/activities/[id]/route.ts` — PATCH handler**

In the body destructuring (around line 166), add the two new fields:

```ts
    const { type, title, notes, startDate, endDate, status, outcome, outcomeType, assignedToUserId, planIds, stateFips, associatedUserId, associatedContactId } = body;
```

In the `prisma.activity.update` `data` block (after the `assignedToUserId` line), add:

```ts
        ...(associatedUserId !== undefined && { associatedUserId: associatedUserId ?? null }),
        ...(associatedContactId !== undefined && { associatedContactId: associatedContactId ?? null }),
```

The PATCH response does not need to return the full `ActivityListItem` shape (it returns a minimal object). No change needed to the response shape.

- [ ] **Step 12: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors (or only pre-existing errors unrelated to this change)

- [ ] **Step 13: Commit**

```bash
git add prisma/schema.prisma prisma/migrations/ src/features/shared/types/api-types.ts src/app/api/activities/route.ts src/app/api/activities/[id]/route.ts
git commit -m "feat: add assignedTo, associatedUserId, associatedContactId to Activity schema and API"
```

---

## Chunk 3: ActivitiesTable Assignee Column

**Files:**
- Modify: `src/features/plans/components/ActivitiesTable.tsx`

**Spec reference:** `docs/superpowers/specs/2026-03-15-lineup-visual-alignment-design.md` — Part 2 (Assignee Column)

---

### Task 7: Add Assignee column to ActivitiesTable

- [ ] **Step 14: Write a failing test for Assignee column**

Add a new test file `src/features/plans/components/__tests__/ActivitiesTable.assignee.test.tsx`:

```tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ActivitiesTable from "../ActivitiesTable";
import type { ActivityListItem } from "@/features/shared/types/api-types";

function makeActivity(overrides: Partial<ActivityListItem> = {}): ActivityListItem {
  return {
    id: "act-1",
    type: "call",
    category: "outreach",
    title: "Test Call",
    startDate: "2026-03-15T09:00:00.000Z",
    endDate: null,
    status: "planned",
    source: "manual",
    outcomeType: null,
    assignedToUserId: null,
    assignedTo: null,
    associatedUser: null,
    associatedContact: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 0,
    districtCount: 0,
    stateAbbrevs: [],
    ...overrides,
  };
}

describe("ActivitiesTable — Assignee column", () => {
  it("does not render Assignee column when showAssignee is false (default)", () => {
    render(
      <ActivitiesTable
        activities={[makeActivity()]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
      />
    );
    expect(screen.queryByRole("columnheader", { name: /Assignee/i })).not.toBeInTheDocument();
  });

  it("renders Assignee column header when showAssignee is true", () => {
    render(
      <ActivitiesTable
        activities={[makeActivity()]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        showAssignee
      />
    );
    expect(screen.getByRole("columnheader", { name: /Assignee/i })).toBeInTheDocument();
  });

  it("shows em dash when activity has no assignee", () => {
    render(
      <ActivitiesTable
        activities={[makeActivity({ assignedTo: null })]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        showAssignee
      />
    );
    // The em dash cell should exist
    expect(screen.getByText("—")).toBeInTheDocument();
  });

  it("shows assignee full name when assignedTo is set", () => {
    render(
      <ActivitiesTable
        activities={[
          makeActivity({
            assignedTo: { id: "u-1", fullName: "Alice Smith", avatarUrl: null },
          }),
        ]}
        onEdit={vi.fn()}
        onDelete={vi.fn()}
        showAssignee
      />
    );
    expect(screen.getByText("Alice Smith")).toBeInTheDocument();
  });

  it("null-assignee rows sort after named rows in both asc and desc", () => {
    // The assignee comparator must put null last regardless of direction.
    // We test this by checking the rendered row order after clicking the Assignee header.
    const activities = [
      makeActivity({ id: "a1", title: "No Assignee", assignedTo: null }),
      makeActivity({ id: "a2", title: "Alice", assignedTo: { id: "u1", fullName: "Alice", avatarUrl: null } }),
    ];
    render(
      <ActivitiesTable activities={activities} onEdit={vi.fn()} onDelete={vi.fn()} showAssignee />
    );
    // Click Assignee header to sort ascending
    fireEvent.click(screen.getByRole("columnheader", { name: /Assignee/i }));
    const rows = screen.getAllByRole("row").slice(1); // skip header
    // "Alice" (named) should appear before "No Assignee" (null) in asc
    expect(rows[0]).toHaveTextContent("Alice");
    expect(rows[1]).toHaveTextContent("No Assignee");

    // Click again for descending — null still last
    fireEvent.click(screen.getByRole("columnheader", { name: /Assignee/i }));
    const rowsDesc = screen.getAllByRole("row").slice(1);
    expect(rowsDesc[0]).toHaveTextContent("Alice");
    expect(rowsDesc[1]).toHaveTextContent("No Assignee");
  });
});
```

- [ ] **Step 15: Run test to confirm it fails**

```bash
npx vitest run src/features/plans/components/__tests__/ActivitiesTable.assignee.test.tsx
```

Expected: FAIL — `showAssignee` prop not in interface, Assignee column doesn't exist

- [ ] **Step 16: Update `src/features/plans/components/ActivitiesTable.tsx`**

**16a.** Add `showAssignee` to the props interface (around line 28):

```ts
interface ActivitiesTableProps {
  activities: ActivityListItem[];
  onEdit: (activity: ActivityListItem) => void;
  onDelete: (activityId: string) => void;
  isDeleting?: boolean;
  showAssignee?: boolean;
}
```

**16b.** Destructure it in the function signature (around line 115):

```ts
export default function ActivitiesTable({
  activities,
  onEdit,
  onDelete,
  isDeleting = false,
  showAssignee = false,
}: ActivitiesTableProps) {
```

**16c.** Add an assignee comparator to `activityComparators`. Open the existing `activityComparators` object and add this entry **inside** it, after the `startDate` entry and before the closing `}`:

```ts
  assignee: (a, b, dir) => {
    const aName = a.assignedTo?.fullName ?? null;
    const bName = b.assignedTo?.fullName ?? null;
    // Nulls sort last in both directions
    if (!aName && !bName) return 0;
    if (!aName) return 1;
    if (!bName) return -1;
    const r = aName.localeCompare(bName);
    return dir === "desc" ? -r : r;
  },
```

**16d.** Update column widths in the `<thead>`. Replace the existing five `SortHeader` + scope `<th>` elements with the conditional-assignee version:

```tsx
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th
                className="w-[28px] px-2 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider"
                aria-label="Icon"
              />
              <SortHeader
                field="title"
                label="Title"
                sortState={sortState}
                onSort={onSort}
                className={showAssignee ? "w-[25%]" : "w-[30%]"}
              />
              <SortHeader
                field="type"
                label="Type"
                sortState={sortState}
                onSort={onSort}
                className={showAssignee ? "w-[12%]" : "w-[15%]"}
              />
              {showAssignee && (
                <SortHeader
                  field="assignee"
                  label="Assignee"
                  sortState={sortState}
                  onSort={onSort}
                  className="w-[13%]"
                />
              )}
              <SortHeader
                field="status"
                label="Status"
                sortState={sortState}
                onSort={onSort}
                className="w-[12%]"
              />
              <SortHeader
                field="startDate"
                label="Date"
                sortState={sortState}
                onSort={onSort}
                className={showAssignee ? "w-[17%]" : "w-[18%]"}
              />
              <th className={`${showAssignee ? "w-[11%]" : "w-[15%]"} px-2 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider`}>
                Scope
              </th>
              <th className="w-20 px-3 py-3" />
            </tr>
```

**16e.** In the `<tbody>` row, add the conditional Assignee cell after the Type cell (around line 290, after the type `<td>`):

```tsx
                  {/* Assignee (conditional) */}
                  {showAssignee && (
                    <td className="px-2 py-1.5">
                      {activity.assignedTo ? (
                        <div className="flex items-center gap-1.5 min-w-0">
                          {activity.assignedTo.avatarUrl ? (
                            <img
                              src={activity.assignedTo.avatarUrl}
                              alt=""
                              className="w-5 h-5 rounded-full object-cover flex-shrink-0"
                            />
                          ) : (
                            <span className="w-5 h-5 rounded-full bg-[#403770] text-white text-[9px] flex items-center justify-center font-semibold flex-shrink-0">
                              {(activity.assignedTo.fullName ?? "?")
                                .split(" ")
                                .map((p) => p[0])
                                .join("")
                                .slice(0, 2)
                                .toUpperCase()}
                            </span>
                          )}
                          <span className="text-[13px] text-gray-700 truncate">
                            {activity.assignedTo.fullName ?? "—"}
                          </span>
                        </div>
                      ) : (
                        <span className="text-[13px] text-gray-400">—</span>
                      )}
                    </td>
                  )}
```

- [ ] **Step 17: Run tests to verify they pass**

```bash
npx vitest run src/features/plans/components/__tests__/ActivitiesTable.assignee.test.tsx
```

Expected: all tests PASS

- [ ] **Step 18: Commit**

```bash
git add src/features/plans/components/ActivitiesTable.tsx src/features/plans/components/__tests__/ActivitiesTable.assignee.test.tsx
git commit -m "feat: add optional Assignee column to ActivitiesTable (showAssignee prop)"
```

---

## Chunk 4: LineupView — Visual Alignment + Table Toggle

**Files:**
- Modify: `src/features/lineup/components/LineupView.tsx`

**Spec reference:** `docs/superpowers/specs/2026-03-15-lineup-visual-alignment-design.md` — Parts 1 and 2

---

### Task 8: Rework LineupView

This task has no unit tests (layout/visual changes are validated by manual review), but TypeScript must compile cleanly.

- [ ] **Step 19: Remove dead handler functions from `src/features/lineup/components/LineupView.tsx`**

The existing `togglePlanFilter` and `toggleStateFilter` functions are replaced by the `MultiSelect` `onChange` callbacks. Delete both functions to avoid `noUnusedLocals` TypeScript errors:

```ts
// DELETE these two functions entirely:
// const togglePlanFilter = (planId: string) => { ... }
// const toggleStateFilter = (state: string) => { ... }
```

- [ ] **Step 20: Update imports in `src/features/lineup/components/LineupView.tsx`**

Add to imports:

```ts
import { useDeleteActivity } from "@/features/activities/lib/queries";
import ActivitiesTable from "@/features/plans/components/ActivitiesTable";
import { MultiSelect } from "@/features/shared/components/MultiSelect";
import type { MultiSelectOption } from "@/features/shared/components/MultiSelect";
```

- [ ] **Step 21: Add view toggle state and delete handler**

After the existing `const [isCreating, setIsCreating] = useState(false);` line, add:

```ts
  // "timeline" is the default view — table is the second option
  const [viewMode, setViewMode] = useState<"timeline" | "table">("timeline");

  const deleteActivity = useDeleteActivity();

  const handleDeleteActivity = async (activityId: string) => {
    if (confirm("Are you sure you want to delete this activity?")) {
      await deleteActivity.mutateAsync(activityId);
    }
  };
```

- [ ] **Step 22: Convert plan/state filter state to work with MultiSelect**

The existing plan filter uses `selectedPlanIds: string[]` and state filter uses `selectedStates: string[]`. These are already the right shape for `MultiSelect` — no state changes needed. Build option arrays for the dropdowns:

After the `availableStates` useMemo, add:

```ts
  // Option arrays for MultiSelect dropdowns
  const planOptions: MultiSelectOption[] = plans.map((p) => ({
    value: p.id,
    label: p.name,
  }));

  const stateOptions: MultiSelectOption[] = availableStates.map((s) => ({
    value: s,
    label: s,
  }));
```

- [ ] **Step 23: Replace the full JSX return**

Replace the entire `return (...)` block with the following. This implements visual alignment, the new toolbar structure, MultiSelect filters, timeline/table toggle, and table mode rendering:

```tsx
  return (
    <div className="h-full flex flex-col bg-[#FFFCFA]">

      {/* ── Header: title + date nav + person selector ── */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-4 mb-1">
          <button
            onClick={() => setSelectedDate(addDays(selectedDate, -1))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Previous day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>

          <div className="flex-1">
            <div className="flex items-baseline gap-3">
              <h1 className="text-xl font-bold text-[#403770]">The Lineup</h1>
              {isToday && (
                <span className="text-xs font-medium px-2 py-0.5 rounded-full bg-[#403770] text-white">
                  Today
                </span>
              )}
            </div>
            <p className="text-sm text-gray-500 mt-0.5">
              {weekday}, {date}
            </p>
          </div>

          <button
            onClick={() => setSelectedDate(addDays(selectedDate, 1))}
            className="p-1.5 rounded-lg text-gray-400 hover:text-gray-600 hover:bg-gray-100 transition-colors"
            aria-label="Next day"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        {/* Person selector */}
        <div className="flex items-center gap-2 mt-3 flex-wrap">
          {selectedUserIds.map((uid) => (
            <UserChip
              key={uid}
              userId={uid}
              users={users}
              isCurrentUser={uid === profile?.id}
              onRemove={handleRemoveUser}
            />
          ))}

          {addableUsers.length > 0 && (
            <div className="relative" ref={userPickerRef}>
              <button
                onClick={() => setShowUserPicker((v) => !v)}
                className="flex items-center gap-1 px-2.5 py-1 rounded-full border border-dashed border-gray-300 text-gray-400 hover:border-[#403770] hover:text-[#403770] text-sm transition-colors"
              >
                <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                </svg>
                Add person
              </button>

              {showUserPicker && (
                <div className="absolute top-full left-0 mt-1 w-56 bg-white rounded-lg shadow-lg border border-gray-200 z-10 py-1 max-h-48 overflow-y-auto">
                  {addableUsers.map((u) => (
                    <button
                      key={u.id}
                      onClick={() => handleAddUser(u.id)}
                      className="w-full flex items-center gap-2 px-3 py-2 hover:bg-gray-50 text-left transition-colors"
                    >
                      {u.avatarUrl ? (
                        <img src={u.avatarUrl} alt="" className="w-6 h-6 rounded-full object-cover flex-shrink-0" />
                      ) : (
                        <span className="w-6 h-6 rounded-full bg-[#403770] text-white text-[10px] flex items-center justify-center font-semibold flex-shrink-0">
                          {getUserInitials(u.fullName, u.email)}
                        </span>
                      )}
                      <span className="text-sm text-gray-700 truncate">{u.fullName || u.email}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </header>

      {/* ── Toolbar ── */}
      <div className="bg-white border-b border-gray-200 px-6 py-3 flex items-center gap-3 flex-wrap">
        {/* New Activity */}
        <button
          onClick={() => setIsCreating(true)}
          className="inline-flex items-center gap-1.5 h-9 px-4 text-sm font-medium text-white bg-[#403770] rounded-md hover:bg-[#322a5a] transition-colors"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
          </svg>
          New Activity
        </button>

        <div className="w-px h-5 bg-gray-200" />

        {/* Group-by toggle — hidden in table mode */}
        {viewMode === "timeline" && (
          <div className="flex items-center gap-1">
            <span className="text-xs text-gray-500 mr-1">Group by</span>
            {GROUP_BY_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => setGroupBy(opt.value)}
                className={`px-2.5 py-1 text-xs font-medium rounded-md transition-colors ${
                  groupBy === opt.value
                    ? "bg-[#403770] text-white"
                    : "text-gray-500 hover:bg-gray-100"
                }`}
              >
                {opt.label}
              </button>
            ))}
            <div className="w-px h-5 bg-gray-200 ml-1" />
          </div>
        )}

        {/* Plan MultiSelect filter */}
        {planOptions.length > 0 && (
          <MultiSelect
            id="lineup-plan-filter"
            label="Plans"
            options={planOptions}
            selected={selectedPlanIds}
            onChange={setSelectedPlanIds}
            placeholder="All Plans"
            countLabel="plans"
            searchPlaceholder="Search plans..."
          />
        )}

        {/* State MultiSelect filter */}
        {stateOptions.length > 0 && (
          <MultiSelect
            id="lineup-state-filter"
            label="States"
            options={stateOptions}
            selected={selectedStates}
            onChange={setSelectedStates}
            placeholder="All States"
            countLabel="states"
            searchPlaceholder="Search states..."
          />
        )}

        {/* Clear filters */}
        {(selectedPlanIds.length > 0 || selectedStates.length > 0) && (
          <button
            onClick={() => {
              setSelectedPlanIds([]);
              setSelectedStates([]);
            }}
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors"
          >
            Clear filters
          </button>
        )}

        <div className="flex-1" />

        {/* Timeline / Table toggle */}
        <div className="flex items-center border border-gray-200 rounded-md overflow-hidden">
          <button
            onClick={() => setViewMode("timeline")}
            className={`p-2 transition-colors ${
              viewMode === "timeline"
                ? "bg-[#403770] text-white"
                : "bg-white text-gray-500 hover:text-[#403770]"
            }`}
            title="Timeline view"
            aria-label="Timeline view"
          >
            {/* List icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 10h16M4 14h16M4 18h16" />
            </svg>
          </button>
          <button
            onClick={() => setViewMode("table")}
            className={`p-2 transition-colors ${
              viewMode === "table"
                ? "bg-[#403770] text-white"
                : "bg-white text-gray-500 hover:text-[#403770]"
            }`}
            title="Table view"
            aria-label="Table view"
          >
            {/* Table icon */}
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 10h18M3 14h18M10 4v16M3 4h18a1 1 0 011 1v14a1 1 0 01-1 1H3a1 1 0 01-1-1V5a1 1 0 011-1z" />
            </svg>
          </button>
        </div>
      </div>

      {/* ── Content area ── */}
      <div className="flex-1 overflow-y-auto px-6 py-4">
        {/* Suggestions banner — only in timeline mode when viewing today */}
        {viewMode === "timeline" && (
          <SuggestionsBanner
            date={selectedDate}
            activityCount={myTodayActivityCount}
          />
        )}

        {isLoading ? (
          <div className="flex items-center justify-center h-32 text-gray-400 text-sm">
            Loading activities...
          </div>
        ) : filteredActivities.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-48 text-center">
            <p className="text-gray-400 text-sm">No activities for this day.</p>
            <button
              onClick={() => setIsCreating(true)}
              className="mt-3 text-sm text-[#403770] hover:underline"
            >
              Add one
            </button>
          </div>
        ) : viewMode === "table" ? (
          <ActivitiesTable
            activities={filteredActivities}
            onEdit={handleOpenEdit}
            onDelete={handleDeleteActivity}
            isDeleting={deleteActivity.isPending}
            showAssignee
          />
        ) : (
          <div className="space-y-6">
            {groups.map((group) => (
              <div key={group.key}>
                <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                  {group.label}
                </h3>
                <div className="space-y-2">
                  {group.activities.map((activity) => (
                    <ActivityRow
                      key={activity.id}
                      activity={activity}
                      onOpen={handleOpenEdit}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* ── Modal ── */}
      <ActivityFormModal
        isOpen={isCreating || !!editingActivity}
        onClose={handleCloseModal}
        initialData={editingActivity}
        defaultPlanId={undefined}
      />
    </div>
  );
```

- [ ] **Step 24: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 25: Commit**

```bash
git add src/features/lineup/components/LineupView.tsx
git commit -m "feat: lineup visual alignment, table/timeline toggle, MultiSelect filters"
```

---

## Chunk 5: ActivityFormModal — Associated Person Picker

**Files:**
- Modify: `src/features/activities/components/ActivityFormModal.tsx`

**Spec reference:** `docs/superpowers/specs/2026-03-15-lineup-visual-alignment-design.md` — Part 3 (UI)

---

### Task 9: Add associated person picker to ActivityFormModal

- [ ] **Step 26: Explore the current ActivityFormModal structure**

Read `src/features/activities/components/ActivityFormModal.tsx` to find:
- Where the Assignee ("Owner") field is rendered
- The existing state variable naming conventions
- How `useUsers()` is used

- [ ] **Step 27: Add state and data hooks for the picker**

After the existing assignee state, add:

```ts
  // Associated person picker state
  const [associatedUserId, setAssociatedUserId] = useState<string | null>(null);
  const [associatedContactId, setAssociatedContactId] = useState<number | null>(null);
  const [assocQuery, setAssocQuery] = useState("");
  const [assocOpen, setAssocOpen] = useState(false);
  const assocRef = useRef<HTMLDivElement>(null);

  // Mount-time check: does the system have any contacts at all?
  const { data: allContactsData } = useContacts({});
  const hasAnyContacts = (allContactsData?.total ?? 0) > 0;

  // Debounced contact search — fires 300ms after query reaches 2+ chars.
  // Resets to "" when query drops below 2 so stale queries don't persist.
  const [debouncedAssocQuery, setDebouncedAssocQuery] = useState("");
  useEffect(() => {
    if (assocQuery.length < 2) {
      setDebouncedAssocQuery("");
      return;
    }
    const t = setTimeout(() => setDebouncedAssocQuery(assocQuery), 300);
    return () => clearTimeout(t);
  }, [assocQuery]);

  const { data: assocContactsData, isLoading: assocContactsLoading, isError: assocContactsError } =
    useContacts(debouncedAssocQuery.length >= 2 ? { search: debouncedAssocQuery } : {});

  // Track last non-empty results so we can show them when query < 2 chars.
  // ContactsResponse is the return type of useContacts — import it explicitly.
  const lastAssocContactsRef = useRef<ContactsResponse | undefined>(undefined);
  useEffect(() => {
    if (assocContactsData?.contacts.length) {
      lastAssocContactsRef.current = assocContactsData;
    }
  }, [assocContactsData]);

  const displayedContacts =
    assocQuery.length >= 2
      ? assocContactsData?.contacts ?? lastAssocContactsRef.current?.contacts ?? []
      : lastAssocContactsRef.current?.contacts ?? [];
```

Add `useContacts` and `ContactsResponse` to the imports at the top of the file.

Note: `ActivityFormModal` imports all other hooks from `@/lib/api`. Check whether `@/lib/api` re-exports `useContacts` (search for `useContacts` in `src/lib/api.ts`). If it does, import from there for consistency. If not, import directly:

```ts
import { useContacts } from "@/lib/api"; // use this if @/lib/api re-exports useContacts
// OR: import { useContacts } from "@/features/shared/lib/queries";
import type { ContactsResponse } from "@/features/shared/types/api-types";
```

Add close-on-outside-click for the picker:

```ts
  useEffect(() => {
    if (!assocOpen) return;
    const handler = (e: MouseEvent) => {
      if (assocRef.current && !assocRef.current.contains(e.target as Node)) {
        setAssocOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [assocOpen]);
```

Pre-populate from `initialData` in edit mode. There are two `useEffect` blocks that run when the modal opens:

1. The **first effect** (guarded by `isOpen`, reads from `initialData` / `ActivityListItem`) — this is where the new fields go, since `associatedUser` and `associatedContact` are now part of `ActivityListItem`.
2. The **second effect** (guarded by `fullActivity`, reads from the full `useActivity` fetch) — leave this unchanged.

In the **first effect**, inside the `if (initialData)` branch alongside `setAssignedToUserId`, add:

```ts
    setAssociatedUserId(initialData.associatedUser?.id ?? null);
    setAssociatedContactId(initialData.associatedContact?.id ?? null);
```

In the same effect's **`else` (create mode) branch** (where other fields are reset to empty), also reset the new state:

```ts
    setAssociatedUserId(null);
    setAssociatedContactId(null);
    setAssocQuery("");
    setAssocOpen(false);
```

- [ ] **Step 28: Add the picker field in the JSX**

Locate the Assignee field in the JSX (the "Owner" field). Below it, add the Associated Person field:

```tsx
          {/* Associated person */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Associated person
            </label>
            <div ref={assocRef} className="relative">
              {/* Show chip if selection made */}
              {(associatedUserId || associatedContactId) ? (
                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1 px-2 py-0.5 bg-[#F7F5FA] rounded-full text-xs text-[#403770]">
                    {associatedUserId
                      ? (users.find((u) => u.id === associatedUserId)?.fullName ?? "Team member")
                      : (lastAssocContactsRef.current?.contacts.find((c) => c.id === associatedContactId)?.name ?? "Contact")}
                    <button
                      type="button"
                      onClick={() => { setAssociatedUserId(null); setAssociatedContactId(null); }}
                      className="text-[#A69DC0] hover:text-[#403770] transition-colors"
                      aria-label="Remove associated person"
                    >
                      ×
                    </button>
                  </span>
                </div>
              ) : (
                <input
                  type="text"
                  value={assocQuery}
                  onChange={(e) => { setAssocQuery(e.target.value); setAssocOpen(true); }}
                  onFocus={() => setAssocOpen(true)}
                  placeholder="Add a contact or teammate"
                  className="w-full h-9 px-3 text-sm border border-gray-200 rounded-md focus:outline-none focus:ring-2 focus:ring-[#F37167] focus:border-transparent bg-white text-[#403770] placeholder:text-gray-400"
                />
              )}

              {/* Dropdown */}
              {assocOpen && !associatedUserId && !associatedContactId && (
                <div className="absolute z-10 mt-1 w-full bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden max-h-72 overflow-y-auto">
                  {/* Team section */}
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100">
                    Team
                  </div>
                  {(users ?? [])
                    .filter((u) =>
                      !assocQuery ||
                      (u.fullName ?? u.email).toLowerCase().includes(assocQuery.toLowerCase())
                    )
                    .map((u) => (
                      <button
                        key={u.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()} // prevent blur before click
                        onClick={() => {
                          setAssociatedUserId(u.id);
                          setAssociatedContactId(null);
                          setAssocOpen(false);
                          setAssocQuery("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F7F5FA] text-left"
                      >
                        {u.avatarUrl ? (
                          <img src={u.avatarUrl} alt="" className="w-5 h-5 rounded-full object-cover flex-shrink-0" />
                        ) : (
                          <span className="w-5 h-5 rounded-full bg-[#403770] text-white text-[9px] flex items-center justify-center font-semibold flex-shrink-0">
                            {getUserInitials(u.fullName, u.email)}
                          </span>
                        )}
                        <span className="text-sm text-[#403770] truncate">{u.fullName || u.email}</span>
                      </button>
                    ))}

                  {/* Contacts section */}
                  <div className="px-3 py-1.5 text-[11px] font-semibold text-gray-400 uppercase tracking-wider bg-gray-50 border-b border-gray-100 border-t border-gray-100">
                    Contacts
                  </div>
                  {assocContactsLoading ? (
                    <div className="px-3 py-2">
                      <div className="h-8 animate-pulse bg-gray-100 rounded" />
                    </div>
                  ) : assocContactsError ? (
                    <p className="px-3 py-2 text-sm text-red-400">Couldn&apos;t load contacts</p>
                  ) : !hasAnyContacts ? (
                    <p className="px-3 py-2 text-sm text-[#A69DC0] italic">No contacts yet</p>
                  ) : displayedContacts.length === 0 ? (
                    <p className="px-3 py-2 text-sm text-[#A69DC0] italic">No contacts match</p>
                  ) : (
                    displayedContacts.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={() => {
                          setAssociatedContactId(c.id);
                          setAssociatedUserId(null);
                          setAssocOpen(false);
                          setAssocQuery("");
                        }}
                        className="w-full flex items-center gap-2 px-3 py-2 hover:bg-[#F7F5FA] text-left"
                      >
                        <span className="w-5 h-5 text-gray-400 flex-shrink-0 flex items-center justify-center">
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
                          </svg>
                        </span>
                        <div className="min-w-0">
                          <p className="text-sm text-[#403770] truncate">{c.name}</p>
                          {c.districtName && (
                            <p className="text-xs text-gray-400 truncate">{c.districtName}</p>
                          )}
                        </div>
                      </button>
                    ))
                  )}
                </div>
              )}
            </div>
          </div>
```

Note: `getUserInitials` is already defined in `LineupView.tsx` but not `ActivityFormModal.tsx`. Add a local copy of it at the top of the file:

```ts
function getUserInitials(fullName: string | null, email: string): string {
  if (fullName) {
    const parts = fullName.trim().split(" ");
    return parts.length >= 2
      ? `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
      : parts[0].slice(0, 2).toUpperCase();
  }
  return email.slice(0, 2).toUpperCase();
}
```

- [ ] **Step 29: Include `associatedUserId` and `associatedContactId` in the submit payload**

Find the `handleSubmit` function. In the body sent to the API (both create and edit paths), add:

```ts
      associatedUserId: associatedUserId ?? null,
      associatedContactId: associatedContactId ?? null,
```

- [ ] **Step 30: Check TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors

- [ ] **Step 31: Manually test the picker in the browser**

- Open the app, click "New Activity"
- Verify "Associated person" field appears below Assignee
- Type a name — verify Team section filters immediately
- Type 2+ chars — verify Contacts section updates after ~300ms
- Select a team member → chip appears, clearing shows selection was stored
- Click × on chip → field resets to empty search input
- Submit — verify the API call includes `associatedUserId`/`associatedContactId`
- Edit the same activity → verify the picker pre-populates with the saved selection

- [ ] **Step 32: Commit**

```bash
git add src/features/activities/components/ActivityFormModal.tsx
git commit -m "feat: add associated person picker to ActivityFormModal"
```

---

## Final Verification

- [ ] **Step 33: Run full test suite**

```bash
npx vitest run
```

Expected: all tests PASS (no regressions)

- [ ] **Step 34: TypeScript clean check**

```bash
npx tsc --noEmit
```

Expected: no errors

- [ ] **Step 35: Final commit message summary** (no new files to commit)

All changes are committed per chunk. The branch is ready for PR.
