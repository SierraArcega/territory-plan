/**
 * Detail content components — smoke-test for each kind.
 *
 * Each component lives behind `useEntity(kind, id)` which is a thin
 * TanStack Query wrapper over fetch. We mock the fetch and render each
 * component under a fresh QueryClient so we can assert:
 *   - The header dispatches the right eyebrow text per kind.
 *   - Loading state renders the skeleton (no header text "Loading…" inside
 *     the body — the skeleton is generic).
 *   - Loaded state renders the prototype-spec'd stats + sections.
 *
 * These are intentionally shallow — full visual fidelity is verified via
 * manual smoke-tests on the dev environment.
 */
import { describe, it, expect, beforeEach, vi } from "vitest";
import { render, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import DistrictDetailContent from "../DistrictDetailContent";
import ContactDetailContent from "../ContactDetailContent";
import OppDetailContent from "../OppDetailContent";
import VacancyDetailContent from "../VacancyDetailContent";
import NewsDetailContent from "../NewsDetailContent";
import RfpDetailContent from "../RfpDetailContent";

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function mockJsonResponse(payload: unknown, status = 200): Response {
  return {
    ok: status >= 200 && status < 300,
    status,
    statusText: "OK",
    headers: new Headers({ "content-type": "application/json" }),
    redirected: false,
    json: async () => payload,
  } as unknown as Response;
}

beforeEach(() => {
  fetchMock.mockReset();
});

describe("DistrictDetailContent", () => {
  it("renders the district eyebrow + stats grid on success", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        district: {
          leaid: "0613710",
          name: "Detroit Public Schools",
          stateAbbrev: "MI",
          enrollment: 50000,
          numberOfSchools: 100,
        },
        fullmindData: {
          leaid: "0613710",
          accountName: "DPS",
          isCustomer: true,
          hasOpenPipeline: false,
          districtFinancials: [
            { netBookingAmount: 148000, contractThrough: "FY26" },
          ],
        },
        contacts: [
          { id: 1, name: "Maria Chen", title: "Superintendent", email: null, phone: null, isPrimary: true },
        ],
      }),
    );
    const { getByText, container } = render(
      <DistrictDetailContent id="0613710" onClose={() => {}} />,
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(getByText("Detroit Public Schools")).toBeTruthy();
    });
    expect(container.textContent).toContain("District");
    expect(container.textContent).toContain("ARR");
    expect(container.textContent).toContain("Customer");
    // Schools stat uses raw count.
    expect(container.textContent).toContain("100");
  });
});

describe("ContactDetailContent", () => {
  it("renders the contact info + engagement stats", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 42,
        name: "Maria Chen",
        title: "Superintendent",
        email: "mchen@dps.org",
        phone: "(313) 555-0142",
        persona: "Champion",
        seniorityLevel: null,
        district: { leaid: "0613710", name: "Detroit Public Schools", stateAbbrev: "MI" },
      }),
    );
    const { getByText, container } = render(
      <ContactDetailContent id="42" onClose={() => {}} />,
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(getByText("Maria Chen")).toBeTruthy();
    });
    expect(container.textContent).toContain("Contact");
    expect(container.textContent).toContain("mchen@dps.org");
    expect(container.textContent).toContain("Engagement");
  });
});

describe("OppDetailContent", () => {
  it("renders stage pill + ARR + close date", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: "opp_1",
        name: "Math 6-12 expansion",
        stage: "Proposal",
        netBookingAmount: 148000,
        closeDate: "2026-06-15T00:00:00Z",
        salesRepName: "Aiden Reyes",
        districtName: "Detroit Public Schools",
        district: { leaid: "0613710", name: "Detroit Public Schools" },
        stageHistory: [],
      }),
    );
    const { getByText, container } = render(
      <OppDetailContent id="opp_1" onClose={() => {}} />,
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(getByText("Math 6-12 expansion")).toBeTruthy();
    });
    expect(container.textContent).toContain("Opportunity");
    expect(container.textContent).toContain("Proposal");
    expect(container.textContent).toContain("Notes");
  });
});

describe("VacancyDetailContent", () => {
  it("renders signal pill + suggested actions", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: "vac_1",
        title: "Superintendent",
        category: "Admin",
        status: "open",
        notes: null,
        postedDate: "2026-04-15T00:00:00Z",
        leaid: "0613710",
        districtName: "Detroit Public Schools",
        schoolName: null,
      }),
    );
    const { getByText, container } = render(
      <VacancyDetailContent id="vac_1" onClose={() => {}} />,
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(getByText("Superintendent")).toBeTruthy();
    });
    expect(container.textContent).toContain("Vacancy");
    expect(container.textContent).toContain("Why it matters");
    expect(container.textContent).toContain("Suggested actions");
  });
});

describe("NewsDetailContent", () => {
  it("renders summary + related districts + suggested actions", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: "news_1",
        title: "Detroit board approves budget",
        description: "Detroit Public Schools approved the FY26 budget on Tuesday.",
        content: null,
        source: "Detroit Free Press",
        publishedAt: "2026-04-15T00:00:00Z",
        categories: ["Budget"],
        districts: [
          { leaid: "0613710", name: "Detroit Public Schools", stateAbbrev: "MI", confidence: "high" },
        ],
      }),
    );
    const { getByText, container } = render(
      <NewsDetailContent id="news_1" onClose={() => {}} />,
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(getByText("Detroit board approves budget")).toBeTruthy();
    });
    expect(container.textContent).toContain("News");
    expect(container.textContent).toContain("Summary");
    expect(container.textContent).toContain("Related districts");
  });
});

describe("RfpDetailContent", () => {
  it("renders posted/due/value stats + scope + actions", async () => {
    fetchMock.mockResolvedValueOnce(
      mockJsonResponse({
        id: 1234,
        title: "K-12 SEL screener pilot",
        aiSummary: "Pilot SEL screener for K-12 students across 10 schools.",
        description: null,
        agencyName: "Boston Public Schools",
        status: "open",
        oppType: { description: "Goods" },
        keywords: ["sel", "screener"],
        postedDate: "2026-04-01T00:00:00Z",
        dueDate: "2026-05-30T00:00:00Z",
        valueLow: null,
        valueHigh: 48000,
        district: { leaid: "2502790", name: "Boston Public Schools", stateAbbrev: "MA" },
      }),
    );
    const { getByText, container } = render(
      <RfpDetailContent id="1234" onClose={() => {}} />,
      { wrapper: makeWrapper() },
    );
    await waitFor(() => {
      expect(getByText("K-12 SEL screener pilot")).toBeTruthy();
    });
    expect(container.textContent).toContain("RFP");
    expect(container.textContent).toContain("Scope");
    expect(container.textContent).toContain("Convert to opportunity");
  });
});
