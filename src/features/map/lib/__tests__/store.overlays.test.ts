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
    dateRange: {
      vacancies: { start: null, end: null, preset: null },
      activities: { start: null, end: null, preset: null },
    },
  });
});

describe("toggleLayer", () => {
  it("adds a layer that is not active", () => {
    useMapV2Store.getState().toggleLayer("contacts");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("contacts")).toBe(true);
    expect(s.activeLayers.has("districts")).toBe(true);
  });

  it("cannot remove districts layer", () => {
    useMapV2Store.getState().toggleLayer("districts");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("districts")).toBe(true);
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
    useMapV2Store.getState().setLayerFilter("contacts", { seniorityLevel: ["Director"] });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.contacts.seniorityLevel).toEqual(["Director"]);
  });

  it("sets a filter on the vacancies layer", () => {
    useMapV2Store.getState().setLayerFilter("vacancies", { category: ["SPED"], status: ["open"] });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.vacancies.category).toEqual(["SPED"]);
    expect(s.layerFilters.vacancies.status).toEqual(["open"]);
  });

  it("merges partial filter updates without overwriting other keys", () => {
    useMapV2Store.getState().setLayerFilter("vacancies", { category: ["SPED"] });
    useMapV2Store.getState().setLayerFilter("vacancies", { status: ["open"] });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.vacancies.category).toEqual(["SPED"]);
    expect(s.layerFilters.vacancies.status).toEqual(["open"]);
  });

  it("can clear a filter by setting it to null", () => {
    useMapV2Store.getState().setLayerFilter("contacts", { seniorityLevel: ["Director"] });
    useMapV2Store.getState().setLayerFilter("contacts", { seniorityLevel: null });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.contacts.seniorityLevel).toBeNull();
  });

  it("does not affect other layers when setting a filter", () => {
    useMapV2Store.getState().setLayerFilter("plans", { status: ["active"] });
    const s = useMapV2Store.getState();
    expect(s.layerFilters.plans.status).toEqual(["active"]);
    expect(s.layerFilters.contacts).toEqual({});
    expect(s.layerFilters.vacancies).toEqual({});
    expect(s.layerFilters.activities).toEqual({});
  });
});

describe("setDateRange", () => {
  it("sets start and end date for vacancies", () => {
    useMapV2Store.getState().setDateRange("vacancies", { start: "2026-01-01", end: "2026-03-18" });
    const s = useMapV2Store.getState();
    expect(s.dateRange.vacancies.start).toBe("2026-01-01");
    expect(s.dateRange.vacancies.end).toBe("2026-03-18");
  });

  it("sets a preset for activities", () => {
    useMapV2Store.getState().setDateRange("activities", { preset: "30d" });
    const s = useMapV2Store.getState();
    expect(s.dateRange.activities.preset).toBe("30d");
  });

  it("merges partial date range updates per layer", () => {
    useMapV2Store.getState().setDateRange("vacancies", { start: "2026-01-01" });
    useMapV2Store.getState().setDateRange("vacancies", { end: "2026-03-18" });
    const s = useMapV2Store.getState();
    expect(s.dateRange.vacancies.start).toBe("2026-01-01");
    expect(s.dateRange.vacancies.end).toBe("2026-03-18");
    expect(s.dateRange.vacancies.preset).toBeNull();
  });

  it("can reset date range by setting all to null", () => {
    useMapV2Store.getState().setDateRange("activities", { start: "2026-01-01", end: "2026-03-18", preset: "30d" });
    useMapV2Store.getState().setDateRange("activities", { start: null, end: null, preset: null });
    const s = useMapV2Store.getState();
    expect(s.dateRange.activities.start).toBeNull();
    expect(s.dateRange.activities.end).toBeNull();
    expect(s.dateRange.activities.preset).toBeNull();
  });

  it("does not affect other layer date range", () => {
    useMapV2Store.getState().setDateRange("vacancies", { start: "2026-01-01" });
    const s = useMapV2Store.getState();
    expect(s.dateRange.vacancies.start).toBe("2026-01-01");
    expect(s.dateRange.activities.start).toBeNull();
  });
});

describe("switchToLayer", () => {
  it("activates the layer, sets the results tab, and opens the results panel", () => {
    useMapV2Store.getState().switchToLayer("vacancies");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("vacancies")).toBe(true);
    expect(s.activeResultsTab).toBe("vacancies");
    expect(s.searchResultsVisible).toBe(true);
  });

  it("does not remove the districts layer", () => {
    useMapV2Store.getState().switchToLayer("vacancies");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("districts")).toBe(true);
  });

  it("preserves other active layers", () => {
    useMapV2Store.getState().toggleLayer("contacts");
    useMapV2Store.getState().switchToLayer("vacancies");
    const s = useMapV2Store.getState();
    expect(s.activeLayers.has("contacts")).toBe(true);
    expect(s.activeLayers.has("vacancies")).toBe(true);
  });
});

describe("geographyFilters", () => {
  it("defaults to empty states and null zipRadius", () => {
    const s = useMapV2Store.getState();
    expect(s.geographyFilters.states).toEqual([]);
    expect(s.geographyFilters.zipRadius).toBeNull();
  });

  it("sets geography states", () => {
    useMapV2Store.getState().setGeographyStates(["CA", "TX"]);
    expect(useMapV2Store.getState().geographyFilters.states).toEqual(["CA", "TX"]);
  });

  it("sets geography zip radius", () => {
    useMapV2Store.getState().setGeographyZipRadius({ zip: "90210", radius: 25 });
    expect(useMapV2Store.getState().geographyFilters.zipRadius).toEqual({ zip: "90210", radius: 25 });
  });

  it("clears geography zip radius", () => {
    useMapV2Store.getState().setGeographyZipRadius({ zip: "90210", radius: 25 });
    useMapV2Store.getState().setGeographyZipRadius(null);
    expect(useMapV2Store.getState().geographyFilters.zipRadius).toBeNull();
  });

  it("setting states does not affect zipRadius", () => {
    useMapV2Store.getState().setGeographyZipRadius({ zip: "90210", radius: 25 });
    useMapV2Store.getState().setGeographyStates(["NY"]);
    const s = useMapV2Store.getState();
    expect(s.geographyFilters.states).toEqual(["NY"]);
    expect(s.geographyFilters.zipRadius).toEqual({ zip: "90210", radius: 25 });
  });
});
