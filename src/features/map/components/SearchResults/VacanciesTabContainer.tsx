"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapVacancies } from "@/features/map/lib/queries";
import VacanciesTab from "./VacanciesTab";
import type { FeatureCollection, Point } from "geojson";

interface VacanciesTabContainerProps {
  filteredData: FeatureCollection<Point> | undefined;
  geoStates: string[] | undefined;
}

export default function VacanciesTabContainer({ filteredData, geoStates }: VacanciesTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.vacancies);
  const dateRange = useMapV2Store((s) => s.dateRange.vacancies);
  const mapBounds = useMapV2Store((s) => s.mapBounds);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapVacancies(mapBounds, filters, dateRange, true, geoStates);

  // Report raw GeoJSON to store for cross-filtering; clear on unmount
  useEffect(() => {
    setOverlayGeoJSON("vacancies", data ?? null);
    return () => setOverlayGeoJSON("vacancies", null);
  }, [data, setOverlayGeoJSON]);

  return <VacanciesTab data={filteredData} isLoading={isLoading} />;
}
