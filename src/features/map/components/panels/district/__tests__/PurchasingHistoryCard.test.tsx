import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, fireEvent, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import PurchasingHistoryCard from "../PurchasingHistoryCard";
import type { FullmindData } from "@/lib/api";

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const mockFullmindData: FullmindData = {
  leaid: "123456",
  accountName: "Test District",
  salesExecutive: null,
  lmsid: null,
  districtFinancials: [
    {
      vendor: "fullmind", fiscalYear: "FY25",
      totalRevenue: 100000, allTake: 50000, sessionCount: 120, subscriptionCount: 0,
      closedWonOppCount: 3, closedWonBookings: 85000, invoicing: 98000,
      openPipelineOppCount: null, openPipeline: null, weightedPipeline: null,
      poCount: null,
    },
    {
      vendor: "fullmind", fiscalYear: "FY26",
      totalRevenue: 142500, allTake: 70000, sessionCount: 180, subscriptionCount: 0,
      closedWonOppCount: 5, closedWonBookings: 120000, invoicing: 130000,
      openPipelineOppCount: 2, openPipeline: 50000, weightedPipeline: 30000,
      poCount: null,
    },
    {
      vendor: "fullmind", fiscalYear: "FY27",
      totalRevenue: null, allTake: null, sessionCount: null, subscriptionCount: null,
      closedWonOppCount: null, closedWonBookings: null, invoicing: null,
      openPipelineOppCount: 1, openPipeline: 25000, weightedPipeline: 15000,
      poCount: null,
    },
  ],
  isCustomer: true,
  hasOpenPipeline: true,
};

const mockCompetitorsResponse = {
  competitors: [
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
  competitors: [],
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
    mockFetchResponse(mockCompetitorsResponse);

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
    mockFetchResponse(mockCompetitorsResponse);

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
    mockFetchResponse(mockCompetitorsResponse);

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
    mockFetchResponse(mockCompetitorsResponse);

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

  it("shows Elevate K12 provenance line when FY26 has subscriptions", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    const fullmindWithSubs: FullmindData = {
      ...mockFullmindData,
      districtFinancials: mockFullmindData.districtFinancials.map((row) =>
        row.fiscalYear === "FY26" ? { ...row, subscriptionCount: 47 } : row,
      ),
    };

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={fullmindWithSubs} leaid="3400001" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("incl. 47 Elevate K12 subscriptions (acquired)"),
      ).toBeInTheDocument();
    });
  });

  it("uses singular wording when subscription count is exactly 1", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    const fullmindWithOneSub: FullmindData = {
      ...mockFullmindData,
      districtFinancials: mockFullmindData.districtFinancials.map((row) =>
        row.fiscalYear === "FY26" ? { ...row, subscriptionCount: 1 } : row,
      ),
    };

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={fullmindWithOneSub} leaid="3400001" />,
    );

    await waitFor(() => {
      expect(
        screen.getByText("incl. 1 Elevate K12 subscription (acquired)"),
      ).toBeInTheDocument();
    });
  });

  it("hides Elevate K12 provenance line when subscription count is 0", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={mockFullmindData} leaid="3400001" />,
    );

    // Headline should still render (FY26 revenue exists)
    await waitFor(() => {
      expect(screen.getByText("FY26 Revenue")).toBeInTheDocument();
    });

    // Provenance line should NOT appear
    expect(
      screen.queryByText(/Elevate K12 subscription/),
    ).not.toBeInTheDocument();
  });

  it("shows Elevate K12 provenance line under FY25 headline when only FY25 has revenue + subs", async () => {
    mockFetchResponse(emptyCompetitorResponse);

    const fullmindFy25Only: FullmindData = {
      ...mockFullmindData,
      districtFinancials: [
        {
          vendor: "fullmind",
          fiscalYear: "FY25",
          totalRevenue: 80000,
          allTake: 40000,
          sessionCount: 0,
          subscriptionCount: 12,
          closedWonOppCount: 1,
          closedWonBookings: 80000,
          invoicing: 80000,
          openPipelineOppCount: null,
          openPipeline: null,
          weightedPipeline: null,
          poCount: null,
        },
      ],
    };

    renderWithProviders(
      <PurchasingHistoryCard fullmindData={fullmindFy25Only} leaid="3400001" />,
    );

    await waitFor(() => {
      expect(screen.getByText("FY25 Revenue")).toBeInTheDocument();
    });
    expect(
      screen.getByText("incl. 12 Elevate K12 subscriptions (acquired)"),
    ).toBeInTheDocument();
  });

  it("shows PO count with correct singular/plural label", async () => {
    mockFetchResponse({
      competitors: [
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
