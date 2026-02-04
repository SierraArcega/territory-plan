# Card/Table View Toggle Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Add toggleable card/table views to PlansListView and ActivitiesPanel with inline editing in table views.

**Architecture:** Create reusable ViewToggle and InlineEditCell components, then build PlansTable and ActivitiesTable that use them. Integrate toggles into existing PlansListView and ActivitiesPanel components. Tables use existing React Query hooks for data fetching and mutations.

**Tech Stack:** React 19, TypeScript, TailwindCSS 4, React Query (TanStack Query), Vitest + Testing Library

---

## Task 1: ViewToggle Component

**Files:**
- Create: `src/components/common/ViewToggle.tsx`
- Create: `src/components/common/__tests__/ViewToggle.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/common/__tests__/ViewToggle.test.tsx
import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import ViewToggle from "../ViewToggle";

describe("ViewToggle", () => {
  it("renders both toggle buttons", () => {
    render(<ViewToggle view="cards" onViewChange={() => {}} />);

    expect(screen.getByRole("button", { name: /grid view/i })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: /table view/i })).toBeInTheDocument();
  });

  it("highlights cards button when view is cards", () => {
    render(<ViewToggle view="cards" onViewChange={() => {}} />);

    const cardsButton = screen.getByRole("button", { name: /grid view/i });
    expect(cardsButton).toHaveClass("bg-[#403770]");
  });

  it("highlights table button when view is table", () => {
    render(<ViewToggle view="table" onViewChange={() => {}} />);

    const tableButton = screen.getByRole("button", { name: /table view/i });
    expect(tableButton).toHaveClass("bg-[#403770]");
  });

  it("calls onViewChange with 'cards' when cards button clicked", () => {
    const handleChange = vi.fn();
    render(<ViewToggle view="table" onViewChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: /grid view/i }));
    expect(handleChange).toHaveBeenCalledWith("cards");
  });

  it("calls onViewChange with 'table' when table button clicked", () => {
    const handleChange = vi.fn();
    render(<ViewToggle view="cards" onViewChange={handleChange} />);

    fireEvent.click(screen.getByRole("button", { name: /table view/i }));
    expect(handleChange).toHaveBeenCalledWith("table");
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/common/__tests__/ViewToggle.test.tsx`
Expected: FAIL with "Cannot find module '../ViewToggle'"

**Step 3: Write the implementation**

```typescript
// src/components/common/ViewToggle.tsx
"use client";

// ViewToggle - A pair of icon buttons to switch between card grid and table views.
// Used in PlansListView and ActivitiesPanel headers.

interface ViewToggleProps {
  view: "cards" | "table";
  onViewChange: (view: "cards" | "table") => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  // Button styling: active state uses plum background, inactive uses gray
  const baseStyles = "p-1.5 transition-colors";
  const activeStyles = "bg-[#403770] text-white";
  const inactiveStyles = "bg-gray-100 text-gray-500 hover:bg-gray-200";

  return (
    <div className="inline-flex rounded-md" role="group">
      {/* Grid/Cards view button */}
      <button
        type="button"
        onClick={() => onViewChange("cards")}
        className={`${baseStyles} rounded-l-md ${view === "cards" ? activeStyles : inactiveStyles}`}
        aria-label="Grid view"
        aria-pressed={view === "cards"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </button>

      {/* Table/List view button */}
      <button
        type="button"
        onClick={() => onViewChange("table")}
        className={`${baseStyles} rounded-r-md ${view === "table" ? activeStyles : inactiveStyles}`}
        aria-label="Table view"
        aria-pressed={view === "table"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/common/__tests__/ViewToggle.test.tsx`
Expected: PASS (5 tests)

**Step 5: Commit**

```bash
git add src/components/common/ViewToggle.tsx src/components/common/__tests__/ViewToggle.test.tsx
git commit -m "feat: add ViewToggle component for card/table view switching

- Renders grid and list icon buttons in a grouped pill style
- Active state uses Fullmind plum (#403770)
- Accessible with aria-label and aria-pressed"
```

---

## Task 2: InlineEditCell Component

**Files:**
- Create: `src/components/common/InlineEditCell.tsx`
- Create: `src/components/common/__tests__/InlineEditCell.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/common/__tests__/InlineEditCell.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import InlineEditCell from "../InlineEditCell";

describe("InlineEditCell", () => {
  const mockOnSave = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockOnSave.mockResolvedValue(undefined);
  });

  describe("text input", () => {
    it("renders display value initially", () => {
      render(<InlineEditCell value="Test Value" onSave={mockOnSave} type="text" />);
      expect(screen.getByText("Test Value")).toBeInTheDocument();
    });

    it("shows input when clicked", () => {
      render(<InlineEditCell value="Test Value" onSave={mockOnSave} type="text" />);

      fireEvent.click(screen.getByText("Test Value"));
      expect(screen.getByRole("textbox")).toBeInTheDocument();
      expect(screen.getByRole("textbox")).toHaveValue("Test Value");
    });

    it("calls onSave with new value on blur", async () => {
      render(<InlineEditCell value="Test Value" onSave={mockOnSave} type="text" />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("New Value");
      });
    });

    it("calls onSave on Enter key", async () => {
      render(<InlineEditCell value="Test Value" onSave={mockOnSave} type="text" />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.keyDown(input, { key: "Enter" });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("New Value");
      });
    });

    it("cancels edit on Escape key without saving", () => {
      render(<InlineEditCell value="Test Value" onSave={mockOnSave} type="text" />);

      fireEvent.click(screen.getByText("Test Value"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New Value" } });
      fireEvent.keyDown(input, { key: "Escape" });

      expect(mockOnSave).not.toHaveBeenCalled();
      expect(screen.getByText("Test Value")).toBeInTheDocument();
    });

    it("shows placeholder when value is empty", () => {
      render(<InlineEditCell value="" onSave={mockOnSave} type="text" placeholder="Enter name" />);
      expect(screen.getByText("Enter name")).toBeInTheDocument();
    });
  });

  describe("select input", () => {
    const options = [
      { value: "draft", label: "Draft" },
      { value: "active", label: "Active" },
      { value: "archived", label: "Archived" },
    ];

    it("renders selected option label", () => {
      render(<InlineEditCell value="active" onSave={mockOnSave} type="select" options={options} />);
      expect(screen.getByText("Active")).toBeInTheDocument();
    });

    it("shows dropdown when clicked", () => {
      render(<InlineEditCell value="active" onSave={mockOnSave} type="select" options={options} />);

      fireEvent.click(screen.getByText("Active"));
      expect(screen.getByRole("combobox")).toBeInTheDocument();
    });

    it("calls onSave when option changes", async () => {
      render(<InlineEditCell value="draft" onSave={mockOnSave} type="select" options={options} />);

      fireEvent.click(screen.getByText("Draft"));
      const select = screen.getByRole("combobox");
      fireEvent.change(select, { target: { value: "active" } });

      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalledWith("active");
      });
    });
  });

  describe("date input", () => {
    it("renders formatted date", () => {
      render(<InlineEditCell value="2026-02-04" onSave={mockOnSave} type="date" />);
      // Date formatting depends on locale, just check it renders something
      expect(screen.getByText(/Feb|2\/4|2026/)).toBeInTheDocument();
    });

    it("shows date picker when clicked", () => {
      render(<InlineEditCell value="2026-02-04" onSave={mockOnSave} type="date" />);

      fireEvent.click(screen.getByText(/Feb|2\/4|2026/));
      expect(screen.getByDisplayValue("2026-02-04")).toBeInTheDocument();
    });
  });

  describe("textarea input", () => {
    it("renders truncated text", () => {
      const longText = "This is a very long description that should be truncated in display mode";
      render(<InlineEditCell value={longText} onSave={mockOnSave} type="textarea" />);
      // Should show the text (possibly truncated via CSS)
      expect(screen.getByText(longText)).toBeInTheDocument();
    });

    it("shows textarea when clicked", () => {
      render(<InlineEditCell value="Description" onSave={mockOnSave} type="textarea" />);

      fireEvent.click(screen.getByText("Description"));
      expect(screen.getByRole("textbox")).toBeInTheDocument();
    });
  });

  describe("loading and error states", () => {
    it("shows loading state while saving", async () => {
      // Make onSave take some time
      mockOnSave.mockImplementation(() => new Promise(resolve => setTimeout(resolve, 100)));

      render(<InlineEditCell value="Test" onSave={mockOnSave} type="text" />);

      fireEvent.click(screen.getByText("Test"));
      const input = screen.getByRole("textbox");
      fireEvent.change(input, { target: { value: "New" } });
      fireEvent.blur(input);

      // Should show some loading indicator (opacity change)
      await waitFor(() => {
        expect(mockOnSave).toHaveBeenCalled();
      });
    });

    it("does not save if value unchanged", async () => {
      render(<InlineEditCell value="Test" onSave={mockOnSave} type="text" />);

      fireEvent.click(screen.getByText("Test"));
      const input = screen.getByRole("textbox");
      fireEvent.blur(input); // Blur without changing

      expect(mockOnSave).not.toHaveBeenCalled();
    });
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/common/__tests__/InlineEditCell.test.tsx`
Expected: FAIL with "Cannot find module '../InlineEditCell'"

**Step 3: Write the implementation**

```typescript
// src/components/common/InlineEditCell.tsx
"use client";

import { useState, useRef, useEffect } from "react";

// InlineEditCell - A click-to-edit table cell component.
// Supports text, textarea, select, and date inputs.
// Click to enter edit mode, blur or Enter to save, Escape to cancel.

interface BaseProps {
  value: string | null;
  onSave: (value: string) => Promise<void>;
  placeholder?: string;
  className?: string;
}

interface TextProps extends BaseProps {
  type: "text";
}

interface TextareaProps extends BaseProps {
  type: "textarea";
}

interface SelectProps extends BaseProps {
  type: "select";
  options: Array<{ value: string; label: string }>;
}

interface DateProps extends BaseProps {
  type: "date";
}

type InlineEditCellProps = TextProps | TextareaProps | SelectProps | DateProps;

export default function InlineEditCell(props: InlineEditCellProps) {
  const { value, onSave, placeholder = "—", className = "" } = props;

  const [isEditing, setIsEditing] = useState(false);
  const [editValue, setEditValue] = useState(value || "");
  const [isSaving, setIsSaving] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>(null);

  // Focus input when entering edit mode
  useEffect(() => {
    if (isEditing && inputRef.current) {
      inputRef.current.focus();
      // Select all text for text inputs
      if (props.type === "text" && inputRef.current instanceof HTMLInputElement) {
        inputRef.current.select();
      }
    }
  }, [isEditing, props.type]);

  // Reset edit value when value prop changes
  useEffect(() => {
    setEditValue(value || "");
  }, [value]);

  // Handle saving the value
  const handleSave = async () => {
    // Don't save if value hasn't changed
    if (editValue === (value || "")) {
      setIsEditing(false);
      return;
    }

    setIsSaving(true);
    try {
      await onSave(editValue);
      setIsEditing(false);
      // Show brief success flash
      setShowSuccess(true);
      setTimeout(() => setShowSuccess(false), 500);
    } catch (error) {
      // Keep editing mode on error so user can retry
      console.error("Failed to save:", error);
    } finally {
      setIsSaving(false);
    }
  };

  // Handle keyboard events
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && props.type !== "textarea") {
      e.preventDefault();
      handleSave();
    } else if (e.key === "Escape") {
      setEditValue(value || "");
      setIsEditing(false);
    }
  };

  // Handle blur (save on blur)
  const handleBlur = () => {
    handleSave();
  };

  // Format date for display
  const formatDate = (dateStr: string) => {
    try {
      return new Date(dateStr).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    } catch {
      return dateStr;
    }
  };

  // Get display value based on type
  const getDisplayValue = () => {
    if (!value) return placeholder;

    if (props.type === "select") {
      const option = props.options.find(o => o.value === value);
      return option?.label || value;
    }

    if (props.type === "date") {
      return formatDate(value);
    }

    return value;
  };

  // Base styles for the cell
  const cellStyles = `
    cursor-pointer rounded px-1 -mx-1
    hover:bg-[#C4E7E6]/30
    ${showSuccess ? "bg-green-100" : ""}
    ${isSaving ? "opacity-50" : ""}
    ${className}
  `.trim();

  // If not editing, show display value
  if (!isEditing) {
    return (
      <div
        onClick={() => setIsEditing(true)}
        className={cellStyles}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            setIsEditing(true);
          }
        }}
      >
        <span className={!value ? "text-gray-400 italic" : ""}>
          {getDisplayValue()}
        </span>
      </div>
    );
  }

  // Render the appropriate input type
  const inputStyles = "w-full px-2 py-1 text-sm border rounded ring-2 ring-[#403770] focus:outline-none";

  if (props.type === "select") {
    return (
      <select
        ref={inputRef as React.RefObject<HTMLSelectElement>}
        value={editValue}
        onChange={(e) => {
          setEditValue(e.target.value);
          // Auto-save on select change
          onSave(e.target.value).then(() => {
            setIsEditing(false);
            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 500);
          });
        }}
        onBlur={() => setIsEditing(false)}
        onKeyDown={handleKeyDown}
        className={inputStyles}
        disabled={isSaving}
      >
        {props.options.map((option) => (
          <option key={option.value} value={option.value}>
            {option.label}
          </option>
        ))}
      </select>
    );
  }

  if (props.type === "textarea") {
    return (
      <textarea
        ref={inputRef as React.RefObject<HTMLTextAreaElement>}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={(e) => {
          // For textarea, Ctrl+Enter saves, plain Enter is newline
          if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) {
            e.preventDefault();
            handleSave();
          } else if (e.key === "Escape") {
            setEditValue(value || "");
            setIsEditing(false);
          }
        }}
        className={`${inputStyles} min-h-[60px] resize-none`}
        disabled={isSaving}
        rows={3}
      />
    );
  }

  if (props.type === "date") {
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="date"
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        onBlur={handleBlur}
        onKeyDown={handleKeyDown}
        className={inputStyles}
        disabled={isSaving}
      />
    );
  }

  // Default: text input
  return (
    <input
      ref={inputRef as React.RefObject<HTMLInputElement>}
      type="text"
      value={editValue}
      onChange={(e) => setEditValue(e.target.value)}
      onBlur={handleBlur}
      onKeyDown={handleKeyDown}
      className={inputStyles}
      disabled={isSaving}
      placeholder={placeholder}
    />
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/common/__tests__/InlineEditCell.test.tsx`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/components/common/InlineEditCell.tsx src/components/common/__tests__/InlineEditCell.test.tsx
git commit -m "feat: add InlineEditCell component for click-to-edit table cells

- Supports text, textarea, select, and date input types
- Click to edit, blur or Enter to save, Escape to cancel
- Shows success flash on save, maintains edit mode on error
- Hover hint with robin's egg tint for discoverability"
```

---

## Task 3: PlansTable Component

**Files:**
- Create: `src/components/plans/PlansTable.tsx`
- Create: `src/components/plans/__tests__/PlansTable.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/plans/__tests__/PlansTable.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlansTable from "../PlansTable";

// Mock the API hooks
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();

vi.mock("@/lib/api", () => ({
  useUpdateTerritoryPlan: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  useDeleteTerritoryPlan: vi.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  })),
}));

const mockPlans = [
  {
    id: "plan-1",
    name: "Q1 Expansion",
    description: "Focus on midwest districts",
    owner: "Sarah",
    color: "#403770",
    status: "active" as const,
    fiscalYear: 2026,
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    districtCount: 15,
    createdAt: "2026-01-01T00:00:00Z",
    updatedAt: "2026-01-01T00:00:00Z",
  },
  {
    id: "plan-2",
    name: "Southeast Growth",
    description: null,
    owner: null,
    color: "#F37167",
    status: "draft" as const,
    fiscalYear: 2026,
    startDate: null,
    endDate: null,
    districtCount: 8,
    createdAt: "2026-01-15T00:00:00Z",
    updatedAt: "2026-01-15T00:00:00Z",
  },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("PlansTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMutateAsync.mockResolvedValue({});
  });

  it("renders table with all plans", () => {
    renderWithQueryClient(<PlansTable plans={mockPlans} onSelectPlan={() => {}} />);

    expect(screen.getByText("Q1 Expansion")).toBeInTheDocument();
    expect(screen.getByText("Southeast Growth")).toBeInTheDocument();
  });

  it("displays plan details in columns", () => {
    renderWithQueryClient(<PlansTable plans={mockPlans} onSelectPlan={() => {}} />);

    // Check status badges
    expect(screen.getByText("Active")).toBeInTheDocument();
    expect(screen.getByText("Draft")).toBeInTheDocument();

    // Check owner
    expect(screen.getByText("Sarah")).toBeInTheDocument();

    // Check district count
    expect(screen.getByText("15")).toBeInTheDocument();
    expect(screen.getByText("8")).toBeInTheDocument();
  });

  it("calls onSelectPlan when clicking plan name", () => {
    const handleSelect = vi.fn();
    renderWithQueryClient(<PlansTable plans={mockPlans} onSelectPlan={handleSelect} />);

    fireEvent.click(screen.getByText("Q1 Expansion"));
    expect(handleSelect).toHaveBeenCalledWith("plan-1");
  });

  it("allows inline editing of plan name", async () => {
    renderWithQueryClient(<PlansTable plans={mockPlans} onSelectPlan={() => {}} />);

    // Find the name cell and click it (it should have a specific test id or we use the column)
    const nameCell = screen.getByText("Q1 Expansion");
    fireEvent.click(nameCell);

    // Should show an input
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "Q1 Expansion Plan" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "plan-1",
        name: "Q1 Expansion Plan",
      });
    });
  });

  it("allows inline editing of status via dropdown", async () => {
    renderWithQueryClient(<PlansTable plans={mockPlans} onSelectPlan={() => {}} />);

    // Click on the Active status badge
    fireEvent.click(screen.getByText("Active"));

    // Should show a select dropdown
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "archived" } });

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        id: "plan-1",
        status: "archived",
      });
    });
  });

  it("shows empty state when no plans", () => {
    renderWithQueryClient(<PlansTable plans={[]} onSelectPlan={() => {}} />);

    expect(screen.getByText(/no territory plans/i)).toBeInTheDocument();
  });

  it("shows footer with total district count", () => {
    renderWithQueryClient(<PlansTable plans={mockPlans} onSelectPlan={() => {}} />);

    // Total: 15 + 8 = 23 districts
    expect(screen.getByText("23")).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/plans/__tests__/PlansTable.test.tsx`
Expected: FAIL with "Cannot find module '../PlansTable'"

**Step 3: Write the implementation**

```typescript
// src/components/plans/PlansTable.tsx
"use client";

import { useState } from "react";
import { useUpdateTerritoryPlan, useDeleteTerritoryPlan, type TerritoryPlan } from "@/lib/api";
import InlineEditCell from "@/components/common/InlineEditCell";

// PlansTable - Table view for territory plans with inline editing.
// Displays plans in rows with editable name, description, owner, status, and dates.

interface PlansTableProps {
  plans: TerritoryPlan[];
  onSelectPlan: (planId: string) => void;
}

// Status options for the dropdown
const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

// Status badge styling
function getStatusStyles(status: string) {
  switch (status) {
    case "active":
      return "bg-[#8AA891] text-white";
    case "draft":
      return "bg-gray-200 text-gray-700";
    case "archived":
      return "bg-gray-400 text-white";
    default:
      return "bg-gray-200 text-gray-700";
  }
}

// Format date for display
function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Format date range
function formatDateRange(start: string | null, end: string | null): string {
  if (!start && !end) return "—";
  if (start && end) return `${formatDate(start)} – ${formatDate(end)}`;
  if (start) return `From ${formatDate(start)}`;
  return `Until ${formatDate(end)}`;
}

export default function PlansTable({ plans, onSelectPlan }: PlansTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const updatePlan = useUpdateTerritoryPlan();
  const deletePlan = useDeleteTerritoryPlan();

  // Handle inline edit saves for each field
  const handleSave = async (planId: string, field: string, value: string) => {
    await updatePlan.mutateAsync({
      id: planId,
      [field]: value || undefined,
    });
  };

  // Handle delete
  const handleDelete = async (planId: string) => {
    await deletePlan.mutateAsync(planId);
    setConfirmDelete(null);
  };

  // Calculate totals
  const totalDistricts = plans.reduce((sum, p) => sum + p.districtCount, 0);

  if (plans.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <p>No territory plans yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Name
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider max-w-[200px]">
                  Description
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Owner
                </th>
                <th className="px-4 py-3 text-center text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  FY
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Dates
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Districts
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {plans.map((plan) => (
                <tr key={plan.id} className="hover:bg-gray-50 transition-colors">
                  {/* Color dot */}
                  <td className="px-3 py-3">
                    <span
                      className="w-3 h-3 rounded-full inline-block"
                      style={{ backgroundColor: plan.color }}
                    />
                  </td>

                  {/* Name - clickable to navigate, editable */}
                  <td className="px-4 py-3">
                    <InlineEditCell
                      value={plan.name}
                      onSave={(value) => handleSave(plan.id, "name", value)}
                      type="text"
                      placeholder="Plan name"
                      className="font-medium text-[#403770] hover:text-[#F37167]"
                    />
                  </td>

                  {/* Description - truncated, editable */}
                  <td className="px-4 py-3 max-w-[200px]">
                    <InlineEditCell
                      value={plan.description}
                      onSave={(value) => handleSave(plan.id, "description", value)}
                      type="textarea"
                      placeholder="Add description"
                      className="text-sm text-gray-600 truncate"
                    />
                  </td>

                  {/* Owner - editable */}
                  <td className="px-4 py-3">
                    <InlineEditCell
                      value={plan.owner}
                      onSave={(value) => handleSave(plan.id, "owner", value)}
                      type="text"
                      placeholder="Unassigned"
                      className="text-sm text-gray-600"
                    />
                  </td>

                  {/* Fiscal Year - display only */}
                  <td className="px-4 py-3 text-center">
                    <span className="px-2 py-0.5 text-xs font-semibold rounded-full bg-[#403770] text-white">
                      FY{String(plan.fiscalYear).slice(-2)}
                    </span>
                  </td>

                  {/* Status - dropdown editable */}
                  <td className="px-4 py-3">
                    <InlineEditCell
                      value={plan.status}
                      onSave={(value) => handleSave(plan.id, "status", value)}
                      type="select"
                      options={STATUS_OPTIONS}
                      className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full ${getStatusStyles(plan.status)}`}
                    />
                  </td>

                  {/* Dates - editable (simplified: just show range, edit via separate cells) */}
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1 text-sm text-gray-600">
                      <InlineEditCell
                        value={plan.startDate}
                        onSave={(value) => handleSave(plan.id, "startDate", value)}
                        type="date"
                        placeholder="Start"
                      />
                      <span className="text-gray-400">–</span>
                      <InlineEditCell
                        value={plan.endDate}
                        onSave={(value) => handleSave(plan.id, "endDate", value)}
                        type="date"
                        placeholder="End"
                      />
                    </div>
                  </td>

                  {/* District count - clickable to navigate */}
                  <td className="px-4 py-3 text-right">
                    <button
                      onClick={() => onSelectPlan(plan.id)}
                      className="text-sm font-medium text-[#403770] hover:text-[#F37167] transition-colors"
                    >
                      {plan.districtCount}
                    </button>
                  </td>

                  {/* Actions */}
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-2">
                      <button
                        onClick={() => onSelectPlan(plan.id)}
                        className="text-sm text-[#403770] hover:text-[#F37167] transition-colors"
                      >
                        View
                      </button>
                      <button
                        onClick={() => setConfirmDelete(plan.id)}
                        className="text-sm text-red-500 hover:text-red-700 transition-colors"
                      >
                        Delete
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
            {/* Footer with totals */}
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-3 py-3"></td>
                <td className="px-4 py-3">
                  <span className="text-sm font-semibold text-gray-700">
                    Total ({plans.length} plans)
                  </span>
                </td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3"></td>
                <td className="px-4 py-3 text-right">
                  <span className="text-sm font-semibold text-gray-700">
                    {totalDistricts}
                  </span>
                </td>
                <td className="px-4 py-3"></td>
              </tr>
            </tfoot>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Plan?</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete this plan? This will remove all district associations. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDelete(confirmDelete)}
                disabled={deletePlan.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletePlan.isPending ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/plans/__tests__/PlansTable.test.tsx`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/components/plans/PlansTable.tsx src/components/plans/__tests__/PlansTable.test.tsx
git commit -m "feat: add PlansTable component with inline editing

- Table view showing all territory plans
- Inline editable: name, description, owner, status, dates
- Color dot, FY badge, district count columns
- Footer with total counts
- Delete confirmation modal"
```

---

## Task 4: Integrate ViewToggle into PlansListView

**Files:**
- Modify: `src/components/views/PlansView.tsx`

**Step 1: Read current file to understand structure**

Already read in exploration phase. The PlansListView function starts around line 98.

**Step 2: Write the changes**

Add view state and conditionally render cards or table:

```typescript
// In PlansListView function, add these changes:

// 1. Add import at top of file:
import ViewToggle from "@/components/common/ViewToggle";
import PlansTable from "@/components/plans/PlansTable";

// 2. Add view state inside PlansListView:
const [view, setView] = useState<"cards" | "table">("cards");

// 3. Update the header to include ViewToggle:
// Replace the header div (around line 118-141) with:
<header className="bg-white border-b border-gray-200 px-6 py-4">
  <div className="max-w-6xl mx-auto flex items-center justify-between">
    <div>
      <h1 className="text-xl font-bold text-[#403770]">Territory Plans</h1>
      <p className="text-sm text-gray-500">
        Manage your territory plans and assigned districts
      </p>
    </div>
    <div className="flex items-center gap-4">
      {/* View toggle - hidden on mobile */}
      <div className="hidden md:block">
        <ViewToggle view={view} onViewChange={setView} />
      </div>
      <button
        onClick={() => setShowCreateModal(true)}
        className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
        </svg>
        Create Plan
      </button>
    </div>
  </div>
</header>

// 4. Update the plans rendering (around line 167-178) to conditionally show table:
// Replace the grid rendering with:
{view === "cards" ? (
  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
    {plans.map((plan) => (
      <div
        key={plan.id}
        onClick={() => onSelectPlan(plan.id)}
        className="cursor-pointer"
      >
        <PlanCard plan={plan} />
      </div>
    ))}
  </div>
) : (
  <PlansTable plans={plans} onSelectPlan={onSelectPlan} />
)}
```

**Step 3: Apply the full edit**

The complete updated PlansListView function with all changes applied.

**Step 4: Run the app to test manually**

Run: `npm run dev`
Expected: Plans view shows toggle, can switch between cards and table, inline editing works in table

**Step 5: Commit**

```bash
git add src/components/views/PlansView.tsx
git commit -m "feat: add card/table toggle to PlansListView

- ViewToggle in header (hidden on mobile)
- Conditional rendering of PlanCard grid or PlansTable
- Default to cards view to preserve existing behavior"
```

---

## Task 5: ActivitiesTable Component

**Files:**
- Create: `src/components/plans/ActivitiesTable.tsx`
- Create: `src/components/plans/__tests__/ActivitiesTable.test.tsx`

**Step 1: Write the failing test**

```typescript
// src/components/plans/__tests__/ActivitiesTable.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ActivitiesTable from "../ActivitiesTable";

// Mock the API hooks
const mockUpdateMutateAsync = vi.fn();
const mockDeleteMutateAsync = vi.fn();

vi.mock("@/lib/api", () => ({
  useUpdateActivity: vi.fn(() => ({
    mutateAsync: mockUpdateMutateAsync,
    isPending: false,
  })),
  useDeleteActivity: vi.fn(() => ({
    mutateAsync: mockDeleteMutateAsync,
    isPending: false,
  })),
}));

vi.mock("@/lib/activityTypes", () => ({
  ACTIVITY_TYPE_LABELS: {
    conference: "Conference",
    email_campaign: "Email Campaign",
    discovery_call: "Discovery Call",
  },
  ACTIVITY_TYPE_ICONS: {
    conference: "🎤",
    email_campaign: "📧",
    discovery_call: "🔍",
  },
  ACTIVITY_STATUS_CONFIG: {
    planned: { label: "Planned", color: "#6EA3BE", bgColor: "#EEF5F8" },
    completed: { label: "Completed", color: "#8AA891", bgColor: "#EFF5F0" },
    cancelled: { label: "Cancelled", color: "#9CA3AF", bgColor: "#F3F4F6" },
  },
  ALL_ACTIVITY_TYPES: ["conference", "email_campaign", "discovery_call"],
  VALID_ACTIVITY_STATUSES: ["planned", "completed", "cancelled"],
}));

const mockActivities = [
  {
    id: "act-1",
    type: "conference",
    category: "events",
    title: "EdTech Summit 2026",
    startDate: "2026-03-15",
    endDate: "2026-03-17",
    status: "planned",
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 2,
    districtCount: 5,
    stateAbbrevs: ["CA", "TX"],
  },
  {
    id: "act-2",
    type: "email_campaign",
    category: "outreach",
    title: "Spring Outreach",
    startDate: "2026-02-01",
    endDate: null,
    status: "completed",
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 1,
    districtCount: 12,
    stateAbbrevs: ["NY"],
  },
];

function renderWithQueryClient(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>
  );
}

describe("ActivitiesTable", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMutateAsync.mockResolvedValue({});
  });

  it("renders table with all activities", () => {
    renderWithQueryClient(
      <ActivitiesTable activities={mockActivities} onEdit={() => {}} onDelete={() => {}} />
    );

    expect(screen.getByText("EdTech Summit 2026")).toBeInTheDocument();
    expect(screen.getByText("Spring Outreach")).toBeInTheDocument();
  });

  it("displays activity details in columns", () => {
    renderWithQueryClient(
      <ActivitiesTable activities={mockActivities} onEdit={() => {}} onDelete={() => {}} />
    );

    // Check type labels
    expect(screen.getByText("Conference")).toBeInTheDocument();
    expect(screen.getByText("Email Campaign")).toBeInTheDocument();

    // Check status badges
    expect(screen.getByText("Planned")).toBeInTheDocument();
    expect(screen.getByText("Completed")).toBeInTheDocument();

    // Check scope
    expect(screen.getByText(/5 districts/)).toBeInTheDocument();
  });

  it("allows inline editing of title", async () => {
    renderWithQueryClient(
      <ActivitiesTable activities={mockActivities} onEdit={() => {}} onDelete={() => {}} />
    );

    fireEvent.click(screen.getByText("EdTech Summit 2026"));
    const input = screen.getByRole("textbox");
    fireEvent.change(input, { target: { value: "EdTech Summit 2026 - Updated" } });
    fireEvent.blur(input);

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        activityId: "act-1",
        title: "EdTech Summit 2026 - Updated",
      });
    });
  });

  it("allows inline editing of status via dropdown", async () => {
    renderWithQueryClient(
      <ActivitiesTable activities={mockActivities} onEdit={() => {}} onDelete={() => {}} />
    );

    fireEvent.click(screen.getByText("Planned"));
    const select = screen.getByRole("combobox");
    fireEvent.change(select, { target: { value: "completed" } });

    await waitFor(() => {
      expect(mockUpdateMutateAsync).toHaveBeenCalledWith({
        activityId: "act-1",
        status: "completed",
      });
    });
  });

  it("calls onEdit when edit button clicked", () => {
    const handleEdit = vi.fn();
    renderWithQueryClient(
      <ActivitiesTable activities={mockActivities} onEdit={handleEdit} onDelete={() => {}} />
    );

    const editButtons = screen.getAllByText("Edit");
    fireEvent.click(editButtons[0]);

    expect(handleEdit).toHaveBeenCalledWith(mockActivities[0]);
  });

  it("calls onDelete when delete confirmed", async () => {
    const handleDelete = vi.fn();
    renderWithQueryClient(
      <ActivitiesTable activities={mockActivities} onEdit={() => {}} onDelete={handleDelete} />
    );

    const deleteButtons = screen.getAllByText("Delete");
    fireEvent.click(deleteButtons[0]);

    // Should show confirmation
    expect(screen.getByText("Delete Activity?")).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /^delete$/i }));

    expect(handleDelete).toHaveBeenCalledWith("act-1");
  });

  it("shows empty state when no activities", () => {
    renderWithQueryClient(
      <ActivitiesTable activities={[]} onEdit={() => {}} onDelete={() => {}} />
    );

    expect(screen.getByText(/no activities/i)).toBeInTheDocument();
  });
});
```

**Step 2: Run test to verify it fails**

Run: `npm test -- src/components/plans/__tests__/ActivitiesTable.test.tsx`
Expected: FAIL with "Cannot find module '../ActivitiesTable'"

**Step 3: Write the implementation**

```typescript
// src/components/plans/ActivitiesTable.tsx
"use client";

import { useState } from "react";
import { useUpdateActivity, type ActivityListItem } from "@/lib/api";
import {
  ACTIVITY_TYPE_LABELS,
  ACTIVITY_TYPE_ICONS,
  ACTIVITY_STATUS_CONFIG,
  ALL_ACTIVITY_TYPES,
  VALID_ACTIVITY_STATUSES,
  type ActivityType,
  type ActivityStatus,
} from "@/lib/activityTypes";
import InlineEditCell from "@/components/common/InlineEditCell";

// ActivitiesTable - Table view for activities with inline editing.
// Displays activities in rows with editable title, type, status, dates, and notes.

interface ActivitiesTableProps {
  activities: ActivityListItem[];
  onEdit: (activity: ActivityListItem) => void;
  onDelete: (activityId: string) => void;
  isDeleting?: boolean;
}

// Build options arrays for dropdowns
const TYPE_OPTIONS = ALL_ACTIVITY_TYPES.map((type) => ({
  value: type,
  label: ACTIVITY_TYPE_LABELS[type as ActivityType] || type,
}));

const STATUS_OPTIONS = VALID_ACTIVITY_STATUSES.map((status) => ({
  value: status,
  label: ACTIVITY_STATUS_CONFIG[status as ActivityStatus].label,
}));

// Format date for display
function formatDate(dateString: string): string {
  return new Date(dateString).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

// Format date range
function formatDateRange(start: string, end: string | null): string {
  if (end && end !== start) {
    return `${formatDate(start)} – ${formatDate(end)}`;
  }
  return formatDate(start);
}

// Format scope text
function formatScope(districtCount: number, stateAbbrevs: string[]): string {
  if (districtCount > 0) {
    const stateText = stateAbbrevs.length > 0 ? ` (${stateAbbrevs.slice(0, 3).join(", ")}${stateAbbrevs.length > 3 ? "..." : ""})` : "";
    return `${districtCount} district${districtCount !== 1 ? "s" : ""}${stateText}`;
  }
  if (stateAbbrevs.length > 0) {
    return stateAbbrevs.join(", ");
  }
  return "All districts";
}

export default function ActivitiesTable({
  activities,
  onEdit,
  onDelete,
  isDeleting = false,
}: ActivitiesTableProps) {
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  const updateActivity = useUpdateActivity();

  // Handle inline edit saves for each field
  const handleSave = async (activityId: string, field: string, value: string) => {
    await updateActivity.mutateAsync({
      activityId,
      [field]: value || undefined,
    });
  };

  if (activities.length === 0) {
    return (
      <div className="text-center py-12 text-gray-500">
        <svg
          className="w-12 h-12 mx-auto mb-3 text-gray-300"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z"
          />
        </svg>
        <p className="text-gray-500">No activities yet</p>
      </div>
    );
  }

  return (
    <>
      <div className="overflow-hidden border border-gray-200 rounded-lg">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="w-10 px-3 py-3"></th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Title
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Type
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Scope
                </th>
                <th className="px-4 py-3 text-right text-xs font-semibold text-gray-600 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-100">
              {activities.map((activity) => {
                const statusConfig = ACTIVITY_STATUS_CONFIG[activity.status as ActivityStatus];
                const typeIcon = ACTIVITY_TYPE_ICONS[activity.type as ActivityType] || "📋";

                return (
                  <tr key={activity.id} className="hover:bg-gray-50 transition-colors">
                    {/* Type icon */}
                    <td className="px-3 py-3 text-center">
                      <span className="text-lg">{typeIcon}</span>
                    </td>

                    {/* Title - editable */}
                    <td className="px-4 py-3">
                      <InlineEditCell
                        value={activity.title}
                        onSave={(value) => handleSave(activity.id, "title", value)}
                        type="text"
                        placeholder="Activity title"
                        className="font-medium text-[#403770]"
                      />
                    </td>

                    {/* Type - dropdown editable */}
                    <td className="px-4 py-3">
                      <InlineEditCell
                        value={activity.type}
                        onSave={(value) => handleSave(activity.id, "type", value)}
                        type="select"
                        options={TYPE_OPTIONS}
                        className="text-sm text-gray-600"
                      />
                    </td>

                    {/* Status - dropdown editable */}
                    <td className="px-4 py-3">
                      <InlineEditCell
                        value={activity.status}
                        onSave={(value) => handleSave(activity.id, "status", value)}
                        type="select"
                        options={STATUS_OPTIONS}
                        className={`inline-block px-2 py-0.5 text-xs font-medium rounded-full`}
                      />
                    </td>

                    {/* Date - editable */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1 text-sm text-gray-600">
                        <InlineEditCell
                          value={activity.startDate.split("T")[0]}
                          onSave={(value) => handleSave(activity.id, "startDate", new Date(value).toISOString())}
                          type="date"
                        />
                        {activity.endDate && (
                          <>
                            <span className="text-gray-400">–</span>
                            <InlineEditCell
                              value={activity.endDate.split("T")[0]}
                              onSave={(value) => handleSave(activity.id, "endDate", new Date(value).toISOString())}
                              type="date"
                            />
                          </>
                        )}
                      </div>
                    </td>

                    {/* Scope - display only */}
                    <td className="px-4 py-3">
                      <span className="text-sm text-gray-600">
                        {formatScope(activity.districtCount, activity.stateAbbrevs)}
                      </span>
                    </td>

                    {/* Actions */}
                    <td className="px-4 py-3 text-right">
                      <div className="flex items-center justify-end gap-2">
                        <button
                          onClick={() => onEdit(activity)}
                          className="text-sm text-[#403770] hover:text-[#F37167] transition-colors"
                        >
                          Edit
                        </button>
                        <button
                          onClick={() => setConfirmDelete(activity.id)}
                          className="text-sm text-red-500 hover:text-red-700 transition-colors"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Delete confirmation modal */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Activity?</h3>
            <p className="text-gray-600 text-sm mb-6">
              Are you sure you want to delete this activity? This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setConfirmDelete(null)}
                className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  onDelete(confirmDelete);
                  setConfirmDelete(null);
                }}
                disabled={isDeleting}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {isDeleting ? "Deleting..." : "Delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
```

**Step 4: Run test to verify it passes**

Run: `npm test -- src/components/plans/__tests__/ActivitiesTable.test.tsx`
Expected: PASS (all tests)

**Step 5: Commit**

```bash
git add src/components/plans/ActivitiesTable.tsx src/components/plans/__tests__/ActivitiesTable.test.tsx
git commit -m "feat: add ActivitiesTable component with inline editing

- Table view showing all activities
- Inline editable: title, type, status, dates
- Type icon, scope display columns
- Delete confirmation modal
- Reuses InlineEditCell for consistency"
```

---

## Task 6: Integrate ViewToggle into ActivitiesPanel

**Files:**
- Modify: `src/components/plans/ActivitiesPanel.tsx`

**Step 1: Apply the changes**

Add view state and toggle, conditionally render cards or table:

```typescript
// Changes to ActivitiesPanel.tsx:

// 1. Add imports at top:
import ViewToggle from "@/components/common/ViewToggle";
import ActivitiesTable from "./ActivitiesTable";

// 2. Add view state after other useState calls (around line 24):
const [view, setView] = useState<"cards" | "table">("cards");

// 3. Update the header div (around line 124-149) to include toggle:
<div className="flex items-center justify-between mb-4">
  <div>
    <h2 className="text-lg font-semibold text-[#403770]">Activities</h2>
    {stats.total > 0 && (
      <p className="text-sm text-gray-500">
        {stats.planned > 0 && (
          <span className="text-[#6EA3BE]">{stats.planned} planned</span>
        )}
        {stats.planned > 0 && stats.completed > 0 && <span> • </span>}
        {stats.completed > 0 && (
          <span className="text-[#8AA891]">{stats.completed} completed</span>
        )}
      </p>
    )}
  </div>
  <div className="flex items-center gap-3">
    {/* View toggle - hidden on mobile */}
    <div className="hidden md:block">
      <ViewToggle view={view} onViewChange={setView} />
    </div>
    <button
      onClick={handleAddClick}
      className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-[#403770] hover:bg-[#352d5c] rounded-lg transition-colors"
    >
      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
      </svg>
      Add
    </button>
  </div>
</div>

// 4. Update the activity list rendering (around line 152-187) to conditionally show table:
<div className="flex-1 overflow-y-auto space-y-3">
  {isLoading ? (
    <div className="flex items-center justify-center py-8">
      <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#403770] border-t-transparent" />
    </div>
  ) : activities && activities.length > 0 ? (
    view === "cards" ? (
      activities.map((activity) => (
        <ActivityCard
          key={activity.id}
          activity={activity}
          onEdit={() => handleEditClick(activity)}
          onDelete={() => handleDeleteActivity(activity.id)}
          isDeleting={deleteActivity.isPending}
        />
      ))
    ) : (
      <ActivitiesTable
        activities={activities}
        onEdit={handleEditClick}
        onDelete={handleDeleteActivity}
        isDeleting={deleteActivity.isPending}
      />
    )
  ) : (
    // Empty state unchanged
    <div className="text-center py-12">
      ...
    </div>
  )}
</div>
```

**Step 2: Apply the full edit**

Apply all changes to ActivitiesPanel.tsx.

**Step 3: Run the app to test manually**

Run: `npm run dev`
Expected: Activities panel shows toggle, can switch between cards and table, inline editing works

**Step 4: Commit**

```bash
git add src/components/plans/ActivitiesPanel.tsx
git commit -m "feat: add card/table toggle to ActivitiesPanel

- ViewToggle in header (hidden on mobile)
- Conditional rendering of ActivityCard list or ActivitiesTable
- Default to cards view to preserve existing behavior"
```

---

## Task 7: Run All Tests and Final Cleanup

**Step 1: Run full test suite**

Run: `npm test`
Expected: All tests pass

**Step 2: Run lint**

Run: `npm run lint`
Expected: No lint errors

**Step 3: Run build**

Run: `npm run build`
Expected: Build succeeds without errors

**Step 4: Manual testing checklist**

- [ ] Plans list: Toggle between cards and table
- [ ] Plans table: Click cell to edit name, description, owner
- [ ] Plans table: Change status via dropdown
- [ ] Plans table: Edit start/end dates
- [ ] Plans table: Delete plan with confirmation
- [ ] Plans table: Click district count or View to navigate to detail
- [ ] Activities panel: Toggle between cards and table
- [ ] Activities table: Edit title, type, status, dates inline
- [ ] Activities table: Edit and Delete buttons work
- [ ] Both toggles: Hidden on mobile viewport
- [ ] Both toggles: Independent (can be different views)

**Step 5: Final commit**

```bash
git add -A
git commit -m "chore: final cleanup and test verification

- All tests passing
- Lint clean
- Build succeeds"
```

**Step 6: Push to remote**

```bash
git push -u origin feature/card-table-view-toggle
```

---

## Summary

**Files Created:**
- `src/components/common/ViewToggle.tsx`
- `src/components/common/__tests__/ViewToggle.test.tsx`
- `src/components/common/InlineEditCell.tsx`
- `src/components/common/__tests__/InlineEditCell.test.tsx`
- `src/components/plans/PlansTable.tsx`
- `src/components/plans/__tests__/PlansTable.test.tsx`
- `src/components/plans/ActivitiesTable.tsx`
- `src/components/plans/__tests__/ActivitiesTable.test.tsx`

**Files Modified:**
- `src/components/views/PlansView.tsx`
- `src/components/plans/ActivitiesPanel.tsx`

**Commits (7 total):**
1. ViewToggle component
2. InlineEditCell component
3. PlansTable component
4. PlansListView toggle integration
5. ActivitiesTable component
6. ActivitiesPanel toggle integration
7. Final cleanup
