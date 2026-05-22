import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import type { ReactNode } from "react";
import {
  useSignalsSummary,
  useDistrictSignals,
  typesCsv,
} from "../queries";

const fetchMock = global.fetch as unknown as ReturnType<typeof vi.fn>;

function makeWrapper() {
  const qc = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

function mockJson(payload: unknown, status = 200) {
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

describe("typesCsv", () => {
  it("serializes active types in canonical order", () => {
    expect(typesCsv({ vac: true, news: true, rfp: true })).toBe("vac,news,rfp");
    expect(typesCsv({ vac: false, news: true, rfp: true })).toBe("news,rfp");
    expect(typesCsv({ vac: true, news: false, rfp: false })).toBe("vac");
  });

  it("is stable for deep-equal masks (drives stable query keys)", () => {
    const a = typesCsv({ vac: true, news: false, rfp: true });
    const b = typesCsv({ vac: true, news: false, rfp: true });
    expect(a).toBe(b);
  });
});

describe("useSignalsSummary", () => {
  it("calls /api/signals with planId for plan scope", async () => {
    fetchMock.mockResolvedValueOnce(mockJson({ districts: [], total: 0 }));
    renderHook(
      () =>
        useSignalsSummary({
          parentKind: "plan",
          parentId: "p1",
          leaids: null,
          types: { vac: true, news: true, rfp: true },
          since: "30d",
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/signals?");
    expect(url).toContain("planId=p1");
    expect(url).toContain("types=vac%2Cnews%2Crfp");
    expect(url).toContain("since=30d");
  });

  it("stays disabled for a list scope with no resolved leaids", async () => {
    renderHook(
      () =>
        useSignalsSummary({
          parentKind: "list",
          parentId: "l1",
          leaids: null,
          types: { vac: true, news: true, rfp: true },
          since: "30d",
        }),
      { wrapper: makeWrapper() },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });
});

describe("useDistrictSignals", () => {
  it("does not fetch while collapsed (enabled=false)", async () => {
    renderHook(
      () =>
        useDistrictSignals({
          leaid: "1234567",
          types: { vac: true, news: true, rfp: true },
          since: "30d",
          page: 1,
          enabled: false,
        }),
      { wrapper: makeWrapper() },
    );
    await new Promise((r) => setTimeout(r, 20));
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("fetches /api/signals/[leaid] with limit=page*50 and offset=0 when enabled", async () => {
    fetchMock.mockResolvedValueOnce(mockJson({ items: [], hasMore: false }));
    renderHook(
      () =>
        useDistrictSignals({
          leaid: "1234567",
          types: { vac: true, news: false, rfp: true },
          since: "7d",
          page: 2,
          enabled: true,
        }),
      { wrapper: makeWrapper() },
    );
    await waitFor(() => expect(fetchMock).toHaveBeenCalled());
    const url = fetchMock.mock.calls[0][0] as string;
    expect(url).toContain("/api/signals/1234567?");
    expect(url).toContain("types=vac%2Crfp");
    expect(url).toContain("since=7d");
    expect(url).toContain("limit=100");
    expect(url).toContain("offset=0");
  });
});
