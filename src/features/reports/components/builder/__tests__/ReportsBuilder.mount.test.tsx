import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, waitFor } from "@testing-library/react";
import React from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

// We mock the network layer so the real /api/reports/{id}/run is never hit —
// we only need to verify the mount effect *invokes* the mutation, not that it
// completes against a real server.
const mutateMock = vi.fn();

vi.mock("../../../lib/queries", async () => {
  const actual = await vi.importActual<typeof import("../../../lib/queries")>(
    "../../../lib/queries",
  );
  return {
    ...actual,
    useRunSavedReport: () => ({
      mutate: mutateMock,
      isPending: false,
      isError: false,
      error: null,
    }),
  };
});

vi.mock("../../../hooks/useChatTurnStream", () => ({
  useChatTurnStream: () => ({ submit: vi.fn(), isPending: false }),
}));

// jsdom doesn't ship a fetch polyfill — give it a noop so the title-fetch in
// the mount effect resolves silently.
beforeEach(() => {
  mutateMock.mockReset();
  // @ts-expect-error - jsdom has no fetch by default
  global.fetch = vi.fn(() =>
    Promise.resolve({ ok: true, json: () => Promise.resolve({ report: null }) }),
  );
});

import { ReportsBuilder } from "../ReportsBuilder";

function renderWithClient(ui: React.ReactElement) {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  return render(<QueryClientProvider client={qc}>{ui}</QueryClientProvider>);
}

describe("ReportsBuilder mount effect", () => {
  it("fires runSaved.mutate when reportId is provided", async () => {
    renderWithClient(
      <ReportsBuilder
        reportId={42}
        initialPrompt={null}
        selectedVersionN={null}
        onNewReport={() => {}}
        onCollapseChat={() => {}}
      />,
    );

    await waitFor(() => {
      expect(mutateMock).toHaveBeenCalled();
    });
    expect(mutateMock.mock.calls[0]![0]).toBe(42);
  });

  it("does not fire runSaved.mutate when reportId is null", async () => {
    renderWithClient(
      <ReportsBuilder
        reportId={null}
        initialPrompt={null}
        selectedVersionN={null}
        onNewReport={() => {}}
        onCollapseChat={() => {}}
      />,
    );

    // Give effects time to run.
    await new Promise((r) => setTimeout(r, 50));
    expect(mutateMock).not.toHaveBeenCalled();
  });
});
