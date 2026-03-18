import { describe, it, expect, beforeEach } from "vitest";
import { useMapV2Store } from "../store";
import type { OverlayLayerType } from "../store";

beforeEach(() => {
  useMapV2Store.setState({
    activeLayers: new Set<OverlayLayerType>(["districts"]),
    layerFilters: {
      contacts: {},
      vacancies: {},
      plans: {},
      activities: {},
    },
    dateRange: { start: null, end: null, preset: null },
    layerDrawerOpen: false,
  });
});

describe("toggleLayer", () => {
  it("adds a layer that is not active", () => {
    useMapV2Store.getState().toggleLayer("contacts");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("contacts")).toBe(true);
    expect(s.activeLayers.has("districts")).toBe(true);
  });

  it("removes a layer that is already active", () => {
    useMapV2Store.getState().toggleLayer("districts");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("districts")).toBe(false);
  });

  it("can toggle multiple layers independently", () => {
    useMapV2Store.getState().toggleLayer("contacts");
    useMapV2Store.getState().toggleLayer("vacancies");
    useMapV2Store.getState().toggleLayer("activities");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.size).toBe(4);
    expect(s.activeLayers.has("districts")).toBe(true);
    expect(s.activeLayers.has("contacts")).toBe(true);
    expect(s.activeLayers.has("vacancies")).toBe(true);
    expect(s.activeLayers.has("activities")).toBe(true);
  });

  it("toggling same layer twice returns to original state", () => {
    useMapV2Store.getState().toggleLayer("vacancies");
    useMapV2Store.getState().toggleLayer("vacancies");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("vacancies")).toBe(false);
    expect(s.activeLayers.size).toBe(1);
  });
});

describe("setLayerFilter", () => {
  it("sets a filter on the contacts layer", () => {
    useMapV2Store.getState().setLayerFilter("contacts", { seniorityLevel: "Director" });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.contacts.seniorityLevel).toBe("Director");
  });

  it("sets a filter on the vacancies layer", () => {
    useMapV2Store.getState().setLayerFilter("vacancies", { category: "SPED", status: "open" });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.vacancies.category).toBe("SPED");
    expect(s.layerFilters.vacancies.status).toBe("open");
  });

  it("merges partial filter updates without overwriting other keys", () => {
    useMapV2Store.getState().setLayerFilter("vacancies", { category: "SPED" });
    useMapV2Store.getState().setLayerFilter("vacancies", { status: "open" });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.vacancies.category).toBe("SPED");
    expect(s.layerFilters.vacancies.status).toBe("open");
  });

  it("can clear a filter by setting it to null", () => {
    useMapV2Store.getState().setLayerFilter("contacts", { seniorityLevel: "Director" });
    useMapV2Store.getState().setLayerFilter("contacts", { seniorityLevel: null });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.contacts.seniorityLevel).toBeNull();
  });

  it("does not affect other layers when setting a filter", () => {
    useMapV2Store.getState().setLayerFilter("plans", { status: "active" });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.plans.status).toBe("active");
    expect(s.layerFilters.contacts).toEqual({});
    expect(s.layerFilters.vacancies).toEqual({});
    expect(s.layerFilters.activities).toEqual({});
  });
});

describe("setDateRange", () => {
  it("sets start and end date", () => {
    useMapV2Store.getState().setDateRange({ start: "2026-01-01", end: "2026-03-18" });
    const s = useMapV2Store.getState();
    expect(s.dateRange.start).toBe("2026-01-01");
    expect(s.dateRange.end).toBe("2026-03-18");
  });

  it("sets a preset", () => {
    useMapV2Store.getState().setDateRange({ preset: "30d" });
    const s = useMapV2Store.getState();
    expect(s.dateRange.preset).toBe("30d");
  });

  it("merges partial date range updates", () => {
    useMapV2Store.getState().setDateRange({ start: "2026-01-01" });
    useMapV2Store.getState().setDateRange({ end: "2026-03-18" });
    const s = useMapV2Store.getState();
    expect(s.dateRange.start).toBe("2026-01-01");
    expect(s.dateRange.end).toBe("2026-03-18");
    expect(s.dateRange.preset).toBeNull();
  });

  it("can reset date range by setting all to null", () => {
    useMapV2Store.getState().setDateRange({ start: "2026-01-01", end: "2026-03-18", preset: "30d" });
    useMapV2Store.getState().setDateRange({ start: null, end: null, preset: null });
    const s = useMapV2Store.getState();
    expect(s.dateRange.start).toBeNull();
    expect(s.dateRange.end).toBeNull();
    expect(s.dateRange.preset).toBeNull();
  });
});

describe("toggleLayerDrawer", () => {
  it("opens drawer when closed", () => {
    useMapV2Store.getState().toggleLayerDrawer();
    expect(useMapV2Store.getState().layerDrawerOpen).toBe(true);
  });

  it("closes drawer when open", () => {
    useMapV2Store.getState().toggleLayerDrawer();
    useMapV2Store.getState().toggleLayerDrawer();
    expect(useMapV2Store.getState().layerDrawerOpen).toBe(false);
  });
});
