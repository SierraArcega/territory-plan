// src/components/plans/__tests__/PlansTable.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor, within } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PlansTable from "../PlansTable";
import type { TerritoryPlan } from "@/lib/api";

// Create mock functions outside so they can be accessed in tests
const mockUpdateMutate = vi.fn().mockResolvedValue({});
const mockDeleteMutate = vi.fn().mockResolvedValue({});

// Mock the API hooks
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    useUpdateTerritoryPlan: () => ({
      mutateAsync: mockUpdateMutate,
      isPending: false,
    }),
    useDeleteTerritoryPlan: () => ({
      mutateAsync: mockDeleteMutate,
      isPending: false,
    }),
  };
});

// Sample test data
const mockPlans: TerritoryPlan[] = [
  {
    id: "plan-1",
    name: "West Region Q1",
    description: "Primary focus on expanding in the Western region",
    owner: { id: "user-1", fullName: "John Smith", avatarUrl: null },
    color: "#FF5733",
    status: "working",
    fiscalYear: 2026,
    startDate: "2026-01-01",
    endDate: "2026-03-31",
    createdAt: "2025-12-01T00:00:00Z",
    updatedAt: "2025-12-15T00:00:00Z",
    districtCount: 15,
    totalEnrollment: 50000,
    stateCount: 1,
    states: [{ fips: "06", abbrev: "CA", name: "California" }],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
  },
  {
    id: "plan-2",
    name: "East Coast Expansion",
    description: "New territory development on the East Coast",
    owner: { id: "user-2", fullName: "Jane Doe", avatarUrl: null },
    color: "#3498DB",
    status: "planning",
    fiscalYear: 2026,
    startDate: "2026-04-01",
    endDate: "2026-06-30",
    createdAt: "2025-12-10T00:00:00Z",
    updatedAt: "2025-12-20T00:00:00Z",
    districtCount: 8,
    totalEnrollment: 30000,
    stateCount: 2,
    states: [{ fips: "36", abbrev: "NY", name: "New York" }, { fips: "34", abbrev: "NJ", name: "New Jersey" }],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
  },
  {
    id: "plan-3",
    name: "Archived Plan",
    description: null,
    owner: null,
    color: "#9B59B6",
    status: "archived",
    fiscalYear: 2025,
    startDate: null,
    endDate: null,
    createdAt: "2024-12-01T00:00:00Z",
    updatedAt: "2024-12-15T00:00:00Z",
    districtCount: 3,
    totalEnrollment: 10000,
    stateCount: 1,
    states: [],
    collaborators: [],
    taskCount: 0,
    completedTaskCount: 0,
  },
];

// Helper to wrap component with QueryClientProvider
function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>
      {ui}
    </QueryClientProvider>
  );
}

describe("PlansTable", () => {
  const mockOnSelectPlan = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMutate.mockClear();
    mockDeleteMutate.mockClear();
  });

  describe("rendering", () => {
    it("renders table with all plans", () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Check that all plan names are rendered
      expect(screen.getByText("West Region Q1")).toBeInTheDocument();
      expect(screen.getByText("East Coast Expansion")).toBeInTheDocument();
      expect(screen.getByText("Archived Plan")).toBeInTheDocument();
    });

    it("displays plan details in columns", () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Check color dots are rendered
      const colorDots = document.querySelectorAll('[style*="background-color"]');
      expect(colorDots.length).toBeGreaterThanOrEqual(3);

      // Check owners
      expect(screen.getByText("John Smith")).toBeInTheDocument();
      expect(screen.getByText("Jane Doe")).toBeInTheDocument();

      // Check FY badges (use getAllByText since we have multiple FY26)
      const fy26Badges = screen.getAllByText("FY26");
      expect(fy26Badges.length).toBeGreaterThanOrEqual(2);
      expect(screen.getByText("FY25")).toBeInTheDocument();

      // Check status badges
      expect(screen.getByText("Working")).toBeInTheDocument();
      expect(screen.getByText("Planning")).toBeInTheDocument();
      expect(screen.getByText("Archived")).toBeInTheDocument();

      // Check district counts
      expect(screen.getByText("15")).toBeInTheDocument();
      expect(screen.getByText("8")).toBeInTheDocument();
      expect(screen.getByText("3")).toBeInTheDocument();
    });

    it("shows empty state when no plans", () => {
      renderWithProviders(
        <PlansTable plans={[]} onSelectPlan={mockOnSelectPlan} />
      );

      expect(screen.getByText(/no plans/i)).toBeInTheDocument();
    });

    it("shows footer with total district count", () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Total should be 15 + 8 + 3 = 26
      const footer = document.querySelector("tfoot");
      expect(footer).toBeInTheDocument();

      // Check total text in footer
      const footerRow = within(footer!);
      expect(footerRow.getByText(/Total/)).toBeInTheDocument();
      // The total district count is in the footer
      expect(footerRow.getByText("26")).toBeInTheDocument();
    });
  });

  describe("navigation", () => {
    it("calls onSelectPlan when clicking district count", () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Click on district count "15"
      const districtCount = screen.getByText("15");
      fireEvent.click(districtCount);

      expect(mockOnSelectPlan).toHaveBeenCalledWith("plan-1");
    });

    it("calls onSelectPlan when clicking View button", () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Click View button for first plan
      const viewButtons = screen.getAllByRole("button", { name: /view/i });
      fireEvent.click(viewButtons[0]);

      expect(mockOnSelectPlan).toHaveBeenCalledWith("plan-1");
    });
  });

  describe("inline editing - name", () => {
    it("allows inline editing of name", async () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Click on name to edit
      const nameCell = screen.getByText("West Region Q1");
      fireEvent.click(nameCell);

      // Should show input
      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("West Region Q1");

      // Change value
      fireEvent.change(input, { target: { value: "Updated Name" } });

      // Blur to save
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "plan-1",
            name: "Updated Name",
          })
        );
      });
    });
  });

  describe("inline editing - status", () => {
    it("allows inline editing of status via dropdown", async () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Click on status to edit (first plan is "Working")
      const statusCell = screen.getByText("Working");
      fireEvent.click(statusCell);

      // Should show select dropdown
      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();

      // Change to planning
      fireEvent.change(select, { target: { value: "planning" } });

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            id: "plan-1",
            status: "planning",
          })
        );
      });
    });
  });

  describe("delete functionality", () => {
    it("shows delete confirmation modal when clicking delete", async () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Click delete button for first plan
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      // Modal should appear - check for the modal heading
      await waitFor(() => {
        expect(screen.getByText("Delete Plan?")).toBeInTheDocument();
      });

      // The plan name should appear in the modal message
      const modalText = screen.getByText(/Are you sure you want to delete/);
      expect(modalText).toBeInTheDocument();
    });

    it("closes modal when clicking cancel", async () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      // Open delete modal
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText("Delete Plan?")).toBeInTheDocument();
      });

      // Click cancel
      const cancelButton = screen.getByRole("button", { name: /cancel/i });
      fireEvent.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Delete Plan?")).not.toBeInTheDocument();
      });
    });
  });

  describe("hover effects", () => {
    it("has hover styling on rows", () => {
      renderWithProviders(
        <PlansTable plans={mockPlans} onSelectPlan={mockOnSelectPlan} />
      );

      const rows = screen.getAllByRole("row");
      // First row is header, so check data rows (index 1+)
      const dataRow = rows[1];
      expect(dataRow).toHaveClass("hover:bg-gray-50");
    });
  });
});
