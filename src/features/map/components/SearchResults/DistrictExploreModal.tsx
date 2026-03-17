"use client";

import { useState, useEffect, useRef } from "react";
import { useDistrictDetail } from "@/features/districts/lib/queries";
import { useTerritoryPlans, useAddDistrictsToPlan } from "@/lib/api";
import type { FullmindData, DistrictEducationData, DistrictTrends } from "@/features/shared/types/api-types";

type Tab = "overview" | "financials" | "contacts" | "schools";

interface DistrictExploreModalProps {
  leaid: string;
  onClose: () => void;
  onPrev?: () => void;
  onNext?: () => void;
  currentIndex?: number;
  totalCount?: number;
}

export default function DistrictExploreModal({ leaid, onClose, onPrev, onNext, currentIndex, totalCount }: DistrictExploreModalProps) {
  const { data, isLoading } = useDistrictDetail(leaid);
  const { data: plans } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();
  const [activeTab, setActiveTab] = useState<Tab>("overview");
  const [showPlanDropdown, setShowPlanDropdown] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

  // Reset tab when navigating between districts
  useEffect(() => {
    setActiveTab("overview");
    setShowPlanDropdown(false);
  }, [leaid]);

  // Keyboard: Escape to close, arrow keys to navigate
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
      if (e.key === "ArrowLeft" && onPrev) onPrev();
      if (e.key === "ArrowRight" && onNext) onNext();
    };
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose, onPrev, onNext]);

  // Close plan dropdown on outside click
  useEffect(() => {
    if (!showPlanDropdown) return;
    const handler = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setShowPlanDropdown(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [showPlanDropdown]);

  const district = data?.district;
  const fullmindData = data?.fullmindData;
  const trends = data?.trends;
  const contacts = data?.contacts || [];
  const educationData = data?.educationData;
  const demographics = data?.enrollmentDemographics;
  const existingPlanIds = new Set(data?.territoryPlanIds || []);

  const handleAddToPlan = async (planId: string) => {
    try {
      await addDistricts.mutateAsync({ planId, leaids: leaid });
      setShowPlanDropdown(false);
    } catch (error) {
      console.error("Failed to add district to plan:", error);
    }
  };

  // Format helpers
  const fmt = (n: number | null | undefined) =>
    n != null ? Number(n).toLocaleString() : "—";
  const fmtK = (n: number | null | undefined) =>
    n != null ? `$${(Number(n) / 1000).toFixed(1)}k` : "—";
  const fmtPct = (n: number | null | undefined) =>
    n != null ? `${Number(n).toFixed(1)}%` : "—";
  const fmtDelta = (n: number | null | undefined, unit: "pct" | "pt" | "ratio" = "pct") => {
    if (n == null) return null;
    const v = Number(n);
    const sign = v > 0 ? "+" : "";
    const suffix = unit === "pt" ? "pt" : unit === "ratio" ? "" : "%";
    return { value: `${sign}${v.toFixed(1)}${suffix}`, positive: v > 0 };
  };

  // Demographic data
  const demoSegments = demographics
    ? [
        { label: "White", value: demographics.enrollmentWhite, color: "#403770" },
        { label: "Hispanic", value: demographics.enrollmentHispanic, color: "#F37167" },
        { label: "Black", value: demographics.enrollmentBlack, color: "#FFCF70" },
        { label: "Asian", value: demographics.enrollmentAsian, color: "#6EA3BE" },
        { label: "Other", value: (demographics.enrollmentAmericanIndian || 0) + (demographics.enrollmentPacificIslander || 0) + (demographics.enrollmentTwoOrMore || 0), color: "#C4E7E6" },
      ].filter((s) => s.value != null && s.value > 0)
    : [];
  const demoTotal = demoSegments.reduce((sum, s) => sum + (s.value || 0), 0);

  // Signal helpers
  const signals = trends
    ? [
        { label: "Enrollment", trend: trends.enrollmentTrend3yr },
        { label: "Staffing", trend: trends.studentTeacherRatioTrend3yr != null ? -trends.studentTeacherRatioTrend3yr : null },
        { label: "Graduation", trend: trends.graduationTrend3yr },
        { label: "Spend", trend: trends.expenditurePpTrend3yr },
      ].filter((s) => s.trend != null)
    : [];

  const formatGrades = (lo: string | null, hi: string | null) => {
    if (!lo || !hi) return null;
    const map: Record<string, string> = { PK: "Pre-K", KG: "K", "01": "1", "02": "2", "03": "3", "04": "4", "05": "5", "06": "6", "07": "7", "08": "8", "09": "9", "10": "10", "11": "11", "12": "12" };
    return `${map[lo] || lo} – ${map[hi] || hi}`;
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/40" onClick={onClose} />

      {/* Modal + navigation — flex layout keeps arrows hugging the modal */}
      <div className="fixed inset-0 z-50 flex items-center justify-center">
        <div className="flex items-center gap-3">
          {/* Prev arrow */}
          {onPrev ? (
            <button
              onClick={onPrev}
              className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
              title="Previous district (←)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
              </svg>
            </button>
          ) : <div className="w-10 shrink-0" />}

          {/* Center column: return + modal + counter */}
          <div className="flex flex-col items-start gap-2">
            {/* Return to Map */}
            <button
              onClick={onClose}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-semibold text-[#544A78] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
            >
              <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 19l-7-7m0 0l7-7m-7 7h18" />
              </svg>
              Return to Map
            </button>

            {/* w/h: viewport minus arrow chrome (2×40px arrows + 2×12px gaps = 104px) and vertical chrome
                (Return to Map ~32px + counter ~24px + 2×8px gaps = ~72px, rounded to 80px).
                max-w/max-h caps preserve the original design on large screens. */}
            <div
              ref={modalRef}
              className="bg-white rounded-2xl shadow-xl w-[70vw] max-w-[1076px] h-[70vh] max-h-[745px] flex overflow-hidden"
            >
          {/* Left sidebar */}
          <div className="w-[260px] shrink-0 flex flex-col" style={{ background: "linear-gradient(180deg, #403770 0%, #544A78 100%)" }}>
            {isLoading ? (
              <SidebarSkeleton />
            ) : district ? (
              <div className="flex flex-col h-full p-5 text-white">
                {/* Badge */}
                <span className="self-start px-2.5 py-0.5 rounded-full text-[10px] font-bold uppercase tracking-wider bg-white/15 text-white/90 mb-4">
                  {fullmindData?.isCustomer ? "Customer" : "Prospect"}
                </span>

                {/* Name */}
                <h2 className="text-xl font-bold leading-tight mb-1.5">{district.name}</h2>
                <p className="text-xs text-white/60 font-medium leading-relaxed">
                  {district.stateAbbrev}
                  {district.countyName && ` · ${district.countyName}`}
                  {district.lograde && district.higrade && (
                    <><br />{formatGrades(district.lograde, district.higrade)}</>
                  )}
                  {district.numberOfSchools != null && ` · ${district.numberOfSchools} schools`}
                </p>

                {/* External links */}
                {(district.websiteUrl || district.jobBoardUrl) && (
                  <div className="flex gap-2 mt-3">
                    {district.websiteUrl && (
                      <a
                        href={district.websiteUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                        title="Visit Website"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 01-9 9m9-9a9 9 0 00-9-9m9 9H3m9 9a9 9 0 01-9-9m9 9c1.657 0 3-4.03 3-9s-1.343-9-3-9m0 18c-1.657 0-3-4.03-3-9s1.343-9 3-9" />
                        </svg>
                      </a>
                    )}
                    {district.jobBoardUrl && (
                      <a
                        href={district.jobBoardUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center justify-center w-8 h-8 rounded-lg bg-white/10 text-white/70 hover:bg-white/20 hover:text-white transition-colors"
                        title="View Job Board"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 13.255A23.931 23.931 0 0112 15c-3.183 0-6.22-.62-9-1.745M16 6V4a2 2 0 00-2-2h-4a2 2 0 00-2 2v2m4 6h.01M5 20h14a2 2 0 002-2V8a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" />
                        </svg>
                      </a>
                    )}
                  </div>
                )}

                <div className="w-full h-px bg-white/12 my-5" />

                {/* Key stats */}
                <div className="flex flex-col gap-1.5">
                  <SidebarStat label="Enrollment" value={fmt(district.enrollment)} />
                  <SidebarStat label="$/Pupil" value={fmtK(educationData?.expenditurePerPupil)} />
                  <SidebarStat label="Graduation" value={fmtPct(educationData?.graduationRateTotal)} />
                  <SidebarStat label="SWD %" value={fmtPct(trends?.swdPct)} />
                  <SidebarStat label="ELL %" value={fmtPct(trends?.ellPct)} />
                  {fullmindData?.salesExecutive && (
                    <SidebarStat label="Owner" value={fullmindData.salesExecutive} small />
                  )}
                </div>

                <div className="w-full h-px bg-white/12 my-5" />


              </div>
            ) : null}
          </div>

          {/* Right content */}
          <div className="flex-1 flex flex-col overflow-hidden min-w-0">
            {/* Tab header */}
            <div className="flex items-center justify-between px-6 py-3 border-b border-[#E2DEEC]">
              <div className="flex gap-1">
                {(["overview", "financials", "contacts", "schools"] as Tab[]).map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold capitalize transition-colors ${
                      activeTab === tab
                        ? "bg-[#403770] text-white"
                        : "text-[#8A80A8] hover:bg-[#EFEDF5] hover:text-[#544A78]"
                    }`}
                  >
                    {tab}{tab === "contacts" && contacts.length > 0 ? ` (${contacts.length})` : ""}
                  </button>
                ))}
              </div>
              <button
                onClick={onClose}
                aria-label="Close"
                className="flex items-center justify-center w-8 h-8 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>

            {/* Tab body */}
            <div className="flex-1 overflow-y-auto p-6">
              {isLoading ? (
                <ContentSkeleton />
              ) : activeTab === "overview" ? (
                <OverviewTab
                  demoSegments={demoSegments}
                  demoTotal={demoTotal}
                  fullmindData={fullmindData ?? null}
                  educationData={educationData ?? null}
                  trends={trends ?? null}
                />
              ) : activeTab === "financials" ? (
                <FinancialsTab fullmindData={fullmindData ?? null} educationData={educationData ?? null} />
              ) : activeTab === "contacts" ? (
                <ContactsTab contacts={contacts} />
              ) : activeTab === "schools" ? (
                <SchoolsTab district={district} />
              ) : null}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-end gap-2.5 px-6 py-4 border-t border-[#E2DEEC]">
              <div className="relative" ref={dropdownRef}>
                <button
                  onClick={() => setShowPlanDropdown(!showPlanDropdown)}
                  className="px-5 py-2.5 rounded-lg bg-[#403770] text-white text-sm font-semibold hover:bg-[#322a5a] transition-colors flex items-center gap-1.5"
                >
                  <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  Add to Plan
                </button>

                {showPlanDropdown && plans && (
                  <div className="absolute right-0 bottom-full mb-1.5 w-56 bg-white rounded-xl shadow-lg border border-[#D4CFE2]/60 overflow-hidden z-50">
                    <div className="max-h-48 overflow-y-auto">
                      {plans.map((plan) => {
                        const alreadyIn = existingPlanIds.has(plan.id);
                        return (
                          <button
                            key={plan.id}
                            onClick={() => !alreadyIn && handleAddToPlan(plan.id)}
                            disabled={alreadyIn}
                            className={`w-full flex items-center gap-2 px-3 py-2 text-left text-sm transition-colors ${
                              alreadyIn ? "bg-[#EFEDF5] text-[#A69DC0]" : "hover:bg-[#EFEDF5] text-[#544A78]"
                            }`}
                          >
                            <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                            <span className="truncate">{plan.name}</span>
                            {alreadyIn && (
                              <svg className="w-4 h-4 text-[#8AA891] ml-auto shrink-0" fill="currentColor" viewBox="0 0 20 20">
                                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                              </svg>
                            )}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
            {/* end modal */}
            </div>

            {/* Position counter */}
            {currentIndex != null && totalCount != null && (
              <div className="self-center px-3 py-1 rounded-full bg-white/90 backdrop-blur-sm shadow-md border border-[#D4CFE2]/60 text-xs font-medium text-[#6E6390] mt-1">
                {currentIndex + 1} of {totalCount}
              </div>
            )}
          </div>

          {/* Next arrow */}
          {onNext ? (
            <button
              onClick={onNext}
              className="shrink-0 w-10 h-10 rounded-full bg-white/90 backdrop-blur-sm shadow-lg border border-[#D4CFE2]/60 flex items-center justify-center text-[#6E6390] hover:text-[#403770] hover:bg-white transition-colors focus-visible:ring-2 focus-visible:ring-[#403770]/30 focus-visible:outline-none"
              title="Next district (→)"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            </button>
          ) : <div className="w-10 shrink-0" />}
        </div>
      </div>
    </>
  );
}

// ─── Sidebar stat row ────────────────────────────────────────────────
function SidebarStat({ label, value, small }: { label: string; value: string; small?: boolean }) {
  return (
    <div className="flex justify-between items-baseline py-1.5">
      <span className="text-[11px] font-medium text-white/55">{label}</span>
      <span className={`font-bold text-white ${small ? "text-xs" : "text-sm"}`}>{value}</span>
    </div>
  );
}

// ─── Tab: Overview ───────────────────────────────────────────────────
function OverviewTab({
  demoSegments,
  demoTotal,
  fullmindData,
  educationData,
  trends,
}: {
  demoSegments: Array<{ label: string; value: number | null; color: string }>;
  demoTotal: number;
  fullmindData: FullmindData | null;
  educationData: DistrictEducationData | null;
  trends: DistrictTrends | null;
}) {
  return (
    <>
      {/* Demographics bar */}
      {demoSegments.length > 0 && (
        <div className="mb-6">
          <SectionLabel>Enrollment Demographics</SectionLabel>
          <div className="flex h-2.5 rounded-full overflow-hidden mb-2">
            {demoSegments.map((s) => (
              <div
                key={s.label}
                style={{ width: `${((s.value || 0) / demoTotal) * 100}%`, backgroundColor: s.color }}
              />
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            {demoSegments.map((s) => (
              <span key={s.label} className="flex items-center gap-1 text-[11px] text-[#6E6390] font-medium">
                <span className="w-1.5 h-1.5 rounded-full shrink-0" style={{ backgroundColor: s.color }} />
                {s.label} {demoTotal > 0 ? `${Math.round(((s.value || 0) / demoTotal) * 100)}%` : ""}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* Pipeline & Revenue */}
      {fullmindData && (
        <div className="mb-6">
          <SectionLabel>Pipeline &amp; Revenue</SectionLabel>
          <div className="flex flex-col">
            <DataRow label="FY26 Open Pipeline" value={fullmindData.fy26OpenPipeline > 0 ? `$${fullmindData.fy26OpenPipeline.toLocaleString()}` : "—"} sub={fullmindData.fy26OpenPipelineOppCount > 0 ? `(${fullmindData.fy26OpenPipelineOppCount} opps)` : undefined} />
            <DataRow label="FY26 Closed Won" value={fullmindData.fy26ClosedWonNetBooking > 0 ? `$${fullmindData.fy26ClosedWonNetBooking.toLocaleString()}` : "—"} />
            <DataRow label="FY25 Net Invoicing" value={fullmindData.fy25NetInvoicing > 0 ? `$${fullmindData.fy25NetInvoicing.toLocaleString()}` : "—"} />
            {educationData?.medianHouseholdIncome != null && (
              <DataRow label="Median Household Income" value={`$${Number(educationData.medianHouseholdIncome).toLocaleString()}`} />
            )}
            {educationData?.childrenPovertyPercent != null && (
              <DataRow label="Children in Poverty" value={`${Number(educationData.childrenPovertyPercent).toFixed(1)}%`} last />
            )}
          </div>
        </div>
      )}

      {/* Key Contacts preview */}
      <ContactsPreview contacts={([] as Array<{ id: number; name: string; title: string | null; email: string | null }>).concat([] as never[])} />
    </>
  );
}

// ─── Tab: Financials ─────────────────────────────────────────────────
function FinancialsTab({
  fullmindData,
  educationData,
}: {
  fullmindData: FullmindData | null;
  educationData: DistrictEducationData | null;
}) {
  return (
    <>
      {fullmindData && (
        <div className="mb-6">
          <SectionLabel>Fullmind Revenue &amp; Pipeline</SectionLabel>
          <div className="flex flex-col">
            <DataRow label="FY26 Open Pipeline" value={fullmindData.fy26OpenPipeline > 0 ? `$${fullmindData.fy26OpenPipeline.toLocaleString()}` : "—"} sub={fullmindData.fy26OpenPipelineOppCount > 0 ? `(${fullmindData.fy26OpenPipelineOppCount} opps)` : undefined} />
            <DataRow label="FY26 Weighted Pipeline" value={fullmindData.fy26OpenPipelineWeighted > 0 ? `$${fullmindData.fy26OpenPipelineWeighted.toLocaleString()}` : "—"} />
            <DataRow label="FY26 Closed Won" value={fullmindData.fy26ClosedWonNetBooking > 0 ? `$${fullmindData.fy26ClosedWonNetBooking.toLocaleString()}` : "—"} />
            <DataRow label="FY26 Net Invoicing" value={fullmindData.fy26NetInvoicing > 0 ? `$${fullmindData.fy26NetInvoicing.toLocaleString()}` : "—"} />
            <DataRow label="FY27 Pipeline" value={fullmindData.fy27OpenPipeline > 0 ? `$${fullmindData.fy27OpenPipeline.toLocaleString()}` : "—"} />
            <DataRow label="FY26 Sessions" value={fullmindData.fy26SessionsCount > 0 ? `${fullmindData.fy26SessionsCount} ($${fullmindData.fy26SessionsRevenue.toLocaleString()})` : "—"} last />
          </div>
        </div>
      )}

      {educationData && (
        <div className="mb-6">
          <SectionLabel>District Finances{educationData.financeDataYear ? ` (${educationData.financeDataYear})` : ""}</SectionLabel>
          <div className="flex flex-col">
            {educationData.totalRevenue != null && <DataRow label="Total Revenue" value={`$${Number(educationData.totalRevenue).toLocaleString()}`} />}
            {educationData.totalExpenditure != null && <DataRow label="Total Expenditure" value={`$${Number(educationData.totalExpenditure).toLocaleString()}`} />}
            {educationData.expenditurePerPupil != null && <DataRow label="Per-Pupil Expenditure" value={`$${Number(educationData.expenditurePerPupil).toLocaleString()}`} />}
            {educationData.medianHouseholdIncome != null && <DataRow label="Median Household Income" value={`$${Number(educationData.medianHouseholdIncome).toLocaleString()}`} />}
            {educationData.childrenPovertyPercent != null && <DataRow label="Children in Poverty" value={`${Number(educationData.childrenPovertyPercent).toFixed(1)}%`} last />}
          </div>
        </div>
      )}
    </>
  );
}

// ─── Tab: Contacts ───────────────────────────────────────────────────
function ContactsTab({ contacts }: { contacts: Array<{ id: number; name: string; title: string | null; email: string | null; phone: string | null; isPrimary: boolean }> }) {
  if (contacts.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-sm text-[#A69DC0]">No contacts found for this district.</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-2">
      {contacts.map((c) => (
        <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E2DEEC] hover:bg-[#F7F5FA] transition-colors">
          <div className="w-9 h-9 rounded-full bg-[#C4E7E6] flex items-center justify-center text-xs font-bold text-[#403770] shrink-0">
            {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-sm font-semibold text-[#544A78]">{c.name}</span>
              {c.isPrimary && (
                <span className="px-1.5 py-0.5 rounded text-[10px] font-bold uppercase bg-[#C4E7E6]/40 text-[#403770]">Primary</span>
              )}
            </div>
            {c.title && <div className="text-[11px] text-[#8A80A8] truncate">{c.title}</div>}
            {c.email && <div className="text-[11px] text-[#6EA3BE] font-medium truncate">{c.email}</div>}
          </div>
        </div>
      ))}
    </div>
  );
}

// ─── Tab: Schools ────────────────────────────────────────────────────
function SchoolsTab({ district }: { district: { numberOfSchools: number | null; name: string } | undefined }) {
  return (
    <div className="text-center py-12">
      <p className="text-sm text-[#8A80A8]">
        {district?.numberOfSchools != null
          ? `${district.numberOfSchools} schools in this district.`
          : "School data unavailable."}
      </p>
      <p className="text-xs text-[#A69DC0] mt-1">Open full detail to view individual schools.</p>
    </div>
  );
}

// ─── Shared atoms ────────────────────────────────────────────────────
function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-[10px] font-semibold uppercase tracking-wider text-[#A69DC0] mb-2.5">
      {children}
    </h3>
  );
}

function DataRow({ label, value, sub, last }: { label: string; value: string; sub?: string; last?: boolean }) {
  return (
    <div className={`flex justify-between items-center py-2.5 ${last ? "" : "border-b border-[#E2DEEC]"}`}>
      <span className="text-sm text-[#6E6390] font-medium">{label}</span>
      <span className="text-sm font-semibold text-[#403770]">
        {value}
        {sub && <span className="text-[11px] text-[#8A80A8] font-normal ml-1">{sub}</span>}
      </span>
    </div>
  );
}

function ContactsPreview({ contacts }: { contacts: Array<{ id: number; name: string; title: string | null; email: string | null }> }) {
  if (contacts.length === 0) return null;
  return (
    <div>
      <SectionLabel>Key Contacts</SectionLabel>
      <div className="flex flex-col gap-2">
        {contacts.slice(0, 3).map((c) => (
          <div key={c.id} className="flex items-center gap-3 p-3 rounded-lg border border-[#E2DEEC]">
            <div className="w-9 h-9 rounded-full bg-[#C4E7E6] flex items-center justify-center text-xs font-bold text-[#403770] shrink-0">
              {c.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase()}
            </div>
            <div className="flex-1 min-w-0">
              <div className="text-sm font-semibold text-[#544A78]">{c.name}</div>
              {c.title && <div className="text-[11px] text-[#8A80A8] truncate">{c.title}</div>}
              {c.email && <div className="text-[11px] text-[#6EA3BE] font-medium truncate">{c.email}</div>}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── Skeletons ───────────────────────────────────────────────────────
function SidebarSkeleton() {
  return (
    <div className="p-5 space-y-4">
      <div className="h-4 w-16 bg-white/10 rounded-full animate-pulse" />
      <div className="h-5 w-3/4 bg-white/10 rounded animate-pulse" />
      <div className="h-3 w-1/2 bg-white/10 rounded animate-pulse" />
      <div className="h-px bg-white/10 my-4" />
      {[0, 1, 2, 3, 4].map((i) => (
        <div key={i} className="flex justify-between">
          <div className="h-3 w-16 bg-white/10 rounded animate-pulse" />
          <div className="h-3 w-12 bg-white/10 rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}

function ContentSkeleton() {
  return (
    <div className="space-y-6">
      <div className="h-3 w-24 bg-[#EFEDF5] rounded animate-pulse" />
      <div className="h-2.5 w-full bg-[#EFEDF5] rounded-full animate-pulse" />
      <div className="flex gap-3">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="h-3 w-16 bg-[#EFEDF5] rounded animate-pulse" />
        ))}
      </div>
      <div className="h-3 w-24 bg-[#EFEDF5] rounded animate-pulse mt-4" />
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="flex justify-between py-2">
          <div className="h-3 w-32 bg-[#EFEDF5] rounded animate-pulse" />
          <div className="h-3 w-16 bg-[#EFEDF5] rounded animate-pulse" />
        </div>
      ))}
    </div>
  );
}
