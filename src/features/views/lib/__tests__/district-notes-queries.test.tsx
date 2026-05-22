import { describe, it, expect, vi, beforeEach } from "vitest";
import { renderHook, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import React from "react";
import { useDistrictNotes, useCreateDistrictNote } from "../queries";

function wrapper() {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return ({ children }: { children: React.ReactNode }) => (
    <QueryClientProvider client={qc}>{children}</QueryClientProvider>
  );
}

beforeEach(() => vi.restoreAllMocks());

describe("useDistrictNotes", () => {
  it("fetches the leaid's notes", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ notes: [{ id: "n1", bodyText: "hi" }] }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    ));
    const { result } = renderHook(() => useDistrictNotes("3601234"), { wrapper: wrapper() });
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data?.[0].id).toBe("n1");
    vi.unstubAllGlobals();
  });
});

describe("useCreateDistrictNote", () => {
  it("POSTs bodyJson + bodyText", async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ id: "n2", bodyText: "x" }), {
        status: 200,
        headers: { "Content-Type": "application/json" },
      }),
    );
    vi.stubGlobal("fetch", fetchMock);
    const { result } = renderHook(() => useCreateDistrictNote(), { wrapper: wrapper() });
    await result.current.mutateAsync({ leaid: "3601234", bodyJson: { type: "doc" }, bodyText: "x" });
    const [url, init] = fetchMock.mock.calls[0];
    expect(String(url)).toContain("/districts/3601234/notes");
    expect(init.method).toBe("POST");
    expect(JSON.parse(String(init.body))).toEqual({ bodyJson: { type: "doc" }, bodyText: "x" });
    vi.unstubAllGlobals();
  });
});
