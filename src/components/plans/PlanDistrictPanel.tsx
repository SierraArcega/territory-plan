"use client";

// PlanDistrictPanel - Sliding right panel that shows full district details
// when a district or contact is clicked from within the plan view.
// Reuses all existing panel section components from the map SidePanel,
// and adds a plan-specific context section at the top showing targets,
// services, notes, tags, and recent activities for that district in the plan.

import { useEffect, useRef, useState } from "react";
import {
  useDistrictDetail,
  useActivities,
  useUpdateDistrictTargets,
  useServices,
  type TerritoryPlanDistrict,
} from "@/lib/api";
import InlineEditCell from "@/components/common/InlineEditCell";
import ServiceSelector from "@/components/plans/ServiceSelector";
import DistrictHeader from "@/components/panel/DistrictHeader";
import FullmindMetrics from "@/components/panel/FullmindMetrics";
import DistrictInfo from "@/components/panel/DistrictInfo";
import DemographicsChart from "@/components/panel/DemographicsChart";
import StudentPopulations from "@/components/panel/StudentPopulations";
import AcademicMetrics from "@/components/panel/AcademicMetrics";
import FinanceData from "@/components/panel/FinanceData";
import StaffingSalaries from "@/components/panel/StaffingSalaries";
import CompetitorSpend from "@/components/panel/CompetitorSpend";
import NotesEditor from "@/components/panel/NotesEditor";
import TagsEditor from "@/components/panel/TagsEditor";
import ContactsList from "@/components/panel/ContactsList";

interface PlanDistrictPanelProps {
  leaid: string;
  planId: string;
  planColor: string;
  // The plan-specific district data (targets, services, notes, tags)
  planDistrict: TerritoryPlanDistrict | undefined;
  // If opened from contacts tab, highlight this contact
  highlightContactId?: number | null;
  onClose: () => void;
}

// Format currency for display (used in read-only spots like activities)
function formatCurrency(value: number | null): string {
  if (value === null || value === undefined) return "Not set";
  return `$${value.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// Format a raw string value as currency for InlineEditCell display mode
function formatCurrencyDisplay(value: string): string {
  const num = parseFloat(value.replace(/[,$\s]/g, ""));
  if (isNaN(num)) return "—";
  return `$${num.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}

// Parse a user-entered currency string into a number (or null)
function parseCurrencyInput(value: string): number | null {
  const cleaned = value.replace(/[,$\s]/g, "");
  if (!cleaned) return null;
  const parsed = parseFloat(cleaned);
  return isNaN(parsed) ? null : parsed;
}

// Format activity type for display
function formatActivityType(type: string): string {
  return type
    .replace(/_/g, " ")
    .replace(/\b\w/g, (c) => c.toUpperCase());
}

// Format a date string nicely
function formatDate(dateString: string | null): string {
  if (!dateString) return "";
  const datePart = dateString.split("T")[0];
  return new Date(datePart + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
  });
}

export default function PlanDistrictPanel({
  leaid,
  planId,
  planColor,
  planDistrict,
  highlightContactId,
  onClose,
}: PlanDistrictPanelProps) {
  // Fetch full district detail (same hook the map SidePanel uses)
  const { data, isLoading, error } = useDistrictDetail(leaid);

  // Fetch recent activities for this district within this plan
  const { data: activitiesResponse } = useActivities({
    planId,
    districtLeaid: leaid,
  });
  const recentActivities = (activitiesResponse?.activities || []).slice(0, 3);

  // Mutation for saving targets and services
  const updateTargets = useUpdateDistrictTargets();
  // Fetch available services for the service selector
  const { data: allServices = [] } = useServices();
  // Track whether the service selector dropdowns are open
  const [showReturnServiceSelector, setShowReturnServiceSelector] = useState(false);
  const [showNewServiceSelector, setShowNewServiceSelector] = useState(false);

  // Ref for the contacts section — scroll to it when opened from contacts tab
  const contactsRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // When panel opens with a highlighted contact, scroll to the contacts section
  useEffect(() => {
    if (highlightContactId && contactsRef.current && scrollContainerRef.current) {
      // Small delay so the panel can render first
      const timer = setTimeout(() => {
        contactsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [highlightContactId, data]);

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  return (
    <>
      {/* Sliding panel — no backdrop so the plan content stays visible and clickable */}
      <div className="fixed top-0 right-0 h-full w-[420px] bg-white shadow-xl z-40 flex flex-col overflow-hidden panel-slide-in border-l border-gray-200">
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute top-4 right-4 w-8 h-8 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500 hover:text-[#403770] z-10"
          aria-label="Close panel"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Content */}
        {isLoading ? (
          <div className="flex-1 flex items-center justify-center">
            <div className="animate-spin rounded-full h-8 w-8 border-2 border-[#F37167] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="flex-1 flex items-center justify-center p-4">
            <div className="text-center text-red-500">
              <p className="font-medium">Error loading district</p>
              <p className="text-sm mt-1">{error.message}</p>
            </div>
          </div>
        ) : data ? (
          <div className="flex-1 overflow-y-auto" ref={scrollContainerRef}>
            {/* District Header — name, state, LEAID */}
            <DistrictHeader
              district={data.district}
              fullmindData={data.fullmindData}
              tags={data.tags}
            />

            {/* ── Plan Context Section ── */}
            {/* Shows plan-specific data: targets, services, notes, activities */}
            {planDistrict && (
              <div className="px-6 py-4 border-b border-gray-100 bg-gray-50/30">
                <div
                  className="rounded-lg border p-4 bg-white"
                  style={{ borderLeftWidth: "3px", borderLeftColor: planColor }}
                >
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">
                    Plan Targets
                  </h3>

                  {/* Four Targets — 2x2 grid, click to edit */}
                  <div className="grid grid-cols-2 gap-3 mb-3">
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                        Renewal
                      </div>
                      <InlineEditCell
                        type="text"
                        value={planDistrict.renewalTarget != null ? String(planDistrict.renewalTarget) : null}
                        onSave={async (value) => {
                          const parsed = parseCurrencyInput(value);
                          await updateTargets.mutateAsync({ planId, leaid, renewalTarget: parsed });
                        }}
                        placeholder="Set target"
                        className="text-sm font-semibold text-[#403770]"
                        displayFormat={formatCurrencyDisplay}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                        Winback
                      </div>
                      <InlineEditCell
                        type="text"
                        value={planDistrict.winbackTarget != null ? String(planDistrict.winbackTarget) : null}
                        onSave={async (value) => {
                          const parsed = parseCurrencyInput(value);
                          await updateTargets.mutateAsync({ planId, leaid, winbackTarget: parsed });
                        }}
                        placeholder="Set target"
                        className="text-sm font-semibold text-[#8AA891]"
                        displayFormat={formatCurrencyDisplay}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                        Expansion
                      </div>
                      <InlineEditCell
                        type="text"
                        value={planDistrict.expansionTarget != null ? String(planDistrict.expansionTarget) : null}
                        onSave={async (value) => {
                          const parsed = parseCurrencyInput(value);
                          await updateTargets.mutateAsync({ planId, leaid, expansionTarget: parsed });
                        }}
                        placeholder="Set target"
                        className="text-sm font-semibold text-[#6EA3BE]"
                        displayFormat={formatCurrencyDisplay}
                      />
                    </div>
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-0.5">
                        New Business
                      </div>
                      <InlineEditCell
                        type="text"
                        value={planDistrict.newBusinessTarget != null ? String(planDistrict.newBusinessTarget) : null}
                        onSave={async (value) => {
                          const parsed = parseCurrencyInput(value);
                          await updateTargets.mutateAsync({ planId, leaid, newBusinessTarget: parsed });
                        }}
                        placeholder="Set target"
                        className="text-sm font-semibold text-[#D4A84B]"
                        displayFormat={formatCurrencyDisplay}
                      />
                    </div>
                  </div>

                  {/* Return Services — click to add/remove */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                        Return Services
                      </div>
                      <button
                        onClick={() => setShowReturnServiceSelector(!showReturnServiceSelector)}
                        className="text-[10px] text-[#403770] hover:text-[#F37167] transition-colors font-medium"
                      >
                        {showReturnServiceSelector ? "Done" : "Edit"}
                      </button>
                    </div>
                    {planDistrict.returnServices && planDistrict.returnServices.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {planDistrict.returnServices.map((service) => (
                          <span
                            key={service.id}
                            className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full text-white"
                            style={{ backgroundColor: service.color }}
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      !showReturnServiceSelector && (
                        <p className="text-xs text-gray-400 italic">No return services</p>
                      )
                    )}
                    {showReturnServiceSelector && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        <ServiceSelector
                          services={allServices}
                          selectedIds={planDistrict.returnServices?.map(s => s.id) || []}
                          onChange={async (ids) => {
                            await updateTargets.mutateAsync({ planId, leaid, returnServiceIds: ids });
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* New Services — click to add/remove */}
                  <div className="mb-3">
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide">
                        New Services
                      </div>
                      <button
                        onClick={() => setShowNewServiceSelector(!showNewServiceSelector)}
                        className="text-[10px] text-[#403770] hover:text-[#F37167] transition-colors font-medium"
                      >
                        {showNewServiceSelector ? "Done" : "Edit"}
                      </button>
                    </div>
                    {planDistrict.newServices && planDistrict.newServices.length > 0 ? (
                      <div className="flex flex-wrap gap-1">
                        {planDistrict.newServices.map((service) => (
                          <span
                            key={service.id}
                            className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded-full text-white"
                            style={{ backgroundColor: service.color }}
                          >
                            {service.name}
                          </span>
                        ))}
                      </div>
                    ) : (
                      !showNewServiceSelector && (
                        <p className="text-xs text-gray-400 italic">No new services</p>
                      )
                    )}
                    {showNewServiceSelector && (
                      <div className="mt-2 p-2 bg-gray-50 rounded-lg border border-gray-200">
                        <ServiceSelector
                          services={allServices}
                          selectedIds={planDistrict.newServices?.map(s => s.id) || []}
                          onChange={async (ids) => {
                            await updateTargets.mutateAsync({ planId, leaid, newServiceIds: ids });
                          }}
                        />
                      </div>
                    )}
                  </div>

                  {/* Plan-specific Tags */}
                  {planDistrict.tags && planDistrict.tags.length > 0 && (
                    <div className="mb-3">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">
                        Tags
                      </div>
                      <div className="flex flex-wrap gap-1">
                        {planDistrict.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-2 py-0.5 text-[10px] font-medium rounded"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Plan Notes */}
                  {planDistrict.notes && (
                    <div className="mb-3">
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1">
                        Plan Notes
                      </div>
                      <p className="text-xs text-gray-600 leading-relaxed">
                        {planDistrict.notes}
                      </p>
                    </div>
                  )}

                  {/* Recent Activities */}
                  {recentActivities.length > 0 && (
                    <div>
                      <div className="text-[10px] text-gray-400 uppercase tracking-wide mb-1.5">
                        Recent Activities
                      </div>
                      <div className="space-y-1.5">
                        {recentActivities.map((activity) => (
                          <div
                            key={activity.id}
                            className="flex items-center justify-between text-xs"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span
                                className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                  activity.status === "completed"
                                    ? "bg-[#8AA891]"
                                    : activity.status === "cancelled"
                                    ? "bg-gray-300"
                                    : "bg-[#6EA3BE]"
                                }`}
                              />
                              <span className="text-gray-700 truncate">
                                {activity.title}
                              </span>
                            </div>
                            <span className="text-gray-400 flex-shrink-0 ml-2">
                              {formatDate(activity.startDate)}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* ── Existing District Detail Sections ── */}
            {/* These are the same sections used in the map SidePanel */}

            {data.fullmindData && (
              <FullmindMetrics fullmindData={data.fullmindData} />
            )}

            <DistrictInfo district={data.district} />

            {data.enrollmentDemographics && (
              <DemographicsChart demographics={data.enrollmentDemographics} />
            )}
            <StudentPopulations
              district={data.district}
              educationData={data.educationData}
            />
            {data.educationData && (
              <AcademicMetrics educationData={data.educationData} />
            )}

            {data.educationData && (
              <FinanceData educationData={data.educationData} />
            )}
            {data.educationData && (
              <StaffingSalaries educationData={data.educationData} />
            )}

            <CompetitorSpend leaid={leaid} />

            <div className="px-6 py-4 border-b border-gray-100">
              <TagsEditor leaid={leaid} tags={data.tags} />
            </div>
            <div className="px-6 py-4 border-b border-gray-100">
              <NotesEditor leaid={leaid} edits={data.edits} />
            </div>

            {/* Contacts section — scrolled to when opened from contacts tab */}
            <div ref={contactsRef} className="px-6 py-4">
              <ContactsList leaid={leaid} contacts={data.contacts} />
            </div>
          </div>
        ) : null}
      </div>

    </>
  );
}
