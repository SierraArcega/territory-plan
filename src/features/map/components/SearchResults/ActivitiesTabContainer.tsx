"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapActivities } from "@/features/map/lib/queries";
import ActivitiesTab from "./ActivitiesTab";
import type { FeatureCollection, Point } from "geojson";

interface ActivitiesTabContainerProps {
  filteredData: FeatureCollection<Point> | undefined;
  geoStates: string[] | undefined;
}

export default function ActivitiesTabContainer({ filteredData, geoStates }: ActivitiesTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.activities);
  const dateRange = useMapV2Store((s) => s.dateRange.activities);
  const mapBounds = useMapV2Store((s) => s.mapBounds);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapActivities(mapBounds, filters, dateRange, true, geoStates);

  // Report raw GeoJSON to store for cross-filtering; clear on unmount
  useEffect(() => {
    setOverlayGeoJSON("activities", data ?? null);
    return () => setOverlayGeoJSON("activities", null);
  }, [data, setOverlayGeoJSON]);

  return <ActivitiesTab data={filteredData} isLoading={isLoading} />;
}
