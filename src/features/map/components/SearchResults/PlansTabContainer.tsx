"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapPlans } from "@/features/map/lib/queries";
import PlansTab from "./PlansTab";
import type { FeatureCollection, Geometry } from "geojson";

interface PlansTabContainerProps {
  geoStates: string[] | undefined;
}

export default function PlansTabContainer({ geoStates }: PlansTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.plans);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapPlans(filters, true);

  useEffect(() => {
    setOverlayGeoJSON("plans", data ?? null);
  }, [data, setOverlayGeoJSON]);

  // PlansTab receives raw data (not cross-filtered) — plans are the cross-filter source
  return <PlansTab data={data} isLoading={isLoading} />;
}
