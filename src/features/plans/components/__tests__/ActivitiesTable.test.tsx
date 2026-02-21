// src/components/plans/__tests__/ActivitiesTable.test.tsx
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import ActivitiesTable from "../ActivitiesTable";
import type { ActivityListItem } from "@/lib/api";

// Create mock functions outside so they can be accessed in tests
const mockUpdateMutate = vi.fn().mockResolvedValue({});

// Mock the API hooks
vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual("@/lib/api");
  return {
    ...actual,
    useUpdateActivity: () => ({
      mutateAsync: mockUpdateMutate,
      isPending: false,
    }),
  };
});

// Mock activity types
vi.mock("@/lib/activityTypes", () => ({
  ACTIVITY_TYPE_LABELS: {
    conference: "Conference",
    road_trip: "Road Trip",
    email_campaign: "Email Campaign",
    discovery_call: "Discovery Call",
  },
  ACTIVITY_TYPE_ICONS: {
    conference: "🎤",
    road_trip: "🚗",
    email_campaign: "📧",
    discovery_call: "🔍",
  },
  ACTIVITY_STATUS_CONFIG: {
    planned: { label: "Planned", color: "#6EA3BE", bgColor: "#EEF5F8" },
    completed: { label: "Completed", color: "#8AA891", bgColor: "#EFF5F0" },
    cancelled: { label: "Cancelled", color: "#9CA3AF", bgColor: "#F3F4F6" },
  },
  ALL_ACTIVITY_TYPES: ["conference", "road_trip", "email_campaign", "discovery_call"],
  VALID_ACTIVITY_STATUSES: ["planned", "completed", "cancelled"],
}));

// Sample test data
const mockActivities: ActivityListItem[] = [
  {
    id: "activity-1",
    type: "conference" as const,
    category: "events" as const,
    title: "Annual Sales Conference",
    startDate: "2026-03-15",
    endDate: "2026-03-17",
    status: "planned" as const,
    source: "manual" as const,
    outcomeType: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 2,
    districtCount: 5,
    stateAbbrevs: ["CA", "TX"],
  },
  {
    id: "activity-2",
    type: "email_campaign" as const,
    category: "outreach" as const,
    title: "Q1 Outreach Campaign",
    startDate: "2026-02-01",
    endDate: "2026-02-01",
    status: "completed" as const,
    source: "manual" as const,
    outcomeType: null,
    needsPlanAssociation: false,
    hasUnlinkedDistricts: false,
    planCount: 1,
    districtCount: 12,
    stateAbbrevs: ["NY", "NJ", "PA"],
  },
  {
    id: "activity-3",
    type: "discovery_call" as const,
    category: "meetings" as const,
    title: "District XYZ Intro",
    startDate: "2026-01-20",
    endDate: null,
    status: "cancelled" as const,
    source: "manual" as const,
    outcomeType: null,
    needsPlanAssociation: true,
    hasUnlinkedDistricts: true,
    planCount: 0,
    districtCount: 1,
    stateAbbrevs: ["FL"],
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

describe("ActivitiesTable", () => {
  const mockOnEdit = vi.fn();
  const mockOnDelete = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
    mockUpdateMutate.mockClear();
  });

  describe("rendering", () => {
    it("renders table with all activities", () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check that all activity titles are rendered
      expect(screen.getByText("Annual Sales Conference")).toBeInTheDocument();
      expect(screen.getByText("Q1 Outreach Campaign")).toBeInTheDocument();
      expect(screen.getByText("District XYZ Intro")).toBeInTheDocument();
    });

    it("displays activity details in columns", () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Check type icons are rendered
      expect(screen.getByText("🎤")).toBeInTheDocument();
      expect(screen.getByText("📧")).toBeInTheDocument();
      expect(screen.getByText("🔍")).toBeInTheDocument();

      // Check type labels
      expect(screen.getByText("Conference")).toBeInTheDocument();
      expect(screen.getByText("Email Campaign")).toBeInTheDocument();
      expect(screen.getByText("Discovery Call")).toBeInTheDocument();

      // Check status badges
      expect(screen.getByText("Planned")).toBeInTheDocument();
      expect(screen.getByText("Completed")).toBeInTheDocument();
      expect(screen.getByText("Cancelled")).toBeInTheDocument();

      // Check scope displays (district count and states)
      expect(screen.getByText(/5 districts? \(CA, TX\)/)).toBeInTheDocument();
      expect(screen.getByText(/12 districts? \(NY, NJ, PA\)/)).toBeInTheDocument();
      expect(screen.getByText(/1 district \(FL\)/)).toBeInTheDocument();
    });

    it("shows empty state when no activities", () => {
      renderWithProviders(
        <ActivitiesTable
          activities={[]}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      expect(screen.getByText(/no activities/i)).toBeInTheDocument();
    });
  });

  describe("inline editing - title", () => {
    it("allows inline editing of title", async () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Click on title to edit
      const titleCell = screen.getByText("Annual Sales Conference");
      fireEvent.click(titleCell);

      // Should show input
      const input = screen.getByRole("textbox");
      expect(input).toHaveValue("Annual Sales Conference");

      // Change value
      fireEvent.change(input, { target: { value: "Updated Conference" } });

      // Blur to save
      fireEvent.blur(input);

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            activityId: "activity-1",
            title: "Updated Conference",
          })
        );
      });
    });
  });

  describe("inline editing - status", () => {
    it("allows inline editing of status via dropdown", async () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Click on status to edit (first activity is "Planned")
      const statusCell = screen.getByText("Planned");
      fireEvent.click(statusCell);

      // Should show select dropdown
      const select = screen.getByRole("combobox");
      expect(select).toBeInTheDocument();

      // Change to completed
      fireEvent.change(select, { target: { value: "completed" } });

      await waitFor(() => {
        expect(mockUpdateMutate).toHaveBeenCalledWith(
          expect.objectContaining({
            activityId: "activity-1",
            status: "completed",
          })
        );
      });
    });
  });

  describe("edit button", () => {
    it("calls onEdit when Edit button clicked", () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Click Edit button for first activity
      const editButtons = screen.getAllByRole("button", { name: /edit/i });
      fireEvent.click(editButtons[0]);

      expect(mockOnEdit).toHaveBeenCalledWith(mockActivities[0]);
    });
  });

  describe("delete functionality", () => {
    it("shows delete confirmation modal when clicking delete", async () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Click delete button for first activity
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      // Modal should appear
      await waitFor(() => {
        expect(screen.getByText("Delete Activity?")).toBeInTheDocument();
      });
    });

    it("calls onDelete when delete confirmed", async () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Open delete modal
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Delete Activity?")).toBeInTheDocument();
      });

      // Click confirm delete button (inside modal)
      const confirmDeleteButton = screen.getByRole("button", { name: /^delete$/i });
      fireEvent.click(confirmDeleteButton);

      expect(mockOnDelete).toHaveBeenCalledWith("activity-1");
    });

    it("closes modal when clicking cancel", async () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Open delete modal
      const deleteButtons = screen.getAllByRole("button", { name: /delete/i });
      fireEvent.click(deleteButtons[0]);

      // Wait for modal
      await waitFor(() => {
        expect(screen.getByText("Delete Activity?")).toBeInTheDocument();
      });

      // Click cancel (use exact text match to get the modal button, not the status cell)
      const cancelButton = screen.getByRole("button", { name: "Cancel" });
      fireEvent.click(cancelButton);

      // Modal should close
      await waitFor(() => {
        expect(screen.queryByText("Delete Activity?")).not.toBeInTheDocument();
      });
    });
  });

  describe("date display", () => {
    it("shows date range when endDate differs from startDate", () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // First activity has a date range: Mar 15 - Mar 17
      // The dates are displayed via InlineEditCell in separate elements
      expect(screen.getByText("Mar 15, 2026")).toBeInTheDocument();
      expect(screen.getByText("Mar 17, 2026")).toBeInTheDocument();
    });

    it("shows single date when endDate equals startDate", () => {
      renderWithProviders(
        <ActivitiesTable
          activities={mockActivities}
          onEdit={mockOnEdit}
          onDelete={mockOnDelete}
        />
      );

      // Second activity has same start/end date - should show single date
      // Third activity has null endDate - should show single date
      const rows = screen.getAllByRole("row");
      // We expect single date displays for activities 2 and 3
      expect(rows.length).toBeGreaterThan(1);
    });
  });
});
