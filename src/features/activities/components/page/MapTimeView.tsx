"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import maplibregl from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";
import { ChevronLeft, MapPin } from "lucide-react";
import { format } from "date-fns";
import { createRoot, type Root } from "react-dom/client";
import type {
  ActivityListItem,
  OppEvent,
} from "@/features/shared/types/api-types";
import {
  useActivitiesChrome,
  getRangeForChrome,
} from "@/features/activities/lib/filters-store";
import { useDealEvents, useOpenDeals } from "@/features/activities/lib/queries";
import OffMapPanel from "./MapTimeView/OffMapPanel";
import TimeRuler from "./MapTimeView/TimeRuler";
import PinCluster, { type ClusterData } from "./MapTimeView/PinCluster";
import OppSummaryStrip from "./deals/OppSummaryStrip";
import OppDrawer, { type OppDrawerKind } from "./deals/OppDrawer";
import type { ColdDistrict } from "./deals/ColdDistrictRow";

// State bounding boxes (subset of MapV2Container's STATE_BBOX). Centroid =
// midpoint of bbox. Used to position markers when ActivityListItem only has
// state abbrevs (no district lat/lng).
const STATE_BBOX: Record<string, [[number, number], [number, number]]> = {
  AL: [[-88.5, 30.2], [-84.9, 35.0]],
  AK: [[-179.2, 51.2], [-129.9, 71.4]],
  AZ: [[-114.8, 31.3], [-109.0, 37.0]],
  AR: [[-94.6, 33.0], [-89.6, 36.5]],
  CA: [[-124.4, 32.5], [-114.1, 42.0]],
  CO: [[-109.1, 37.0], [-102.0, 41.0]],
  CT: [[-73.7, 41.0], [-71.8, 42.1]],
  DE: [[-75.8, 38.5], [-75.0, 39.8]],
  DC: [[-77.1, 38.8], [-76.9, 39.0]],
  FL: [[-87.6, 24.5], [-80.0, 31.0]],
  GA: [[-85.6, 30.4], [-80.8, 35.0]],
  HI: [[-160.2, 18.9], [-154.8, 22.2]],
  ID: [[-117.2, 42.0], [-111.0, 49.0]],
  IL: [[-91.5, 37.0], [-87.5, 42.5]],
  IN: [[-88.1, 37.8], [-84.8, 41.8]],
  IA: [[-96.6, 40.4], [-90.1, 43.5]],
  KS: [[-102.1, 37.0], [-94.6, 40.0]],
  KY: [[-89.6, 36.5], [-81.9, 39.1]],
  LA: [[-94.0, 29.0], [-89.0, 33.0]],
  ME: [[-71.1, 43.1], [-66.9, 47.5]],
  MD: [[-79.5, 37.9], [-75.0, 39.7]],
  MA: [[-73.5, 41.2], [-69.9, 42.9]],
  MI: [[-90.4, 41.7], [-82.4, 48.2]],
  MN: [[-97.2, 43.5], [-89.5, 49.4]],
  MS: [[-91.7, 30.2], [-88.1, 35.0]],
  MO: [[-95.8, 36.0], [-89.1, 40.6]],
  MT: [[-116.1, 45.0], [-104.0, 49.0]],
  NE: [[-104.1, 40.0], [-95.3, 43.0]],
  NV: [[-120.0, 35.0], [-114.0, 42.0]],
  NH: [[-72.6, 42.7], [-70.7, 45.3]],
  NJ: [[-75.6, 38.9], [-73.9, 41.4]],
  NM: [[-109.1, 31.3], [-103.0, 37.0]],
  NY: [[-79.8, 40.5], [-71.9, 45.0]],
  NC: [[-84.3, 33.8], [-75.5, 36.6]],
  ND: [[-104.1, 45.9], [-96.6, 49.0]],
  OH: [[-84.8, 38.4], [-80.5, 42.0]],
  OK: [[-103.0, 33.6], [-94.4, 37.0]],
  OR: [[-124.6, 42.0], [-116.5, 46.3]],
  PA: [[-80.5, 39.7], [-74.7, 42.3]],
  RI: [[-71.9, 41.1], [-71.1, 42.0]],
  SC: [[-83.4, 32.0], [-78.5, 35.2]],
  SD: [[-104.1, 42.5], [-96.4, 45.9]],
  TN: [[-90.3, 35.0], [-81.6, 36.7]],
  TX: [[-106.6, 25.8], [-93.5, 36.5]],
  UT: [[-114.1, 37.0], [-109.0, 42.0]],
  VT: [[-73.4, 42.7], [-71.5, 45.0]],
  VA: [[-83.7, 36.5], [-75.2, 39.5]],
  WA: [[-124.8, 45.5], [-116.9, 49.0]],
  WV: [[-82.6, 37.2], [-77.7, 40.6]],
  WI: [[-92.9, 42.5], [-86.8, 47.1]],
  WY: [[-111.1, 41.0], [-104.1, 45.0]],
};

const US_BOUNDS: maplibregl.LngLatBoundsLike = [
  [-125, 24],
  [-66, 50],
];

function stateCentroid(state: string): [number, number] | null {
  const bbox = STATE_BBOX[state];
  if (!bbox) return null;
  const [[w, s], [e, n]] = bbox;
  return [(w + e) / 2, (s + n) / 2];
}

interface MarkerHandle {
  marker: maplibregl.Marker;
  el: HTMLDivElement;
  root: Root;
}

const PANEL_STORAGE_KEY = "cal.map.panel.collapsed";

function drawerHeadingFor(kind: OppDrawerKind): string {
  switch (kind) {
    case "won":
      return "Closed won";
    case "lost":
      return "Closed lost";
    case "created":
      return "New deals";
    case "progressed":
      return "Progressed deals";
    case "closing":
      return "Closing soon";
    case "all":
      return "All deal activity";
    case "overdue":
      return "Past-due open deals";
    case "cold":
      return "Districts going cold";
  }
}

export default function MapTimeView({
  activities,
  onActivityClick,
}: {
  activities: ActivityListItem[];
  onActivityClick: (id: string) => void;
}) {
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const grain = useActivitiesChrome((s) => s.grain);
  const dealDisplay = useActivitiesChrome((s) => s.dealDisplay);
  const dealKindsFilter = useActivitiesChrome((s) => s.filters.dealKinds);
  const ownersFilter = useActivitiesChrome((s) => s.filters.owners);
  const statesFilter = useActivitiesChrome((s) => s.filters.states);

  const showSummary = dealDisplay !== "objects";

  const rangeIso = useMemo(
    () => getRangeForChrome(anchorIso, grain),
    [anchorIso, grain]
  );
  const range = useMemo(
    () => ({ start: new Date(rangeIso.startIso), end: new Date(rangeIso.endIso) }),
    [rangeIso]
  );

  const ownerParam = ownersFilter.length === 1 ? ownersFilter[0] : "all";
  const stateParam = statesFilter.length > 0 ? statesFilter : undefined;

  const { data: dealEventsData } = useDealEvents({
    from: rangeIso.startIso,
    to: rangeIso.endIso,
    ownerId: ownerParam,
    state: stateParam,
  });
  const dealEvents = useMemo<OppEvent[]>(() => {
    let list = dealEventsData?.events ?? [];
    if (dealKindsFilter.length > 0) {
      const set = new Set(dealKindsFilter);
      list = list.filter((e) => set.has(e.kind));
    }
    return list;
  }, [dealEventsData, dealKindsFilter]);

  const { data: openDealsData } = useOpenDeals(
    { ownerId: ownerParam, state: stateParam, limit: 200 },
    { enabled: showSummary }
  );
  const overdueDeals = useMemo(
    () => (openDealsData?.deals ?? []).filter((d) => (d.daysToClose ?? 0) < 0),
    [openDealsData]
  );

  // TODO: cold districts data source — Wave 8
  const coldList: ColdDistrict[] = useMemo(() => [], []);

  // TODO: deal pin layer + DealOutcomeRing — follow-up wave

  const rangeLabel = useMemo(() => {
    if (grain === "day") return format(range.start, "MMM d, yyyy");
    if (grain === "month") return format(range.start, "MMMM yyyy");
    if (grain === "quarter") {
      const q = Math.floor(range.start.getMonth() / 3) + 1;
      return `Q${q} ${range.start.getFullYear()}`;
    }
    return `${format(range.start, "MMM d")} – ${format(range.end, "MMM d")}`;
  }, [range, grain]);

  // Bucket activities into mapped clusters / off-map / virtual
  const { clusters, offMap, virtual, mappedCount } = useMemo(() => {
    const map = new Map<string, ClusterData & { coord: [number, number] }>();
    const off: ActivityListItem[] = [];
    const virt: ActivityListItem[] = [];

    for (const a of activities) {
      const state = a.stateAbbrevs[0];
      if (!state) {
        virt.push(a);
        continue;
      }
      const coord = stateCentroid(state);
      if (!coord) {
        off.push(a);
        continue;
      }
      const existing = map.get(state);
      if (existing) {
        existing.items.push(a);
      } else {
        map.set(state, {
          key: state,
          label: state,
          items: [a],
          coord,
        });
      }
    }

    return {
      clusters: Array.from(map.values()),
      offMap: off,
      virtual: virt,
      mappedCount: Array.from(map.values()).reduce((s, c) => s + c.items.length, 0),
    };
  }, [activities]);

  const timestamps = useMemo(
    () =>
      activities
        .filter((a) => a.startDate)
        .map((a) => new Date(a.startDate!)),
    [activities]
  );

  // Off-map panel collapse state (persisted)
  const [panelCollapsed, setPanelCollapsed] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.localStorage.getItem(PANEL_STORAGE_KEY) === "1";
  });
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(PANEL_STORAGE_KEY, panelCollapsed ? "1" : "0");
  }, [panelCollapsed]);

  // === MapLibre setup ===
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<maplibregl.Map | null>(null);
  const markersRef = useRef<Map<string, MarkerHandle>>(new Map());
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    const container = containerRef.current;
    if (!container || mapRef.current) return;

    let map: maplibregl.Map | null = null;
    let ro: ResizeObserver | null = null;
    let cancelled = false;
    let rafId = 0;

    // Defer init until the container has real dimensions. MapLibre captures
    // size at construction; if the flex layout hasn't computed yet (0×0), the
    // canvas stays empty and ResizeObserver doesn't always recover.
    const tryInit = () => {
      if (cancelled) return;
      const rect = container.getBoundingClientRect();
      if (rect.width < 50 || rect.height < 50) {
        rafId = requestAnimationFrame(tryInit);
        return;
      }

      map = new maplibregl.Map({
        container,
        style: {
          version: 8,
          glyphs: "https://demotiles.maplibre.org/font/{fontstack}/{range}.pbf",
          sources: {},
          layers: [
            {
              id: "background",
              type: "background",
              paint: { "background-color": "#D8EDEC" },
            },
          ],
        },
        center: [-95, 38],
        zoom: 3.4,
        minZoom: 2,
        maxZoom: 10,
        attributionControl: false,
      });
      mapRef.current = map;

      map.addControl(
        new maplibregl.NavigationControl({ showCompass: false }),
        "bottom-right"
      );
      map.fitBounds(US_BOUNDS, { padding: 24, animate: false });

      map.on("load", () => {
        if (!map) return;
        map.addSource("states", { type: "geojson", data: "/us-states.json" });
        map.addLayer({
          id: "state-fill",
          type: "fill",
          source: "states",
          paint: { "fill-color": "#FFFFFF", "fill-opacity": 0.55 },
        });
        map.addLayer({
          id: "state-outline",
          type: "line",
          source: "states",
          paint: {
            "line-color": "#6EA3BE",
            "line-width": 1.2,
            "line-opacity": 0.7,
          },
        });
        map.resize();
        setMapReady(true);
      });

      // Auto-resize when the container size changes (filter rail collapse,
      // panel toggle, window resize).
      ro = new ResizeObserver(() => map?.resize());
      ro.observe(container);
    };
    tryInit();

    // Capture markers ref locally for cleanup (lint: ref may change by cleanup time).
    const markers = markersRef.current;
    return () => {
      cancelled = true;
      cancelAnimationFrame(rafId);
      ro?.disconnect();
      for (const handle of markers.values()) {
        handle.marker.remove();
        handle.root.unmount();
      }
      markers.clear();
      map?.remove();
      mapRef.current = null;
      setMapReady(false);
    };
  }, []);

  // === Sync markers with cluster data ===
  useEffect(() => {
    const m = mapRef.current;
    if (!m || !mapReady) return;

    const next = new Set(clusters.map((c) => c.key));
    // Remove stale markers
    for (const [key, handle] of markersRef.current.entries()) {
      if (!next.has(key)) {
        handle.marker.remove();
        handle.root.unmount();
        markersRef.current.delete(key);
      }
    }

    // Upsert markers
    for (const cluster of clusters) {
      const existing = markersRef.current.get(cluster.key);
      if (existing) {
        existing.marker.setLngLat(cluster.coord);
        existing.root.render(
          <PinCluster cluster={cluster} onActivityClick={onActivityClick} />
        );
      } else {
        const el = document.createElement("div");
        el.className = "fm-map-pin";
        const root = createRoot(el);
        root.render(
          <PinCluster cluster={cluster} onActivityClick={onActivityClick} />
        );
        const marker = new maplibregl.Marker({ element: el, anchor: "center" })
          .setLngLat(cluster.coord)
          .addTo(m);
        markersRef.current.set(cluster.key, { marker, el, root });
      }
    }
  }, [clusters, mapReady, onActivityClick]);

  const notOnMapCount = offMap.length + virtual.length;

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerKind, setDrawerKind] = useState<OppDrawerKind>("all");
  const onOpenDrawer = (kind: OppDrawerKind) => {
    setDrawerKind(kind);
    setDrawerOpen(true);
  };

  return (
    <div className="flex flex-col h-full overflow-hidden bg-[#FFFCFA]">
      <div className="flex flex-col gap-3 px-6 pt-4 pb-6 flex-1 min-h-0">
        {/* Time ruler — pivots above the map */}
        <TimeRuler range={range} grain={grain} timestamps={timestamps} />

        {/* Stats strip */}
        <div className="px-4 py-2.5 rounded-[10px] bg-white border border-[#E2DEEC] flex items-center justify-between gap-3 flex-wrap">
          <div className="flex items-center gap-3.5">
            <span className="inline-flex items-center gap-2">
              <MapPin className="w-3.5 h-3.5 text-[#F37167]" />
              <span className="text-[13px] font-semibold text-[#403770]">
                {mappedCount} on map
              </span>
            </span>
            <span className="h-4 w-px bg-[#E2DEEC]" aria-hidden />
            <span className="text-xs text-[#6E6390]">
              <strong className="text-[#403770]">{activities.length}</strong> total in {rangeLabel}
            </span>
            {notOnMapCount > 0 && (
              <>
                <span className="h-4 w-px bg-[#E2DEEC]" aria-hidden />
                <span className="text-xs text-[#8A80A8]">
                  <strong className="text-[#544A78]">{notOnMapCount}</strong> not on map
                </span>
              </>
            )}
          </div>

          {panelCollapsed && notOnMapCount > 0 && (
            <button
              type="button"
              onClick={() => setPanelCollapsed(false)}
              className="px-2.5 py-1 rounded-[7px] border border-[#D4CFE2] bg-white text-[#544A78] text-[11px] font-semibold uppercase tracking-[0.04em] inline-flex items-center gap-1.5 hover:border-[#403770] transition-colors duration-120"
            >
              <ChevronLeft className="w-3 h-3" />
              Show not-on-map
            </button>
          )}
        </div>

        {showSummary && (
          <OppSummaryStrip
            events={dealEvents}
            overdueDeals={overdueDeals}
            coldList={coldList}
            rangeLabel={rangeLabel}
            onOpen={onOpenDrawer}
          />
        )}

        {/* Body: map + side panel */}
        <div className="flex-1 flex gap-3 min-h-0">
          <div className="flex-1 relative overflow-hidden rounded-xl border border-[#E2DEEC] min-w-0">
            {/* h-full w-full not absolute inset-0: maplibre adds .maplibregl-map { position: relative } which would override absolute and collapse the canvas to ~30px */}
            <div ref={containerRef} className="h-full w-full" />

            {mapReady && clusters.length === 0 && (
              <div
                className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 text-center px-5 py-4 rounded-xl border border-[#D4CFE2] bg-white/90 backdrop-blur"
                role="status"
              >
                <div className="text-sm font-semibold text-[#403770]">
                  No mappable activities in {rangeLabel}
                </div>
                <div className="text-xs text-[#8A80A8] mt-1">
                  Try a longer range, or check the panel to the right
                </div>
              </div>
            )}
          </div>

          {!panelCollapsed && (
            <OffMapPanel
              offMap={offMap}
              virtual={virtual}
              onActivityClick={onActivityClick}
              onCollapse={() => setPanelCollapsed(true)}
            />
          )}
        </div>
      </div>

      <OppDrawer
        open={drawerOpen}
        kind={drawerKind}
        heading={drawerHeadingFor(drawerKind)}
        rangeLabel={rangeLabel}
        events={dealEvents}
        overdueDeals={overdueDeals}
        coldList={coldList}
        onClose={() => setDrawerOpen(false)}
      />
    </div>
  );
}
