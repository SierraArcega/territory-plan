import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";

// All ownership hooks funnel through fetchJson — intercept that one module.
vi.mock("@/features/shared/lib/api-client", () => ({
  API_BASE: "/api",
  fetchJson: vi.fn(),
}));

import { fetchJson } from "@/features/shared/lib/api-client";
import {
  useCollaborators,
  useAddCollaborator,
  useRemoveCollaborator,
  useWatchers,
  useAddWatcher,
  useRemoveWatcher,
} from "../queries";

const mockedFetchJson = fetchJson as unknown as ReturnType<typeof vi.fn>;

function wrapper(client: QueryClient) {
  return function Wrapper({ children }: { children: React.ReactNode }) {
    return React.createElement(QueryClientProvider, { client }, children as React.ReactElement);
  };
}

function makeClient() {
  return new QueryClient({
    defaultOptions: {
      queries: { retry: false, gcTime: 0 },
      mutations: { retry: false },
    },
  });
}

const LEAID = "0601234";

beforeEach(() => {
  mockedFetchJson.mockReset();
});

describe("useCollaborators", () => {
  it("fetches the collaborators endpoint and unwraps the list", async () => {
    mockedFetchJson.mockResolvedValue({
      collaborators: [
        { userId: "u1", source: "manual", addedAt: "2026-06-01T00:00:00.000Z", user: { id: "u1", fullName: "Ada", email: "ada@x.com", avatarUrl: null } },
      ],
    });
    const { result } = renderHook(() => useCollaborators(LEAID), { wrapper: wrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetchJson).toHaveBeenCalledWith(`/api/districts/${LEAID}/collaborators`);
    expect(result.current.data).toHaveLength(1);
    expect(result.current.data?.[0].userId).toBe("u1");
  });

  it("uses a stable key scoped under the district and stays disabled when leaid is null", () => {
    const { result } = renderHook(() => useCollaborators(null), { wrapper: wrapper(makeClient()) });
    expect(result.current.fetchStatus).toBe("idle");
    expect(mockedFetchJson).not.toHaveBeenCalled();
  });
});

describe("useWatchers", () => {
  it("fetches the watchers endpoint and unwraps the list", async () => {
    mockedFetchJson.mockResolvedValue({
      watchers: [
        { userId: "u2", addedAt: "2026-06-01T00:00:00.000Z", user: { id: "u2", fullName: "Grace", email: "grace@x.com", avatarUrl: null } },
      ],
    });
    const { result } = renderHook(() => useWatchers(LEAID), { wrapper: wrapper(makeClient()) });

    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(mockedFetchJson).toHaveBeenCalledWith(`/api/districts/${LEAID}/watchers`);
    expect(result.current.data?.[0].userId).toBe("u2");
  });
});

describe("collaborator mutations", () => {
  it("POSTs with userId and invalidates the collaborators key", async () => {
    mockedFetchJson.mockResolvedValue({ collaborator: null });
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAddCollaborator(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ leaid: LEAID, userId: "u9" });
    });

    expect(mockedFetchJson).toHaveBeenCalledWith(
      `/api/districts/${LEAID}/collaborators`,
      { method: "POST", body: JSON.stringify({ userId: "u9" }) }
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["district", LEAID, "collaborators"] });
  });

  it("DELETEs the specific collaborator and invalidates", async () => {
    mockedFetchJson.mockResolvedValue({ removed: 1 });
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRemoveCollaborator(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ leaid: LEAID, userId: "u9" });
    });

    expect(mockedFetchJson).toHaveBeenCalledWith(
      `/api/districts/${LEAID}/collaborators/u9`,
      { method: "DELETE" }
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["district", LEAID, "collaborators"] });
  });
});

describe("watcher mutations", () => {
  it("POSTs and invalidates the watchers key", async () => {
    mockedFetchJson.mockResolvedValue({ watcher: null });
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useAddWatcher(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ leaid: LEAID, userId: "self" });
    });

    expect(mockedFetchJson).toHaveBeenCalledWith(
      `/api/districts/${LEAID}/watchers`,
      { method: "POST", body: JSON.stringify({ userId: "self" }) }
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["district", LEAID, "watchers"] });
  });

  it("DELETEs the specific watcher and invalidates", async () => {
    mockedFetchJson.mockResolvedValue({ removed: 1 });
    const client = makeClient();
    const invalidate = vi.spyOn(client, "invalidateQueries");
    const { result } = renderHook(() => useRemoveWatcher(), { wrapper: wrapper(client) });

    await act(async () => {
      await result.current.mutateAsync({ leaid: LEAID, userId: "self" });
    });

    expect(mockedFetchJson).toHaveBeenCalledWith(
      `/api/districts/${LEAID}/watchers/self`,
      { method: "DELETE" }
    );
    expect(invalidate).toHaveBeenCalledWith({ queryKey: ["district", LEAID, "watchers"] });
  });
});
