import { describe, it, expect, vi } from "vitest";
import { renderHook, waitFor, act } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useChatTurn } from "../useChatTurn";

function wrapper({ children }: { children: React.ReactNode }) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}

describe("useChatTurn", () => {
  it("posts a chat message and returns the response", async () => {
    const fetchSpy = vi.spyOn(globalThis, "fetch").mockResolvedValue(
      new Response(
        JSON.stringify({
          conversationId: "c1",
          assistantText: "here",
          result: {
            sql: "SELECT 1 LIMIT 100",
            summary: { source: "x", filters: [], columns: [], sort: null, limit: 100 },
            columns: [],
            rows: [],
            rowCount: 0,
            executionTimeMs: 1,
          },
        }),
        { status: 200 },
      ),
    );

    const { result } = renderHook(() => useChatTurn(), { wrapper });
    act(() => {
      result.current.mutate({ message: "hi" });
    });
    await waitFor(() => expect(result.current.data).toBeDefined());
    expect(result.current.data!.conversationId).toBe("c1");
    expect(fetchSpy).toHaveBeenCalledWith(
      "/api/ai/query/chat",
      expect.objectContaining({ method: "POST" }),
    );
    fetchSpy.mockRestore();
  });
});
