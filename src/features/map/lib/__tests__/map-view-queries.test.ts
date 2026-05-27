import { describe, it, expect, vi, beforeEach } from "vitest";

const { fetchJson } = vi.hoisted(() => ({ fetchJson: vi.fn() }));
vi.mock("@/features/shared/lib/api-client", () => ({
  fetchJson,
  API_BASE: "/api",
}));

import { resolveAndApplyMapView } from "../map-view-queries";

describe("resolveAndApplyMapView", () => {
  beforeEach(() => fetchJson.mockReset());

  it("resolves a view by name (case-insensitive) and applies its state", async () => {
    fetchJson
      // list (newest-first, as the API returns it)
      .mockResolvedValueOnce([
        { id: "v2", name: "Texas Charters", updatedAt: "2026-01-02" },
        { id: "v1", name: "Old", updatedAt: "2026-01-01" },
      ])
      // detail for the matched id
      .mockResolvedValueOnce({ id: "v2", state: { filterStates: ["TX"] } });

    const apply = vi.fn();
    const name = await resolveAndApplyMapView("texas charters", apply);

    expect(name).toBe("Texas Charters");
    expect(apply).toHaveBeenCalledWith({ filterStates: ["TX"] });
    expect(fetchJson).toHaveBeenNthCalledWith(2, "/api/map-views/v2");
  });

  it("throws and does not apply when no view matches the name", async () => {
    fetchJson.mockResolvedValueOnce([{ id: "v1", name: "Other" }]);
    const apply = vi.fn();
    await expect(resolveAndApplyMapView("ghost", apply)).rejects.toThrow(
      /No map view named/,
    );
    expect(apply).not.toHaveBeenCalled();
  });
});
