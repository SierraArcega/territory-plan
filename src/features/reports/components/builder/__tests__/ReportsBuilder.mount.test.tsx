import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

vi.mock("../../../hooks/useChatTurnStream", () => ({
  useChatTurnStream: () => ({ submit: vi.fn(), isPending: false }),
}));

// Capture what fetch was called with so we can assert the /run endpoint was hit
// and feed back a realistic response.
const fetchMock = vi.fn();

beforeEach(() => {
  fetchMock.mockReset();
  fetchMock.mockImplementation((url: string) => {
    if (url.endsWith("/run")) {
      return Promise.resolve({
        ok: true,
        json: () =>
          Promise.resolve({
            sql: "SELECT 1",
            summary: { source: "Mock saved report" },
            columns: ["a"],
            rows: [{ a: 1 }, { a: 2 }, { a: 3 }],
            rowCount: 3,
            executionTimeMs: 12,
          }),
      });
    }
    // Title fetch.
    return Promise.resolve({
      ok: true,
      json: () => Promise.resolve({ report: { title: "Stub", description: "" } }),
    });
  });
  global.fetch = fetchMock as unknown as typeof fetch;
});

import { ReportsBuilder } from "../ReportsBuilder";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ReportsBuilder mount effect", () => {
  it("POSTs /api/reports/{id}/run and renders the result when reportId is provided", async () => {
    renderWithClient(
      <ReportsBuilder
        reportId={42}
        initialPrompt={null}
        selectedVersionN={null}
        onNewReport={() => {}}
        onCollapseChat={() => {}}
        onBackToLibrary={() => {}}
      />,
    );

    await waitFor(() => {
      expect(fetchMock).toHaveBeenCalledWith(
        "/api/reports/42/run",
        expect.objectContaining({ method: "POST" }),
      );
    });
    // The synthetic v1 turn lands → the row count surfaces in the results pane.
    await waitFor(() => {
      expect(screen.getAllByText(/3 rows/).length).toBeGreaterThan(0);
    });
  });

  it("does not POST /run when reportId is null", async () => {
    renderWithClient(
      <ReportsBuilder
        reportId={null}
        initialPrompt={null}
        selectedVersionN={null}
        onNewReport={() => {}}
        onCollapseChat={() => {}}
        onBackToLibrary={() => {}}
      />,
    );

    // Give effects time to run.
    await new Promise((r) => setTimeout(r, 50));
    const runCalls = fetchMock.mock.calls.filter((c) =>
      String(c[0]).endsWith("/run"),
    );
    expect(runCalls).toHaveLength(0);
  });
});
