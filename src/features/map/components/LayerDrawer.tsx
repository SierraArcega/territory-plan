"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import type { OverlayLayerType } from "@/features/map/lib/store";
import LayerToggle from "./layer-drawer/LayerToggle";
import LayerFilterSection, { FilterDropdown } from "./layer-drawer/LayerFilterSection";
import DateRangeFilter from "./layer-drawer/DateRangeFilter";

/** Layer configuration: label, color, icon */
const LAYER_CONFIG: Record<
  Exclude<OverlayLayerType, "districts">,
  { label: string; color: string }
> = {
  contacts: { label: "Contacts", color: "#F37167" },
  vacancies: { label: "Vacancies", color: "#FFCF70" },
  activities: { label: "Activities", color: "#6EA3BE" },
  plans: { label: "Plans", color: "#403770" },
};

const SENIORITY_OPTIONS = [
  { value: "C-Suite", label: "C-Suite" },
  { value: "VP", label: "VP" },
  { value: "Director", label: "Director" },
  { value: "Manager", label: "Manager" },
  { value: "Individual Contributor", label: "Individual Contributor" },
];

const PERSONA_OPTIONS = [
  { value: "Decision Maker", label: "Decision Maker" },
  { value: "Influencer", label: "Influencer" },
  { value: "Champion", label: "Champion" },
  { value: "End User", label: "End User" },
];

const VACANCY_CATEGORY_OPTIONS = [
  { value: "SPED", label: "SPED" },
  { value: "ELL", label: "ELL" },
  { value: "General Ed", label: "General Ed" },
  { value: "Admin", label: "Admin" },
  { value: "Specialist", label: "Specialist" },
  { value: "Counseling", label: "Counseling" },
  { value: "Related Services", label: "Related Services" },
  { value: "Other", label: "Other" },
];

const VACANCY_STATUS_OPTIONS = [
  { value: "open", label: "Open" },
  { value: "closed", label: "Closed" },
  { value: "expired", label: "Expired" },
];

const PLAN_STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "working", label: "Working" },
  { value: "stale", label: "Stale" },
  { value: "archived", label: "Archived" },
];

const ACTIVITY_TYPE_OPTIONS = [
  { value: "conference", label: "Conference" },
  { value: "road_trip", label: "Road Trip" },
  { value: "email_campaign", label: "Email Campaign" },
  { value: "demo", label: "Demo" },
  { value: "discovery_call", label: "Discovery Call" },
  { value: "follow_up", label: "Follow Up" },
  { value: "proposal_review", label: "Proposal Review" },
  { value: "onsite_visit", label: "Onsite Visit" },
  { value: "training", label: "Training" },
  { value: "other", label: "Other" },
];

const ACTIVITY_STATUS_OPTIONS = [
  { value: "planned", label: "Planned" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

interface LayerDrawerProps {
  /** Feature counts per layer type. */
  featureCounts?: Partial<Record<OverlayLayerType, number>>;
  /** Loading states per layer type. */
  layerLoading?: Partial<Record<OverlayLayerType, boolean>>;
}

export default function LayerDrawer({ featureCounts, layerLoading }: LayerDrawerProps) {
  const activeLayers = useMapV2Store((s) => s.activeLayers);
  const layerFilters = useMapV2Store((s) => s.layerFilters);
  const dateRange = useMapV2Store((s) => s.dateRange);
  const layerDrawerOpen = useMapV2Store((s) => s.layerDrawerOpen);
  const toggleLayer = useMapV2Store((s) => s.toggleLayer);
  const setLayerFilter = useMapV2Store((s) => s.setLayerFilter);
  const setDateRange = useMapV2Store((s) => s.setDateRange);
  const toggleLayerDrawer = useMapV2Store((s) => s.toggleLayerDrawer);

  const anyOverlayActive = activeLayers.has("contacts") ||
    activeLayers.has("vacancies") ||
    activeLayers.has("plans") ||
    activeLayers.has("activities");

  // Collapsed icon strip
  if (!layerDrawerOpen) {
    return (
      <div className="absolute top-3 left-3 z-20">
        <button
          onClick={toggleLayerDrawer}
          className="flex items-center justify-center w-10 h-10 bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg hover:bg-[#F7F5FA] transition-colors"
          aria-label="Open layer drawer"
        >
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <path
              d="M2 4H16M2 9H16M2 14H10"
              stroke={anyOverlayActive ? "#403770" : "#8A80A8"}
              strokeWidth="1.5"
              strokeLinecap="round"
            />
          </svg>
          {anyOverlayActive && (
            <span className="absolute -top-0.5 -right-0.5 w-2.5 h-2.5 rounded-full bg-[#F37167] border border-white" />
          )}
        </button>
      </div>
    );
  }

  return (
    <div className="absolute top-3 left-3 z-20 w-[240px] bg-white/95 backdrop-blur-sm rounded-2xl shadow-lg overflow-hidden panel-v2-enter">
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-[#E2DEEC]">
        <h3 className="text-xs font-medium text-[#8A80A8] uppercase tracking-wider">
          Layers
        </h3>
        <button
          onClick={toggleLayerDrawer}
          className="w-6 h-6 rounded-lg hover:bg-[#EFEDF5] flex items-center justify-center transition-colors"
          aria-label="Collapse layer drawer"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
            <path
              d="M8 2L4 6L8 10"
              stroke="#A69DC0"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </button>
      </div>

      {/* Layer stack */}
      <div className="p-3 space-y-2.5">
        {/* Districts toggle */}
        <LayerToggle
          layer="districts"
          label="Districts"
          color="#403770"
          checked={activeLayers.has("districts")}
          onToggle={toggleLayer}
        />

        {/* Overlay layers */}
        {(Object.keys(LAYER_CONFIG) as Array<Exclude<OverlayLayerType, "districts">>).map(
          (layer) => {
            const config = LAYER_CONFIG[layer];
            const isActive = activeLayers.has(layer);
            return (
              <LayerToggle
                key={layer}
                layer={layer}
                label={config.label}
                color={config.color}
                checked={isActive}
                count={featureCounts?.[layer]}
                isLoading={layerLoading?.[layer]}
                onToggle={toggleLayer}
              />
            );
          }
        )}
      </div>

      {/* Per-layer filters — only show when a layer is active */}
      {activeLayers.has("contacts") && (
        <LayerFilterSection label="Contact Filters" expanded>
          <FilterDropdown
            label="Seniority"
            value={layerFilters.contacts.seniorityLevel}
            options={SENIORITY_OPTIONS}
            onChange={(v) => setLayerFilter("contacts", { seniorityLevel: v })}
          />
          <FilterDropdown
            label="Persona"
            value={layerFilters.contacts.persona}
            options={PERSONA_OPTIONS}
            onChange={(v) => setLayerFilter("contacts", { persona: v })}
          />
        </LayerFilterSection>
      )}

      {activeLayers.has("vacancies") && (
        <LayerFilterSection label="Vacancy Filters" expanded>
          <FilterDropdown
            label="Category"
            value={layerFilters.vacancies.category}
            options={VACANCY_CATEGORY_OPTIONS}
            onChange={(v) => setLayerFilter("vacancies", { category: v })}
          />
          <FilterDropdown
            label="Status"
            value={layerFilters.vacancies.status}
            options={VACANCY_STATUS_OPTIONS}
            onChange={(v) => setLayerFilter("vacancies", { status: v })}
          />
        </LayerFilterSection>
      )}

      {activeLayers.has("plans") && (
        <LayerFilterSection label="Plan Filters" expanded>
          <FilterDropdown
            label="Status"
            value={layerFilters.plans.status}
            options={PLAN_STATUS_OPTIONS}
            onChange={(v) => setLayerFilter("plans", { status: v })}
          />
        </LayerFilterSection>
      )}

      {activeLayers.has("activities") && (
        <LayerFilterSection label="Activity Filters" expanded>
          <FilterDropdown
            label="Type"
            value={layerFilters.activities.type}
            options={ACTIVITY_TYPE_OPTIONS}
            onChange={(v) => setLayerFilter("activities", { type: v })}
          />
          <FilterDropdown
            label="Status"
            value={layerFilters.activities.status}
            options={ACTIVITY_STATUS_OPTIONS}
            onChange={(v) => setLayerFilter("activities", { status: v })}
          />
        </LayerFilterSection>
      )}

      {/* Date range — shown when activities or vacancies layer is active */}
      {(activeLayers.has("activities") || activeLayers.has("vacancies")) && (
        <div className="border-t border-[#E2DEEC] p-3">
          <DateRangeFilter dateRange={dateRange} onChange={setDateRange} />
        </div>
      )}

      {/* No layers active prompt */}
      {!anyOverlayActive && !activeLayers.has("districts") && (
        <div className="px-3 pb-3">
          <p className="text-[10px] text-[#A69DC0] text-center">
            Toggle a layer to explore your territory
          </p>
        </div>
      )}
    </div>
  );
}
