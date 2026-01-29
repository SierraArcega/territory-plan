import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import AddToPlanButton from "../AddToPlanButton";

// Mock the API hooks
const mockMutateAsync = vi.fn();
const mockCreateMutateAsync = vi.fn();

vi.mock("@/lib/api", () => ({
  useTerritoryPlans: vi.fn(() => ({
    data: [
      {
        id: "plan-1",
        name: "Test Plan 1",
        color: "#403770",
        districtCount: 5,
      },
      {
        id: "plan-2",
        name: "Test Plan 2",
        color: "#F37167",
        districtCount: 3,
      },
    ],
    isLoading: false,
  })),
  useAddDistrictsToPlan: vi.fn(() => ({
    mutateAsync: mockMutateAsync,
    isPending: false,
  })),
  useCreateTerritoryPlan: vi.fn(() => ({
    mutateAsync: mockCreateMutateAsync,
    isPending: false,
  })),
}));

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

describe("AddToPlanButton", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders the button", () => {
    renderWithQueryClient(<AddToPlanButton leaid="1234567" />);
    expect(screen.getByText("Add to Plan")).toBeInTheDocument();
  });

  it("opens dropdown when clicked", async () => {
    renderWithQueryClient(<AddToPlanButton leaid="1234567" />);

    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(screen.getByText("Test Plan 1")).toBeInTheDocument();
      expect(screen.getByText("Test Plan 2")).toBeInTheDocument();
    });
  });

  it("shows district counts for each plan", async () => {
    renderWithQueryClient(<AddToPlanButton leaid="1234567" />);

    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(screen.getByText("5 districts")).toBeInTheDocument();
      expect(screen.getByText("3 districts")).toBeInTheDocument();
    });
  });

  it("shows checkmark for plans the district is already in", async () => {
    renderWithQueryClient(
      <AddToPlanButton leaid="1234567" existingPlanIds={["plan-1"]} />
    );

    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      // The first plan should have a checkmark (we can check the button is disabled)
      const plan1Button = screen.getByText("Test Plan 1").closest("button");
      expect(plan1Button).toBeDisabled();
    });
  });

  it("calls addDistricts mutation when selecting a plan", async () => {
    mockMutateAsync.mockResolvedValueOnce({ added: 1, planId: "plan-1" });

    renderWithQueryClient(<AddToPlanButton leaid="1234567" />);

    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(screen.getByText("Test Plan 1")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Test Plan 1"));

    await waitFor(() => {
      expect(mockMutateAsync).toHaveBeenCalledWith({
        planId: "plan-1",
        leaids: "1234567",
      });
    });
  });

  it("shows create new plan form when clicking create button", async () => {
    renderWithQueryClient(<AddToPlanButton leaid="1234567" />);

    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(screen.getByText("Create new plan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create new plan"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Plan name")).toBeInTheDocument();
      expect(screen.getByText("Create & Add District")).toBeInTheDocument();
    });
  });

  it("creates a new plan and adds district when submitting form", async () => {
    mockCreateMutateAsync.mockResolvedValueOnce({ id: "new-plan", name: "My New Plan" });
    mockMutateAsync.mockResolvedValueOnce({ added: 1, planId: "new-plan" });

    renderWithQueryClient(<AddToPlanButton leaid="1234567" />);

    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(screen.getByText("Create new plan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create new plan"));

    await waitFor(() => {
      expect(screen.getByPlaceholderText("Plan name")).toBeInTheDocument();
    });

    const input = screen.getByPlaceholderText("Plan name");
    fireEvent.change(input, { target: { value: "My New Plan" } });
    fireEvent.click(screen.getByText("Create & Add District"));

    await waitFor(() => {
      expect(mockCreateMutateAsync).toHaveBeenCalledWith({
        name: "My New Plan",
        color: "#403770",
      });
    });
  });

  it("shows color options in create new plan form", async () => {
    renderWithQueryClient(<AddToPlanButton leaid="1234567" />);

    fireEvent.click(screen.getByText("Add to Plan"));

    await waitFor(() => {
      expect(screen.getByText("Create new plan")).toBeInTheDocument();
    });

    fireEvent.click(screen.getByText("Create new plan"));

    await waitFor(() => {
      expect(screen.getByText("Color")).toBeInTheDocument();
      // There should be 5 color buttons
      const colorButtons = screen.getAllByTitle(/Plum|Coral|Steel Blue|Sage|Gold/);
      expect(colorButtons.length).toBe(5);
    });
  });
});
