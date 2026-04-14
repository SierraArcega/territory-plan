"use client";

import { useEffect } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import { useMapContacts } from "@/features/map/lib/queries";
import ContactsTab from "./ContactsTab";
import type { FeatureCollection, Point } from "geojson";

interface ContactsTabContainerProps {
  filteredData: FeatureCollection<Point> | undefined;
  geoStates: string[] | undefined;
}

export default function ContactsTabContainer({ filteredData, geoStates }: ContactsTabContainerProps) {
  const filters = useMapV2Store((s) => s.layerFilters.contacts);
  const mapBounds = useMapV2Store((s) => s.mapBounds);
  const setOverlayGeoJSON = useMapV2Store((s) => s.setOverlayGeoJSON);

  const { data, isLoading } = useMapContacts(mapBounds, filters, true, geoStates);

  // Report raw GeoJSON to store for cross-filtering
  useEffect(() => {
    setOverlayGeoJSON("contacts", data ?? null);
  }, [data, setOverlayGeoJSON]);

  return <ContactsTab data={filteredData} isLoading={isLoading} />;
}
