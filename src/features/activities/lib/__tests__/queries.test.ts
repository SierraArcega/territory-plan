import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

vi.mock("@/features/shared/lib/api-client", () => ({
  fetchJson: vi.fn(),
  API_BASE: "/api",
}));

import { fetchJson } from "@/features/shared/lib/api-client";
const mockFetch = vi.mocked(fetchJson);

import { useUpdateActivity } from "../queries";

function makeWrapper() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) =>
    React.createElement(QueryClientProvider, { client: queryClient }, children);
}

describe("useUpdateActivity", () => {
  beforeEach(() => { mockFetch.mockReset(); });

  it("sends planIds and stateFips in the request body when provided", async () => {
    mockFetch.mockResolvedValue({ id: "act-1", type: "call", title: "Test", updatedAt: new Date().toISOString() });

    const { result } = renderHook(() => useUpdateActivity(), { wrapper: makeWrapper() });

    await result.current.mutateAsync({
      activityId: "act-1",
      title: "Test",
      planIds: ["plan-1", "plan-2"],
      stateFips: ["06", "08"],
    });

    expect(mockFetch).toHaveBeenCalledWith(
      "/api/activities/act-1",
      expect.objectContaining({
        method: "PATCH",
        body: expect.stringContaining('"planIds":["plan-1","plan-2"]'),
      })
    );
    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body.stateFips).toEqual(["06", "08"]);
  });

  it("omitting planIds and stateFips does not send them in the body", async () => {
    mockFetch.mockResolvedValue({ id: "act-1", type: "call", title: "Test", updatedAt: new Date().toISOString() });

    const { result } = renderHook(() => useUpdateActivity(), { wrapper: makeWrapper() });

    await result.current.mutateAsync({ activityId: "act-1", title: "Test" });

    const body = JSON.parse((mockFetch.mock.calls[0][1] as RequestInit).body as string);
    expect(body).not.toHaveProperty("planIds");
    expect(body).not.toHaveProperty("stateFips");
  });
});
