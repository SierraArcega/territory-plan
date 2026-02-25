import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PurchasingHistoryCard from "../PurchasingHistoryCard";
import type { FullmindData } from "@/lib/api";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockFullmindData: FullmindData = {
  leaid: "3400001",
  accountName: "Test District",
  salesExecutive: "Jane Doe",
  lmsid: null,
  fy25SessionsRevenue: 100000,
  fy25SessionsTake: 50000,
  fy25SessionsCount: 120,
  fy26SessionsRevenue: 142500,
  fy26SessionsTake: 70000,
  fy26SessionsCount: 180,
  fy25ClosedWonOppCount: 3,
  fy25ClosedWonNetBooking: 85000,
  fy25NetInvoicing: 98000,
  fy26ClosedWonOppCount: 5,
  fy26ClosedWonNetBooking: 120000,
  fy26NetInvoicing: 130000,
  fy26OpenPipelineOppCount: 2,
  fy26OpenPipeline: 50000,
  fy26OpenPipelineWeighted: 30000,
  fy27OpenPipelineOppCount: 1,
  fy27OpenPipeline: 25000,
  fy27OpenPipelineWeighted: 15000,
  isCustomer: true,
};

const mockCompetitorSpendResponse = {
  competitorSpend: [
    {
      competitor: "Educere",
      fiscalYear: "fy26",
      totalSpend: 15200,
      poCount: 3,
      color: "#403770",
    },
    {
      competitor: "Educere",
      fiscalYear: "fy25",
      totalSpend: 28400,
      poCount: 8,
      color: "#403770",
    },
    {
      competitor: "Proximity Learning",
      fiscalYear: "fy26",
      totalSpend: 8500,
      poCount: 2,
      color: "#6EA3BE",
    },
  ],
  totalAllCompetitors: 52100,
};

const emptyCompetitorResponse = {
  competitorSpend: [],
  totalAllCompetitors: 0,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function renderWithProviders(ui: React.ReactElement) {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: {
        retry: false,
      },
    },
  });
  return render(
    <QueryClientProvider client={queryClient}>{ui}</QueryClientProvider>,
  );
}

function mockFetchResponse(data: unknown) {
  vi.mocked(global.fetch).mockResolvedValue({
    ok: true,
    json: () => Promise.resolve(data),
  } as Response);
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PurchasingHistoryCard", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("renders competitor section when competitor data exists", async () => {
    mockFetchResponse(mockCompetitorSpendResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="3400001" />,
    );

    // Competitor section is inside the expandable detail -- click "View details"
    await waitFor(() => {
      expect(screen.getByText("View details")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("View details"));

    await waitFor(() => {
      expect(screen.getByText("Competitor Spend")).toBeInTheDocument();
    });

    expect(screen.getByText("Educere")).toBeInTheDocument();
    expect(screen.getByText("Proximity Learning")).toBeInTheDocument();
  });

  it("hides competitor section when no competitor data exists", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="3400001" />,
    );

    // The card should render (it has fullmind data)
    await waitFor(() => {
      expect(screen.getByText("Fullmind Purchasing")).toBeInTheDocument();
    });

    // The competitor section should not appear
    expect(screen.queryByText("Competitor Spend")).not.toBeInTheDocument();
  });

  it("renders when only competitor data exists and no Fullmind data", async () => {
    mockFetchResponse(mockCompetitorSpendResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={null} leaid="3400001" />,
    );

    // Should show "No purchasing history" for Fullmind section
    await waitFor(() => {
      expect(screen.getByText("No purchasing history")).toBeInTheDocument();
    });

    // Competitor section is inside expandable detail -- expand it
    await waitFor(() => {
      expect(screen.getByText("View details")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("View details"));

    await waitFor(() => {
      expect(screen.getByText("Competitor Spend")).toBeInTheDocument();
    });

    // Card is visible with competitor data
    expect(screen.getByText("Educere")).toBeInTheDocument();
  });

  it("shows Educere with correct color dot", async () => {
    mockFetchResponse(mockCompetitorSpendResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="3400001" />,
    );

    // Expand details to see competitor section
    await waitFor(() => {
      expect(screen.getByText("View details")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("View details"));

    await waitFor(() => {
      expect(screen.getByText("Educere")).toBeInTheDocument();
    });

    // Find the Educere competitor entry and verify its color dot
    const educereLabel = screen.getByText("Educere");
    const educereRow = educereLabel.closest("div")!;
    const colorDot = educereRow.querySelector("span[style]");
    expect(colorDot).not.toBeNull();
    expect(colorDot!.getAttribute("style")).toContain(
      "background-color: rgb(64, 55, 112)",
    );
  });

  it("returns null when no Fullmind or competitor data exists", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    const { container } = renderWithProviders(
      <PurchasingHistoryCard fullmindData={null} leaid="3400001" />,
    );

    // Wait for the query to settle
    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalled();
    });

    // Card should not render anything
    expect(container.innerHTML).toBe("");
  });

  it("fetches competitor spend for the correct leaid", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="0604020" />,
    );

    await waitFor(() => {
      expect(global.fetch).toHaveBeenCalledWith(
        "/api/districts/0604020/competitor-spend",
      );
    });
  });

  it("sorts competitors by total spend descending", async () => {
    mockFetchResponse(mockCompetitorSpendResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="3400001" />,
    );

    // Expand details
    await waitFor(() => {
      expect(screen.getByText("View details")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("View details"));

    await waitFor(() => {
      expect(screen.getByText("Educere")).toBeInTheDocument();
      expect(screen.getByText("Proximity Learning")).toBeInTheDocument();
    });

    // Educere total = 15200 + 28400 = 43600, Proximity = 8500
    // So Educere should appear first
    const competitorNames = screen.getAllByText(/^(Educere|Proximity Learning)$/);
    expect(competitorNames[0].textContent).toBe("Educere");
    expect(competitorNames[1].textContent).toBe("Proximity Learning");
  });

  it("displays FY26 revenue headline when fullmind data has FY26 revenue", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="3400001" />,
    );

    // $142.5K appears in headline and metric bar, so use getAllByText
    const matches = screen.getAllByText("$142.5K");
    expect(matches.length).toBeGreaterThanOrEqual(1);
    expect(screen.getByText("FY26 Revenue")).toBeInTheDocument();
  });

  it("shows PO count with correct singular/plural label", async () => {
    mockFetchResponse({
      competitorSpend: [
        {
          competitor: "Educere",
          fiscalYear: "fy26",
          totalSpend: 5000,
          poCount: 1,
          color: "#403770",
        },
        {
          competitor: "Educere",
          fiscalYear: "fy25",
          totalSpend: 10000,
          poCount: 4,
          color: "#403770",
        },
      ],
      totalAllCompetitors: 15000,
    });

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="3400001" />,
    );

    // Expand details
    await waitFor(() => {
      expect(screen.getByText("View details")).toBeInTheDocument();
    });
    fireEvent.click(screen.getByText("View details"));

    await waitFor(() => {
      expect(screen.getByText("(1 PO)")).toBeInTheDocument();
      expect(screen.getByText("(4 POs)")).toBeInTheDocument();
    });
  });
});
