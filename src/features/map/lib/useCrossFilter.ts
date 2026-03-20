// src/features/map/lib/useCrossFilter.ts
"use client";

import { useMemo, useCallback, useRef } from "react";
import { useMapV2Store } from "./store";
import {
  isPlansFiltered,
  isContactsFiltered,
  isVacanciesFiltered,
  isActivitiesFiltered,
  extractLeaids,
  leaidSetKey,
} from "./filter-utils";

interface OverlayData {
  plansGeoJSON: any;
  contactsGeoJSON: any;
  vacanciesGeoJSON: any;
  activitiesGeoJSON: any;
}

export function useCrossFilter(data: OverlayData) {
  const layerFilters = useMapV2Store((s) => s.layerFilters);
  const focusLeaids = useMapV2Store((s) => s.focusLeaids);
  const isSearchActive = useMapV2Store((s) => s.isSearchActive);
  const searchResultLeaids = useMapV2Store((s) => s.searchResultLeaids);

  // Per-layer "has active filters?" booleans
  const plansActive = useMemo(() => isPlansFiltered(layerFilters.plans), [layerFilters.plans]);
  const contactsActive = useMemo(() => isContactsFiltered(layerFilters.contacts), [layerFilters.contacts]);
  const vacanciesActive = useMemo(() => isVacanciesFiltered(layerFilters.vacancies), [layerFilters.vacancies]);
  const activitiesActive = useMemo(() => isActivitiesFiltered(layerFilters.activities), [layerFilters.activities]);

  // Leaids from filtered plan GeoJSON
  const planFilterLeaids = useMemo(() => {
    if (!plansActive || !data.plansGeoJSON) return null;
    const s = extractLeaids(data.plansGeoJSON);
    return s.size > 0 ? s : null;
  }, [plansActive, data.plansGeoJSON]);

  // Overlay leaid set — constrains map overlay rendering.
  // Uses intersection when both plan filter and search are active.
  const overlayLeaidSet = useMemo(() => {
    if (focusLeaids.length > 0) return new Set(focusLeaids);

    const sets: Set<string>[] = [];
    if (planFilterLeaids) sets.push(planFilterLeaids);
    if (isSearchActive && searchResultLeaids.length > 0) sets.push(new Set(searchResultLeaids));

    if (sets.length === 0) return null;
    if (sets.length === 1) return sets[0];

    // Intersect all active sets
    const [first, ...rest] = sets;
    const result = new Set<string>();
    for (const id of first) {
      if (rest.every((s) => s.has(id))) result.add(id);
    }
    return result.size > 0 ? result : null;
  }, [focusLeaids, planFilterLeaids, isSearchActive, searchResultLeaids]);

  // Filter any GeoJSON FeatureCollection by overlayLeaidSet
  const filterOverlayGeoJSON = useCallback(
    (geojson: any) => {
      if (!geojson || !overlayLeaidSet) return geojson;
      return {
        ...geojson,
        features: geojson.features.filter(
          (f: any) => overlayLeaidSet.has(f.properties?.leaid)
        ),
      };
    },
    [overlayLeaidSet],
  );

  // Filtered overlay GeoJSONs
  const filteredContacts = useMemo(
    () => filterOverlayGeoJSON(data.contactsGeoJSON),
    [filterOverlayGeoJSON, data.contactsGeoJSON],
  );
  const filteredVacancies = useMemo(
    () => filterOverlayGeoJSON(data.vacanciesGeoJSON),
    [filterOverlayGeoJSON, data.vacanciesGeoJSON],
  );
  const filteredActivities = useMemo(
    () => filterOverlayGeoJSON(data.activitiesGeoJSON),
    [filterOverlayGeoJSON, data.activitiesGeoJSON],
  );

  // Overlay-derived leaids for the districts tab.
  // Only includes overlays with active filters — not just visible layers.
  const overlayDerivedLeaids = useMemo(() => {
    const leaids = new Set<string>();
    if (planFilterLeaids) planFilterLeaids.forEach((id) => leaids.add(id));
    if (contactsActive && filteredContacts) extractLeaids(filteredContacts).forEach((id) => leaids.add(id));
    if (vacanciesActive && filteredVacancies) extractLeaids(filteredVacancies).forEach((id) => leaids.add(id));
    if (activitiesActive && filteredActivities) extractLeaids(filteredActivities).forEach((id) => leaids.add(id));
    return leaids.size > 0 ? leaids : null;
  }, [planFilterLeaids, contactsActive, vacanciesActive, activitiesActive, filteredContacts, filteredVacancies, filteredActivities]);

  // Stable key for overlayDerivedLeaids — prevents spurious fetches
  const derivedLeaidKey = leaidSetKey(overlayDerivedLeaids);
  const prevKeyRef = useRef(derivedLeaidKey);
  const stableOverlayDerivedLeaids = useMemo(() => {
    if (derivedLeaidKey === prevKeyRef.current) return overlayDerivedLeaids;
    prevKeyRef.current = derivedLeaidKey;
    return overlayDerivedLeaids;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [derivedLeaidKey]);

  return {
    plansActive,
    contactsActive,
    vacanciesActive,
    activitiesActive,
    planFilterLeaids,
    overlayLeaidSet,
    overlayDerivedLeaids: stableOverlayDerivedLeaids,
    filteredContacts,
    filteredVacancies,
    filteredActivities,
    filterOverlayGeoJSON,
  };
}
