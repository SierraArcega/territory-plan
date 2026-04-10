"use client";

import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  useTerritoryPlans,
  useTerritoryPlan,
  useCreateTerritoryPlan,
  useUpdateTerritoryPlan,
  useDeleteTerritoryPlan,
  useRemoveDistrictFromPlan,
  usePlanContacts,
  useActivities,
  useCreateActivity,
  useUpdateActivity,
  useDeleteActivity,
  useUnlinkActivityPlan,
  type ActivityListItem,
  usePlanEngagement,
  type TerritoryPlan,
} from "@/lib/api";
import { type ActivityFormData } from "@/features/plans/components/ActivityFormModal";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useMapV2Store } from "@/features/map/lib/store";
import PlanCard from "@/features/plans/components/PlanCard";
import PlanFormModal, { type PlanFormData } from "@/features/plans/components/PlanFormModal";
import ActivityFormModal from "@/features/plans/components/ActivityFormModal";
import PlanTabs from "@/features/plans/components/PlanTabs";
import PlanDistrictPanel from "@/features/plans/components/PlanDistrictPanel";
import BulkScanButton from "@/features/vacancies/components/BulkScanButton";
import ViewToggle from "@/features/shared/components/ViewToggle";
import PlansTable from "@/features/plans/components/PlansTable";
import { MultiSelect } from "@/features/shared/components/MultiSelect";
import type { MultiSelectOption } from "@/features/shared/components/MultiSelect";
import { AsyncMultiSelect } from "@/features/shared/components/AsyncMultiSelect";
import { X } from "lucide-react";
import PlanDetailModal from "@/features/map/components/SearchResults/PlanDetailModal";

// Exported for unit testing — the filteredPlans useMemo delegates directly to this.
export function applyPlanFilters(
  plans: TerritoryPlan[],
  {
    nameSearch,
    descriptionSearch,
    statuses,
    fiscalYears,
    ownerIds,
    stateFips,
    districtLeaids,
  }: {
    nameSearch: string;
    descriptionSearch: string;
    statuses: string[];
    fiscalYears: string[];
    ownerIds: string[];
    stateFips: string[];
    districtLeaids: string[];
  }
): TerritoryPlan[] {
  let result = plans;
  if (nameSearch.trim())
    result = result.filter((p) =>
      p.name.toLowerCase().includes(nameSearch.trim().toLowerCase())
    );
  if (descriptionSearch.trim())
    result = result.filter((p) =>
      (p.description ?? "").toLowerCase().includes(descriptionSearch.trim().toLowerCase())
    );
  if (statuses.length)
    result = result.filter((p) => statuses.includes(p.status));
  if (fiscalYears.length)
    result = result.filter((p) => fiscalYears.includes(String(p.fiscalYear)));
  if (ownerIds.length)
    result = result.filter((p) => p.owner && ownerIds.includes(p.owner.id));
  if (stateFips.length)
    result = result.filter((p) => p.states.some((s) => stateFips.includes(s.fips)));
  if (districtLeaids.length)
    result = result.filter((p) =>
      (p.districtLeaids ?? []).some((id) => districtLeaids.includes(id))
    );
  return result;
}

// Status badge styling
function getStatusBadge(status: string) {
  switch (status) {
    case "planning":
      return { label: "Planning", className: "bg-[#EFEDF5] text-[#6E6390]" };
    case "working":
      return { label: "Working", className: "bg-[#8AA891] text-white" };
    case "stale":
      return { label: "Stale", className: "bg-amber-200 text-amber-800" };
    case "archived":
      return { label: "Archived", className: "bg-[#A69DC0] text-white" };
    default:
      return { label: status, className: "bg-[#EFEDF5] text-[#6E6390]" };
  }
}

/**
 * PlansView shows either the plans list or a plan detail view.
 * Navigation is handled via local state (selectedPlanId) with breadcrumb to go back.
 *
 * Structure:
 * - selectedPlanId === null: Show plans list
 * - selectedPlanId !== null: Show plan detail with breadcrumb
 */

interface PlansViewProps {
  // Optional: initial plan ID to show (e.g., from URL param)
  initialPlanId?: string | null;
  // Callback when selected plan changes (for URL sync)
  onPlanChange?: (planId: string | null) => void;
}

export default function PlansView({ initialPlanId = null, onPlanChange }: PlansViewProps) {
  // Track which plan is being viewed (null = list view)
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(initialPlanId);
  const [showCreateModal, setShowCreateModal] = useState(false);

  // Fetch plans for prev/next navigation in the modal
  const { data: plans = [] } = useTerritoryPlans();
  const planIds = useMemo(() => plans.map((p) => p.id), [plans]);
  const currentIndex = selectedPlanId ? planIds.indexOf(selectedPlanId) : -1;

  const handlePrev = useCallback(() => {
    if (currentIndex > 0) {
      const prevId = planIds[currentIndex - 1];
      setSelectedPlanId(prevId);
      onPlanChange?.(prevId);
    }
  }, [currentIndex, planIds, onPlanChange]);

  const handleNext = useCallback(() => {
    if (currentIndex < planIds.length - 1) {
      const nextId = planIds[currentIndex + 1];
      setSelectedPlanId(nextId);
      onPlanChange?.(nextId);
    }
  }, [currentIndex, planIds, onPlanChange]);

  // Notify parent when selection changes
  const handleSelectPlan = (planId: string | null) => {
    setSelectedPlanId(planId);
    onPlanChange?.(planId);
  };

  // Always render the list; overlay the modal when a plan is selected
  return (
    <>
      <PlansListView
        onSelectPlan={handleSelectPlan}
        showCreateModal={showCreateModal}
        setShowCreateModal={setShowCreateModal}
      />
      {selectedPlanId && (
        <PlanDetailModal
          planId={selectedPlanId}
          onClose={() => handleSelectPlan(null)}
          onPrev={currentIndex > 0 ? handlePrev : undefined}
          onNext={currentIndex < planIds.length - 1 ? handleNext : undefined}
        />
      )}
    </>
  );
}

// Status filter options are static — defined at module level to avoid reconstruction on every render.
const STATUS_FILTER_OPTIONS: MultiSelectOption[] = [
  { value: "planning", label: "Planning" },
  { value: "working", label: "Working" },
  { value: "stale", label: "Stale" },
  { value: "archived", label: "Archived" },
];

// ============================================================================
// Plans List View - Shows all plans in a grid
// ============================================================================

interface PlansListViewProps {
  onSelectPlan: (planId: string) => void;
  showCreateModal: boolean;
  setShowCreateModal: (show: boolean) => void;
}

function PlansListView({ onSelectPlan, showCreateModal, setShowCreateModal }: PlansListViewProps) {
  const [view, setView] = useState<"cards" | "table">("table");
  const [planToEdit, setPlanToEdit] = useState<TerritoryPlan | null>(null);
  const { data: plans, isLoading, error } = useTerritoryPlans();
  const { data: engagementData } = usePlanEngagement();
  const createPlan = useCreateTerritoryPlan();
  const updatePlan = useUpdateTerritoryPlan();
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const setCurrentPlanId = useMapStore((s) => s.setCurrentPlanId);
  const setPlanHighlight = useMapStore((s) => s.setPlanHighlight);
  const addSearchFilter = useMapV2Store((s) => s.addSearchFilter);
  const clearSearchFilters = useMapV2Store((s) => s.clearSearchFilters);

  const handleShowOnMap = useCallback((planId: string) => {
    const plan = plans?.find((p) => p.id === planId);
    if (!plan || plan.districtCount === 0) return;

    setCurrentPlanId(planId);
    setPlanHighlight({
      districtLeaids: plan.districtLeaids ?? [],
      planName: plan.name,
    });
    // Clear any existing map search filters, then set Plan Membership for this plan
    clearSearchFilters();
    addSearchFilter({
      id: crypto.randomUUID(),
      column: "planNames",
      op: "eq",
      value: [plan.name],
    });
    setActiveTab("map");
  }, [plans, setCurrentPlanId, setPlanHighlight, clearSearchFilters, addSearchFilter, setActiveTab]);

  // --- Filter state ---
  const [nameSearch, setNameSearch] = useState("");
  const [descriptionSearch, setDescriptionSearch] = useState("");
  const [nameInputValue, setNameInputValue] = useState("");
  const [descriptionInputValue, setDescriptionInputValue] = useState("");
  const nameDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const descriptionDebounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const [selectedStatuses, setSelectedStatuses] = useState<string[]>([]);
  const [selectedFiscalYears, setSelectedFiscalYears] = useState<string[]>([]);
  const [selectedOwnerIds, setSelectedOwnerIds] = useState<string[]>([]);
  const [selectedStateFips, setSelectedStateFips] = useState<string[]>([]);
  const [selectedDistrictLeaids, setSelectedDistrictLeaids] = useState<string[]>([]);

  const anyFilterActive = [
    selectedStatuses,
    selectedFiscalYears,
    selectedOwnerIds,
    selectedStateFips,
    selectedDistrictLeaids,
  ].some((arr) => arr.length > 0) || nameSearch.trim() !== "" || descriptionSearch.trim() !== "";

  const clearAllFilters = useCallback(() => {
    setNameSearch("");
    setDescriptionSearch("");
    setNameInputValue("");
    setDescriptionInputValue("");
    setSelectedStatuses([]);
    setSelectedFiscalYears([]);
    setSelectedOwnerIds([]);
    setSelectedStateFips([]);
    setSelectedDistrictLeaids([]);
  }, []);

  // Derived options for simple filters — only show values that exist in loaded plans
  const fyOptions: MultiSelectOption[] = useMemo(
    () =>
      [...new Set((plans ?? []).map((p) => p.fiscalYear))]
        .sort()
        .map((year) => ({
          value: String(year),
          label: "FY" + String(year).slice(-2),
        })),
    [plans]
  );

  const ownerOptions: MultiSelectOption[] = useMemo(() => {
    const seen = new Set<string>();
    return (plans ?? [])
      .flatMap((p) => (p.owner ? [p.owner] : []))
      .filter((o) => {
        if (seen.has(o.id)) return false;
        seen.add(o.id);
        return true;
      })
      .map((o) => ({ value: o.id, label: o.fullName ?? o.id }));
  }, [plans]);

  const stateOptions: MultiSelectOption[] = useMemo(() => {
    const seen = new Set<string>();
    return (plans ?? [])
      .flatMap((p) => p.states)
      .filter((s) => {
        if (seen.has(s.fips)) return false;
        seen.add(s.fips);
        return true;
      })
      .map((s) => ({ value: s.fips, label: s.abbrev }));
  }, [plans]);

  // Async search handlers — transform raw API response to MultiSelectOption[]
  const searchDistricts = useCallback(
    async (query: string): Promise<MultiSelectOption[]> => {
      const res = await fetch(
        `/api/districts?search=${encodeURIComponent(query)}&limit=10`
      );
      if (!res.ok) throw new Error("Search failed");
      const data = await res.json();
      return (data.districts ?? []).map(
        (d: { leaid: string; name: string; stateAbbrev: string | null }) => ({
          value: d.leaid,
          label: d.stateAbbrev ? `${d.name} (${d.stateAbbrev})` : d.name,
        })
      );
    },
    []
  );

  // filteredPlans — delegates to applyPlanFilters (exported pure function)
  const filteredPlans = useMemo(
    () =>
      applyPlanFilters(plans ?? [], {
        nameSearch,
        descriptionSearch,
        statuses: selectedStatuses,
        fiscalYears: selectedFiscalYears,
        ownerIds: selectedOwnerIds,
        stateFips: selectedStateFips,
        districtLeaids: selectedDistrictLeaids,
      }),
    [
      plans,
      nameSearch,
      descriptionSearch,
      selectedStatuses,
      selectedFiscalYears,
      selectedOwnerIds,
      selectedStateFips,
      selectedDistrictLeaids,
    ]
  );

  const filterToolbar = plans && plans.length > 0 ? (
    <div className="flex flex-wrap items-start gap-3">
      {/* Name text search */}
      <div className="relative">
        <input
          type="text"
          value={nameInputValue}
          onChange={(e) => {
            const val = e.target.value;
            setNameInputValue(val);
            clearTimeout(nameDebounceRef.current);
            nameDebounceRef.current = setTimeout(() => setNameSearch(val), 300);
          }}
          placeholder="Name…"
          className="h-9 px-3 pr-8 text-sm border border-[#D4CFE2] rounded-lg bg-white text-[#403770] placeholder-[#8A80A8] focus:outline-none focus:ring-2 focus:ring-[#403770]/20 w-[160px]"
        />
        {nameInputValue && (
          <button
            type="button"
            onClick={() => {
              setNameInputValue("");
              clearTimeout(nameDebounceRef.current);
              setNameSearch("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A80A8] hover:text-[#403770]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      {/* Description text search */}
      <div className="relative">
        <input
          type="text"
          value={descriptionInputValue}
          onChange={(e) => {
            const val = e.target.value;
            setDescriptionInputValue(val);
            clearTimeout(descriptionDebounceRef.current);
            descriptionDebounceRef.current = setTimeout(() => setDescriptionSearch(val), 300);
          }}
          placeholder="Description…"
          className="h-9 px-3 pr-8 text-sm border border-[#D4CFE2] rounded-lg bg-white text-[#403770] placeholder-[#8A80A8] focus:outline-none focus:ring-2 focus:ring-[#403770]/20 w-[160px]"
        />
        {descriptionInputValue && (
          <button
            type="button"
            onClick={() => {
              setDescriptionInputValue("");
              clearTimeout(descriptionDebounceRef.current);
              setDescriptionSearch("");
            }}
            className="absolute right-2 top-1/2 -translate-y-1/2 text-[#8A80A8] hover:text-[#403770]"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        )}
      </div>
      <MultiSelect
        id="filter-owner"
        label="Owner"
        options={ownerOptions}
        selected={selectedOwnerIds}
        onChange={setSelectedOwnerIds}
        placeholder="Owner"
        countLabel="owners"
        searchPlaceholder="Search owners…"
      />
      <MultiSelect
        id="filter-states"
        label="States"
        options={stateOptions}
        selected={selectedStateFips}
        onChange={setSelectedStateFips}
        placeholder="States"
        countLabel="states"
        searchPlaceholder="Search states…"
      />
      <MultiSelect
        id="filter-fy"
        label="Fiscal Year"
        options={fyOptions}
        selected={selectedFiscalYears}
        onChange={setSelectedFiscalYears}
        placeholder="FY"
        countLabel="years"
        searchPlaceholder="Search years…"
      />
      <MultiSelect
        id="filter-status"
        label="Status"
        options={STATUS_FILTER_OPTIONS}
        selected={selectedStatuses}
        onChange={setSelectedStatuses}
        placeholder="Status"
        countLabel="statuses"
        searchPlaceholder="Search statuses…"
      />
      <AsyncMultiSelect
        id="filter-districts"
        label="Districts"
        selected={selectedDistrictLeaids}
        onChange={setSelectedDistrictLeaids}
        onSearch={searchDistricts}
        placeholder="Districts…"
        countLabel="districts"
        searchPlaceholder="Search districts…"
      />
      {anyFilterActive && (
        <button
          type="button"
          onClick={clearAllFilters}
          className="h-9 px-3 text-sm text-[#403770]/60 hover:text-[#403770] flex items-center gap-1 transition-colors"
        >
          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
          Clear
        </button>
      )}
    </div>
  ) : undefined;

  const handleUpdatePlan = async (data: PlanFormData) => {
    if (!planToEdit) return;
    await updatePlan.mutateAsync({
      id: planToEdit.id,
      name: data.name,
      description: data.description || undefined,
      ownerId: data.ownerId ?? undefined,
      color: data.color,
      status: data.status,
      fiscalYear: data.fiscalYear,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      stateFips: data.stateFips,
      collaboratorIds: data.collaboratorIds,
    });
  };

  // Build a map from planId → engagement data for quick lookup
  const engagementMap = new Map(
    (engagementData || []).map((e) => [e.planId, e])
  );

  const handleCreatePlan = async (data: PlanFormData) => {
    await createPlan.mutateAsync({
      name: data.name,
      description: data.description || undefined,
      ownerId: data.ownerId ?? undefined,
      color: data.color,
      status: data.status,
      fiscalYear: data.fiscalYear,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      stateFips: data.stateFips,
      collaboratorIds: data.collaboratorIds,
    });
  };

  return (
    <div className="h-full flex flex-col bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-[#D4CFE2] px-6 py-4 shrink-0">
        <div className="max-w-6xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold text-[#403770]">Territory Plans</h1>
            <p className="text-sm text-[#8A80A8]">
              Manage your territory plans and assigned districts
            </p>
          </div>
          <div className="flex items-center gap-4">
            {/* View toggle - hidden on mobile */}
            <div className="hidden md:block">
              <ViewToggle view={view} onViewChange={(v) => setView(v as "cards" | "table")} />
            </div>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Plan
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-6xl mx-auto px-6 py-4 flex-1 min-h-0 w-full flex flex-col">
        {isLoading ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center">
              <div className="animate-spin rounded-full h-12 w-12 border-4 border-[#F37167] border-t-transparent mx-auto mb-4" />
              <p className="text-[#403770] font-medium">Loading plans...</p>
            </div>
          </div>
        ) : error ? (
          <div className="flex items-center justify-center py-20">
            <div className="text-center text-red-500">
              <svg className="w-12 h-12 mx-auto mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <p className="font-medium mb-1">Error loading plans</p>
              <p className="text-sm">{error.message}</p>
            </div>
          </div>
        ) : filteredPlans.length > 0 || (plans && plans.length > 0) || anyFilterActive ? (
          view === "cards" ? (
            <>
              {filterToolbar && (
                <div className="px-4 py-2.5 border-b border-[#E2DEEC] bg-[#F7F5FA] rounded-t-lg border-x border-t border-[#D4CFE2]">
                  {filterToolbar}
                </div>
              )}
              {filteredPlans.length > 0 ? (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 overflow-auto">
                  {filteredPlans.map((plan) => (
                    <div
                      key={plan.id}
                      onClick={() => onSelectPlan(plan.id)}
                      className="cursor-pointer"
                    >
                      <PlanCard plan={plan} engagement={engagementMap.get(plan.id)} />
                    </div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-16 bg-white rounded-b-lg border-x border-b border-[#D4CFE2]">
                  <p className="text-[#6E6390] font-medium mb-2">No plans match your filters</p>
                  <button
                    onClick={clearAllFilters}
                    className="text-sm text-[#F37167] hover:text-[#e5574d] font-medium cursor-pointer"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </>
          ) : (
            <PlansTable
              plans={filteredPlans}
              onSelectPlan={onSelectPlan}
              onEditPlan={setPlanToEdit}
              onShowOnMap={handleShowOnMap}
              onFilterByOwner={(ownerId) => setSelectedOwnerIds([ownerId])}
              toolbar={filterToolbar}
              hasActiveFilters={anyFilterActive}
              onClearFilters={clearAllFilters}
            />
          )
        ) : (
          <div className="text-center py-20">
            <svg
              className="w-20 h-20 mx-auto text-[#C2BBD4] mb-6"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
              />
            </svg>
            <h2 className="text-xl font-semibold text-[#6E6390] mb-2">
              No territory plans yet
            </h2>
            <p className="text-[#8A80A8] max-w-md mx-auto mb-6">
              Create your first territory plan to start organizing districts and planning your sales strategy.
            </p>
            <button
              onClick={() => setShowCreateModal(true)}
              className="inline-flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create Your First Plan
            </button>
          </div>
        )}
      </main>

      {/* Create Plan Modal */}
      <PlanFormModal
        isOpen={showCreateModal}
        onClose={() => setShowCreateModal(false)}
        onSubmit={handleCreatePlan}
        title="Create Territory Plan"
      />

      {/* Edit Plan Modal */}
      <PlanFormModal
        isOpen={planToEdit !== null}
        onClose={() => setPlanToEdit(null)}
        onSubmit={handleUpdatePlan}
        initialData={planToEdit ?? undefined}
        title="Edit Territory Plan"
      />
    </div>
  );
}

// ============================================================================
// Plan Detail View - Shows a single plan with districts and activities
// ============================================================================

interface PlanDetailViewProps {
  planId: string;
  onBack: () => void;
  onNavigate: (planId: string) => void;
}

function PlanDetailView({ planId, onBack, onNavigate }: PlanDetailViewProps) {
  const [showEditModal, setShowEditModal] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [showActivityModal, setShowActivityModal] = useState(false);
  const [editingActivity, setEditingActivity] = useState<ActivityListItem | null>(null);

  // District detail panel state — tracks which district is open and optional contact highlight
  const [panelLeaid, setPanelLeaid] = useState<string | null>(null);
  const [highlightContactId, setHighlightContactId] = useState<number | null>(null);

  // Get setActiveTab to navigate to map for "Add from Map" link
  const setActiveTab = useMapStore((state) => state.setActiveTab);

  const { data: plan, isLoading, error } = useTerritoryPlan(planId);
  const { data: activitiesResponse } = useActivities({ planId });
  const activities = activitiesResponse?.activities || [];
  const [isEnriching, setIsEnriching] = useState(false);
  const { data: contacts = [] } = usePlanContacts(planId, {
    refetchInterval: isEnriching ? 5000 : false,
  });
  const updatePlan = useUpdateTerritoryPlan();
  const deletePlan = useDeleteTerritoryPlan();
  const removeDistrict = useRemoveDistrictFromPlan();
  const createActivity = useCreateActivity();
  const updateActivity = useUpdateActivity();
  const deleteActivity = useDeleteActivity();
  const unlinkActivityPlan = useUnlinkActivityPlan();

  // Plan navigation — prev/next arrows
  const { data: allPlans } = useTerritoryPlans();
  const planIds = useMemo(() => (allPlans ?? []).map((p) => p.id), [allPlans]);
  const currentIdx = planIds.indexOf(planId);
  const prevPlanId = currentIdx > 0 ? planIds[currentIdx - 1] : null;
  const nextPlanId = currentIdx >= 0 && currentIdx < planIds.length - 1 ? planIds[currentIdx + 1] : null;

  const handleUpdatePlan = async (data: PlanFormData) => {
    await updatePlan.mutateAsync({
      id: planId,
      name: data.name,
      description: data.description || undefined,
      ownerId: data.ownerId ?? undefined,
      color: data.color,
      status: data.status,
      fiscalYear: data.fiscalYear,
      startDate: data.startDate || undefined,
      endDate: data.endDate || undefined,
      stateFips: data.stateFips,
      collaboratorIds: data.collaboratorIds,
    });
  };

  const handleDeletePlan = async () => {
    await deletePlan.mutateAsync(planId);
    onBack(); // Return to list after delete
  };

  const handleRemoveDistrict = async (leaid: string) => {
    await removeDistrict.mutateAsync({ planId, leaid });
  };

  const handleEditActivity = (activity: ActivityListItem) => {
    setEditingActivity(activity);
    setShowActivityModal(true);
  };

  const handleDeleteActivity = async (activityId: string) => {
    await deleteActivity.mutateAsync(activityId);
  };

  const handleUnlinkActivity = async (activityId: string) => {
    await unlinkActivityPlan.mutateAsync({ activityId, planId });
  };

  const handleAddActivityClick = () => {
    setEditingActivity(null);
    setShowActivityModal(true);
  };

  const handleActivityModalClose = () => {
    setShowActivityModal(false);
    setEditingActivity(null);
  };

  // Open the district detail panel when a district is clicked
  const handleDistrictClick = (leaid: string) => {
    setPanelLeaid(leaid);
    setHighlightContactId(null);
  };

  // Open the district detail panel when a contact is clicked, with contact highlighted
  const handleContactClick = (leaid: string, contactId: number) => {
    setPanelLeaid(leaid);
    setHighlightContactId(contactId);
  };

  const handleClosePanel = () => {
    setPanelLeaid(null);
    setHighlightContactId(null);
  };

  const handleCreateActivity = async (data: ActivityFormData) => {
    await createActivity.mutateAsync({
      type: data.type,
      title: data.title,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      status: data.status,
      planIds: [planId],
      districtLeaids: data.districtLeaid ? [data.districtLeaid] : undefined,
      contactIds: data.contactIds.length > 0 ? data.contactIds : undefined,
      notes: data.notes || undefined,
    });
    handleActivityModalClose();
  };

  const handleUpdateActivitySubmit = async (data: ActivityFormData) => {
    if (!editingActivity) return;
    await updateActivity.mutateAsync({
      activityId: editingActivity.id,
      type: data.type,
      title: data.title,
      startDate: new Date(data.startDate).toISOString(),
      endDate: data.endDate ? new Date(data.endDate).toISOString() : null,
      status: data.status,
      notes: data.notes || undefined,
    });
    handleActivityModalClose();
  };

  const statusBadge = plan ? getStatusBadge(plan.status) : null;

  const fmtCurrency = (n: number | null | undefined) => {
    if (n == null) return "$0";
    if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
    if (n >= 1_000) return `$${(n / 1_000).toFixed(0)}K`;
    return `$${n.toLocaleString()}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onBack} />

      {/* Modal + navigation — matches DistrictExploreModal layout */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          {/* Prev arrow */}
          {prevPlanId ? (
            <button
              onClick={() => onNavigate(prevPlanId)}
              className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors"
              title="Previous plan (←)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : <div className="w-10 shrink-0" />}

          {/* Center column: back + modal + counter */}
          <div className="flex flex-col items-start gap-2">
            {/* Back to Plans */}
            <button
              onClick={onBack}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-semibold text-[#544A78] hover:text-[#403770] hover:bg-white transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Back to Plans
            </button>

            {/* Modal container */}
            <div className="relative bg-white rounded-2xl shadow-xl w-[70vw] max-w-[1076px] h-[70vh] max-h-[745px] flex overflow-hidden">
              {/* Left sidebar */}
              <div className="w-[260px] shrink-0 flex flex-col overflow-y-auto" style={{ background: "linear-gradient(180deg, #F7F5FA 0%, #EFEDF5 100%)" }}>
                {isLoading ? (
                  <div className="p-5 space-y-4 animate-pulse">
                    <div className="h-5 bg-[#403770]/10 rounded-full w-20" />
                    <div className="h-6 bg-[#403770]/10 rounded w-4/5" />
                    <div className="h-4 bg-[#403770]/10 rounded w-1/2" />
                    <div className="w-full h-px bg-[#E2DEEC] my-3" />
                    {Array.from({ length: 5 }).map((_, i) => (
                      <div key={i} className="flex justify-between">
                        <div className="h-3 bg-[#403770]/10 rounded w-1/3" />
                        <div className="h-3 bg-[#403770]/10 rounded w-1/4" />
                      </div>
                    ))}
                  </div>
                ) : plan ? (
                  <div className="flex flex-col h-full p-5">
                    {/* Status badge */}
                    {statusBadge && (
                      <span className={`self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider mb-4 ${statusBadge.className}`}>
                        {statusBadge.label}
                      </span>
                    )}

                    {/* Plan name */}
                    <div className="flex items-start gap-2 mb-1.5">
                      <span
                        className="w-3 h-3 rounded-full mt-1 shrink-0"
                        style={{ backgroundColor: plan.color }}
                      />
                      <h2 className="text-xl font-bold leading-tight text-[#403770]">{plan.name}</h2>
                    </div>

                    {/* Meta */}
                    <p className="text-xs text-[#8A80A8] font-medium leading-relaxed mb-1">
                      FY{String(plan.fiscalYear).slice(-2)}
                      {plan.states.length > 0 && ` · ${plan.states.map(s => s.abbrev).join(", ")}`}
                    </p>

                    {/* Edit / Delete */}
                    <div className="flex gap-2 mt-2">
                      <button
                        onClick={() => setShowEditModal(true)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#403770]/10 text-[#6E6390] hover:bg-[#403770]/15 hover:text-[#403770] transition-colors"
                        title="Edit Plan"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z" />
                        </svg>
                      </button>
                      <button
                        onClick={() => setShowDeleteConfirm(true)}
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-red-500/10 text-red-400 hover:bg-red-500/15 hover:text-red-500 transition-colors"
                        title="Delete Plan"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>

                    <div className="w-full h-px bg-[#E2DEEC] my-5" />

                    {/* Overview stats */}
                    <div className="flex flex-col gap-1.5">
                      <PlanSidebarStat label="Districts" value={String(plan.districts.length)} />
                      <PlanSidebarStat label="States" value={plan.states.length > 0 ? plan.states.map(s => s.abbrev).join(", ") : "—"} />
                      <PlanSidebarStat label="Enrollment" value={plan.totalEnrollment ? plan.totalEnrollment.toLocaleString() : "—"} />
                    </div>

                    <div className="w-full h-px bg-[#E2DEEC] my-5" />

                    {/* Targets */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-[#8A80A8] uppercase tracking-wider mb-1">Targets</span>
                      <PlanSidebarStat label="Total Target" value={fmtCurrency(plan.pipelineTotal)} bold />
                      <PlanSidebarStat label="Renewal" value={fmtCurrency(plan.renewalRollup)} />
                      <PlanSidebarStat label="Expansion" value={fmtCurrency(plan.expansionRollup)} />
                      <PlanSidebarStat label="Winback" value={fmtCurrency(plan.winbackRollup)} />
                      <PlanSidebarStat label="New Business" value={fmtCurrency(plan.newBusinessRollup)} />
                    </div>

                    <div className="w-full h-px bg-[#E2DEEC] my-5" />

                    {/* Actuals */}
                    <div className="flex flex-col gap-1.5">
                      <span className="text-[10px] font-bold text-[#8A80A8] uppercase tracking-wider mb-1">Actuals</span>
                      <PlanSidebarStat label="Revenue" value={plan.revenueActual != null ? fmtCurrency(plan.revenueActual) : "$0"} />
                      <PlanSidebarStat label="Pipeline" value={fmtCurrency(plan.pipelineTotal)} />
                    </div>

                    <div className="w-full h-px bg-[#E2DEEC] my-5" />

                    {/* Owner */}
                    {plan.owner && (
                      <>
                        <span className="text-[10px] font-bold text-[#8A80A8] uppercase tracking-wider mb-1">Owner</span>
                        <p className="text-sm font-medium text-[#403770]">{plan.owner.fullName}</p>
                      </>
                    )}

                    {/* Date range */}
                    {(plan.startDate || plan.endDate) && (
                      <>
                        <div className="w-full h-px bg-[#E2DEEC] my-5" />
                        <span className="text-[10px] font-bold text-[#8A80A8] uppercase tracking-wider mb-1">Date Range</span>
                        <p className="text-xs text-[#6E6390]">
                          {plan.startDate ? new Date(plan.startDate).toLocaleDateString() : "—"}
                          {" — "}
                          {plan.endDate ? new Date(plan.endDate).toLocaleDateString() : "—"}
                        </p>
                      </>
                    )}

                    {/* Description */}
                    {plan.description && (
                      <>
                        <div className="w-full h-px bg-[#E2DEEC] my-5" />
                        <span className="text-[10px] font-bold text-[#8A80A8] uppercase tracking-wider mb-1">Description</span>
                        <p className="text-xs text-[#6E6390] leading-relaxed">{plan.description}</p>
                      </>
                    )}
                  </div>
                ) : (
                  <div className="p-5 text-sm text-[#8A80A8]">Plan not found</div>
                )}
              </div>

              {/* Right content */}
              <div className="flex-1 flex flex-col overflow-hidden min-w-0">
                {isLoading ? (
                  <div className="flex-1 flex items-center justify-center">
                    <div className="animate-spin rounded-full h-10 w-10 border-4 border-[#F37167] border-t-transparent" />
                  </div>
                ) : error || !plan ? (
                  <div className="flex-1 flex items-center justify-center">
                    <p className="text-sm text-[#8A80A8]">
                      {error?.message || "The requested plan could not be found."}
                    </p>
                  </div>
                ) : (
                  <>
                    {/* Action bar */}
                    <div className="flex items-center justify-between px-6 py-2 border-b border-[#E2DEEC]">
                      <button
                        onClick={() => setActiveTab("map")}
                        className="inline-flex items-center gap-1.5 text-xs font-medium text-[#6E6390] hover:text-[#403770] transition-colors"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        View on Map
                      </button>
                      <div className="flex items-center gap-2">
                        <BulkScanButton territoryPlanId={planId} />
                        <button
                          onClick={() => setShowActivityModal(true)}
                          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors"
                        >
                          <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                          </svg>
                          New Activity
                        </button>
                      </div>
                    </div>

                    {/* Tabs */}
                    <div className="flex-1 overflow-auto">
                      <PlanTabs
                        planId={planId}
                        planName={plan.name}
                        districts={plan.districts}
                        activities={activities}
                        contacts={contacts}
                        onRemoveDistrict={handleRemoveDistrict}
                        isRemovingDistrict={removeDistrict.isPending}
                        onEditActivity={handleEditActivity}
                        onDeleteActivity={handleDeleteActivity}
                        onUnlinkActivity={handleUnlinkActivity}
                        onAddActivity={handleAddActivityClick}
                        isDeletingActivity={deleteActivity.isPending}
                        onDistrictClick={handleDistrictClick}
                        onContactClick={handleContactClick}
                        onGoToMap={() => setActiveTab("map")}
                        onEnrichingChange={setIsEnriching}
                      />
                    </div>

                  </>
                )}
              </div>

              {/* Close button */}
              <button
                onClick={onBack}
                className="absolute top-2 right-2 z-10 p-2 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-gray-100 transition-colors"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Counter */}
            {planIds.length > 0 && (
              <span className="self-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-semibold text-[#544A78]">
                {currentIdx + 1} of {planIds.length}
              </span>
            )}
          </div>

          {/* Next arrow */}
          {nextPlanId ? (
            <button
              onClick={() => onNavigate(nextPlanId)}
              className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors"
              title="Next plan (→)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : <div className="w-10 shrink-0" />}
        </div>
      </div>

      {/* District Detail Panel — opens when clicking a district or contact */}
      {panelLeaid && plan && (
        <PlanDistrictPanel
          leaid={panelLeaid}
          planId={planId}
          planColor={plan.color}
          highlightContactId={highlightContactId}
          onClose={handleClosePanel}
        />
      )}

      {/* Activity Form Modal */}
      {plan && (
        <ActivityFormModal
          isOpen={showActivityModal}
          onClose={handleActivityModalClose}
          onSubmit={editingActivity ? handleUpdateActivitySubmit : handleCreateActivity}
          districts={plan.districts.map(d => ({
            leaid: d.leaid,
            name: d.name,
            stateAbbrev: d.stateAbbrev,
          }))}
          initialData={editingActivity}
          title={editingActivity ? "Edit Activity" : "New Activity"}
        />
      )}

      {/* Edit Modal */}
      {plan && (
        <PlanFormModal
          isOpen={showEditModal}
          onClose={() => setShowEditModal(false)}
          onSubmit={handleUpdatePlan}
          initialData={plan}
          title="Edit Territory Plan"
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && plan && (
        <div className="fixed inset-0 z-[60] flex items-center justify-center">
          <div className="absolute inset-0 bg-black/50" onClick={() => setShowDeleteConfirm(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-sm mx-4 p-6">
            <h3 className="text-lg font-semibold text-[#403770] mb-2">Delete Plan?</h3>
            <p className="text-[#6E6390] text-sm mb-6">
              Are you sure you want to delete &ldquo;{plan.name}&rdquo;? This will remove all district associations. This action cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-sm font-medium text-[#6E6390] hover:bg-[#EFEDF5] rounded-lg transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleDeletePlan}
                disabled={deletePlan.isPending}
                className="px-4 py-2 text-sm font-medium text-white bg-red-500 hover:bg-red-600 rounded-lg transition-colors disabled:opacity-50"
              >
                {deletePlan.isPending ? "Deleting..." : "Delete Plan"}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

function PlanSidebarStat({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className="flex items-baseline justify-between gap-2">
      <span className="text-xs text-[#8A80A8]">{label}</span>
      <span className={`text-xs ${bold ? "font-semibold" : "font-medium"} text-[#403770] tabular-nums`}>{value}</span>
    </div>
  );
}
