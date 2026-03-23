import { describe, it, expect } from "vitest";
import {
  createClusteredSource,
  createGeoJSONSource,
  getContactLayers,
  getVacancyLayers,
  getActivityLayers,
  getPlanLayers,
  layerIdToOverlayType,
  overlayTypeToPanel,
  CONTACTS_SOURCE,
  VACANCIES_SOURCE,
  ACTIVITIES_SOURCE,
  PLANS_SOURCE,
  CONTACTS_CLUSTER_LAYER,
  CONTACTS_CLUSTER_COUNT,
  CONTACTS_POINT_LAYER,
  VACANCIES_CLUSTER_LAYER,
  VACANCIES_CLUSTER_COUNT,
  VACANCIES_POINT_LAYER,
  ACTIVITIES_CLUSTER_LAYER,
  ACTIVITIES_CLUSTER_COUNT,
  ACTIVITIES_POINT_LAYER,
  PLANS_FILL_LAYER,
  PLANS_OUTLINE_LAYER,
  ALL_OVERLAY_POINT_LAYERS,
  ALL_OVERLAY_CLUSTER_LAYERS,
} from "../pin-layers";

describe("source constants", () => {
  it("exports distinct source IDs", () => {
    const sources = [CONTACTS_SOURCE, VACANCIES_SOURCE, ACTIVITIES_SOURCE, PLANS_SOURCE];
    expect(new Set(sources).size).toBe(4);
  });
});

describe("ALL_OVERLAY_POINT_LAYERS", () => {
  it("contains all three point layer IDs", () => {
    expect(ALL_OVERLAY_POINT_LAYERS).toContain(CONTACTS_POINT_LAYER);
    expect(ALL_OVERLAY_POINT_LAYERS).toContain(VACANCIES_POINT_LAYER);
    expect(ALL_OVERLAY_POINT_LAYERS).toContain(ACTIVITIES_POINT_LAYER);
    expect(ALL_OVERLAY_POINT_LAYERS).toHaveLength(3);
  });
});

describe("ALL_OVERLAY_CLUSTER_LAYERS", () => {
  it("contains all three cluster layer IDs", () => {
    expect(ALL_OVERLAY_CLUSTER_LAYERS).toContain(CONTACTS_CLUSTER_LAYER);
    expect(ALL_OVERLAY_CLUSTER_LAYERS).toContain(VACANCIES_CLUSTER_LAYER);
    expect(ALL_OVERLAY_CLUSTER_LAYERS).toContain(ACTIVITIES_CLUSTER_LAYER);
    expect(ALL_OVERLAY_CLUSTER_LAYERS).toHaveLength(3);
  });
});

describe("createClusteredSource", () => {
  it("returns a geojson source with clustering enabled", () => {
    const source = createClusteredSource();
    expect(source.type).toBe("geojson");
    expect(source).toHaveProperty("cluster", true);
    expect(source).toHaveProperty("clusterMaxZoom");
    expect(source).toHaveProperty("clusterRadius");
  });

  it("starts with empty FeatureCollection", () => {
    const source = createClusteredSource();
    expect((source as { data: unknown }).data).toEqual({
      type: "FeatureCollection",
      features: [],
    });
  });
});

describe("createGeoJSONSource", () => {
  it("returns a geojson source without clustering", () => {
    const source = createGeoJSONSource();
    expect(source.type).toBe("geojson");
    expect(source).not.toHaveProperty("cluster");
  });
});

describe("getContactLayers", () => {
  const layers = getContactLayers();

  it("returns exactly 3 layers (cluster, count, point)", () => {
    expect(layers).toHaveLength(3);
  });

  it("uses correct layer IDs", () => {
    const ids = layers.map((l) => l.id);
    expect(ids).toContain(CONTACTS_CLUSTER_LAYER);
    expect(ids).toContain(CONTACTS_CLUSTER_COUNT);
    expect(ids).toContain(CONTACTS_POINT_LAYER);
  });

  it("all layers reference the contacts source", () => {
    for (const layer of layers) {
      expect((layer as { source: string }).source).toBe(CONTACTS_SOURCE);
    }
  });

  it("uses coral color #F37167", () => {
    const clusterLayer = layers.find((l) => l.id === CONTACTS_CLUSTER_LAYER)!;
    expect((clusterLayer as { paint: Record<string, unknown> }).paint["circle-color"]).toBe("#F37167");

    const pointLayer = layers.find((l) => l.id === CONTACTS_POINT_LAYER)!;
    expect((pointLayer as { paint: Record<string, unknown> }).paint["circle-color"]).toBe("#F37167");
  });

  it("cluster layer filters for point_count", () => {
    const clusterLayer = layers.find((l) => l.id === CONTACTS_CLUSTER_LAYER)!;
    expect((clusterLayer as Record<string, unknown>).filter).toEqual(["has", "point_count"]);
  });

  it("point layer filters out clusters", () => {
    const pointLayer = layers.find((l) => l.id === CONTACTS_POINT_LAYER)!;
    expect((pointLayer as Record<string, unknown>).filter).toEqual(["!", ["has", "point_count"]]);
  });
});

describe("getVacancyLayers", () => {
  const layers = getVacancyLayers();

  it("returns exactly 3 layers", () => {
    expect(layers).toHaveLength(3);
  });

  it("uses correct layer IDs", () => {
    const ids = layers.map((l) => l.id);
    expect(ids).toContain(VACANCIES_CLUSTER_LAYER);
    expect(ids).toContain(VACANCIES_CLUSTER_COUNT);
    expect(ids).toContain(VACANCIES_POINT_LAYER);
  });

  it("all layers reference the vacancies source", () => {
    for (const layer of layers) {
      expect((layer as { source: string }).source).toBe(VACANCIES_SOURCE);
    }
  });

  it("uses golden color #FFCF70", () => {
    const pointLayer = layers.find((l) => l.id === VACANCIES_POINT_LAYER)!;
    expect((pointLayer as { paint: Record<string, unknown> }).paint["circle-color"]).toBe("#FFCF70");
  });
});

describe("getActivityLayers", () => {
  const layers = getActivityLayers();

  it("returns exactly 3 layers", () => {
    expect(layers).toHaveLength(3);
  });

  it("uses correct layer IDs", () => {
    const ids = layers.map((l) => l.id);
    expect(ids).toContain(ACTIVITIES_CLUSTER_LAYER);
    expect(ids).toContain(ACTIVITIES_CLUSTER_COUNT);
    expect(ids).toContain(ACTIVITIES_POINT_LAYER);
  });

  it("all layers reference the activities source", () => {
    for (const layer of layers) {
      expect((layer as { source: string }).source).toBe(ACTIVITIES_SOURCE);
    }
  });

  it("uses steel blue color #6EA3BE", () => {
    const pointLayer = layers.find((l) => l.id === ACTIVITIES_POINT_LAYER)!;
    expect((pointLayer as { paint: Record<string, unknown> }).paint["circle-color"]).toBe("#6EA3BE");
  });
});

describe("getPlanLayers", () => {
  const layers = getPlanLayers();

  it("returns exactly 2 layers (fill + outline)", () => {
    expect(layers).toHaveLength(2);
  });

  it("uses correct layer IDs", () => {
    const ids = layers.map((l) => l.id);
    expect(ids).toContain(PLANS_FILL_LAYER);
    expect(ids).toContain(PLANS_OUTLINE_LAYER);
  });

  it("all layers reference the plans source", () => {
    for (const layer of layers) {
      expect((layer as { source: string }).source).toBe(PLANS_SOURCE);
    }
  });

  it("fill layer type is 'fill'", () => {
    const fillLayer = layers.find((l) => l.id === PLANS_FILL_LAYER)!;
    expect(fillLayer.type).toBe("fill");
  });

  it("outline layer type is 'line'", () => {
    const outlineLayer = layers.find((l) => l.id === PLANS_OUTLINE_LAYER)!;
    expect(outlineLayer.type).toBe("line");
  });

  it("fill uses coalesce with planColor and plum fallback #403770", () => {
    const fillLayer = layers.find((l) => l.id === PLANS_FILL_LAYER)!;
    const paint = (fillLayer as { paint: Record<string, unknown> }).paint;
    expect(paint["fill-color"]).toEqual(["coalesce", ["get", "planColor"], "#403770"]);
  });
});

describe("layerIdToOverlayType", () => {
  it("maps contacts layer IDs to 'contacts'", () => {
    expect(layerIdToOverlayType(CONTACTS_POINT_LAYER)).toBe("contacts");
    expect(layerIdToOverlayType(CONTACTS_CLUSTER_LAYER)).toBe("contacts");
  });

  it("maps vacancies layer IDs to 'vacancies'", () => {
    expect(layerIdToOverlayType(VACANCIES_POINT_LAYER)).toBe("vacancies");
  });

  it("maps activities layer IDs to 'activities'", () => {
    expect(layerIdToOverlayType(ACTIVITIES_POINT_LAYER)).toBe("activities");
  });

  it("maps plans layer IDs to 'plans'", () => {
    expect(layerIdToOverlayType(PLANS_FILL_LAYER)).toBe("plans");
    expect(layerIdToOverlayType(PLANS_OUTLINE_LAYER)).toBe("plans");
  });

  it("returns null for unknown layer IDs", () => {
    expect(layerIdToOverlayType("unknown-layer")).toBeNull();
    expect(layerIdToOverlayType("district-fill")).toBeNull();
  });
});

describe("overlayTypeToPanel", () => {
  it("maps contacts to contact_detail", () => {
    expect(overlayTypeToPanel("contacts")).toBe("contact_detail");
  });

  it("maps vacancies to vacancy_detail", () => {
    expect(overlayTypeToPanel("vacancies")).toBe("vacancy_detail");
  });

  it("maps activities to activity_edit", () => {
    expect(overlayTypeToPanel("activities")).toBe("activity_edit");
  });

  it("maps plans to plan_card", () => {
    expect(overlayTypeToPanel("plans")).toBe("plan_card");
  });
});
