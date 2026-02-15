"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useDistrictDetail } from "@/lib/api";

function formatCurrency(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toLocaleString()}`;
}

function formatNumber(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString();
}

const CATEGORY_BADGE: Record<string, { bg: string; text: string; label: string }> = {
  multi_year: { bg: "bg-[#403770]/10", text: "text-[#403770]", label: "Multi-year Customer" },
  new: { bg: "bg-green-100", text: "text-green-700", label: "New Customer" },
  lapsed: { bg: "bg-[#F37167]/15", text: "text-[#c25a52]", label: "Lapsed" },
  pipeline: { bg: "bg-amber-100", text: "text-amber-700", label: "Pipeline" },
  target: { bg: "bg-[#6EA3BE]/15", text: "text-[#4d7285]", label: "Target" },
};

export default function DistrictDetailPanel() {
  const selectedLeaid = useMapV2Store((s) => s.selectedLeaid);
  const goBack = useMapV2Store((s) => s.goBack);
  const startNewPlan = useMapV2Store((s) => s.startNewPlan);
  const [expandedSections, setExpandedSections] = useState<Set<string>>(new Set());

  const { data, isLoading } = useDistrictDetail(selectedLeaid);

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => {
      const next = new Set(prev);
      if (next.has(section)) next.delete(section);
      else next.add(section);
      return next;
    });
  };

  const district = data?.district;
  const fullmind = data?.fullmindData;
  const edu = data?.educationData;
  const contacts = data?.contacts || [];

  // Determine customer category from fullmind data
  const category = fullmind?.isCustomer
    ? "multi_year"
    : fullmind?.hasOpenPipeline
      ? "pipeline"
      : null;
  const badge = category ? CATEGORY_BADGE[category] : null;

  return (
    <div className="flex flex-col h-full">
      {/* Back button */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-gray-100">
        <button
          onClick={goBack}
          className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors"
          aria-label="Go back"
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L5 7L9 11" stroke="#6B7280" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
        <span className="text-xs font-medium text-gray-400 uppercase tracking-wider">
          District
        </span>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto p-3 space-y-3">
        {isLoading ? (
          <LoadingSkeleton />
        ) : district ? (
          <>
            {/* Name & state */}
            <div>
              <h2 className="text-base font-bold text-gray-800 leading-tight">
                {district.name}
              </h2>
              <div className="flex items-center gap-2 mt-1">
                <span className="text-xs text-gray-400">
                  {district.stateAbbrev}
                  {district.countyName ? ` · ${district.countyName}` : ""}
                </span>
              </div>
            </div>

            {/* Status badge */}
            {badge && (
              <span className={`inline-block px-2.5 py-1 text-xs font-medium rounded-full ${badge.bg} ${badge.text}`}>
                {badge.label}
              </span>
            )}

            {/* Key metrics grid */}
            <div className="grid grid-cols-2 gap-2">
              <MetricCard label="Enrollment" value={formatNumber(district.enrollment)} />
              <MetricCard label="Schools" value={formatNumber(district.numberOfSchools)} />
              {fullmind && fullmind.fy26NetInvoicing > 0 && (
                <MetricCard label="FY26 Revenue" value={formatCurrency(fullmind.fy26NetInvoicing)} accent />
              )}
              {fullmind && fullmind.fy26OpenPipeline > 0 && (
                <MetricCard label="Pipeline" value={formatCurrency(fullmind.fy26OpenPipeline)} />
              )}
              {fullmind && fullmind.fy26SessionsRevenue > 0 && (
                <MetricCard label="Sessions Rev" value={formatCurrency(fullmind.fy26SessionsRevenue)} />
              )}
              {fullmind && fullmind.salesExecutive && (
                <MetricCard label="Owner" value={fullmind.salesExecutive} />
              )}
            </div>

            {/* Add to plan button */}
            <button
              onClick={startNewPlan}
              className="w-full py-2.5 bg-plum text-white text-sm font-medium rounded-xl hover:bg-plum/90 transition-all hover:shadow-md active:scale-[0.98]"
            >
              + Add to Plan
            </button>

            {/* Expandable sections */}
            <ExpandableSection
              title="Financials"
              expanded={expandedSections.has("financials")}
              onToggle={() => toggleSection("financials")}
            >
              {edu ? (
                <div className="space-y-2 text-sm">
                  <MetricRow label="Per-pupil Spending" value={edu.expenditurePerPupil ? formatCurrency(edu.expenditurePerPupil) : "—"} />
                  <MetricRow label="Total Revenue" value={edu.totalRevenue ? formatCurrency(edu.totalRevenue) : "—"} />
                  <MetricRow label="Federal Revenue" value={edu.federalRevenue ? formatCurrency(edu.federalRevenue) : "—"} />
                  <MetricRow label="State Revenue" value={edu.stateRevenue ? formatCurrency(edu.stateRevenue) : "—"} />
                  <MetricRow label="Local Revenue" value={edu.localRevenue ? formatCurrency(edu.localRevenue) : "—"} />
                </div>
              ) : (
                <p className="text-xs text-gray-400">No financial data available</p>
              )}
            </ExpandableSection>

            <ExpandableSection
              title="Demographics"
              expanded={expandedSections.has("demographics")}
              onToggle={() => toggleSection("demographics")}
            >
              <div className="space-y-2 text-sm">
                <MetricRow label="Total Enrollment" value={formatNumber(district.enrollment)} />
                <MetricRow label="Special Ed" value={formatNumber(district.specEdStudents)} />
                <MetricRow label="ELL Students" value={formatNumber(district.ellStudents)} />
                {edu?.childrenPovertyPercent != null && (
                  <MetricRow label="Child Poverty Rate" value={`${edu.childrenPovertyPercent.toFixed(1)}%`} />
                )}
                {edu?.graduationRateTotal != null && (
                  <MetricRow label="Graduation Rate" value={`${edu.graduationRateTotal.toFixed(1)}%`} />
                )}
              </div>
            </ExpandableSection>

            <ExpandableSection
              title="Staffing"
              expanded={expandedSections.has("staffing")}
              onToggle={() => toggleSection("staffing")}
            >
              {edu ? (
                <div className="space-y-2 text-sm">
                  <MetricRow label="Total Staff FTE" value={formatNumber(edu.staffTotalFte)} />
                  <MetricRow label="Teachers FTE" value={formatNumber(edu.teachersFte)} />
                  <MetricRow label="Admin FTE" value={formatNumber(edu.adminFte)} />
                  <MetricRow label="Counselors FTE" value={formatNumber(edu.guidanceCounselorsFte)} />
                  {edu.salariesTeachersRegular != null && (
                    <MetricRow label="Avg Teacher Salary" value={formatCurrency(edu.salariesTeachersRegular)} />
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No staffing data available</p>
              )}
            </ExpandableSection>

            <ExpandableSection
              title={`Contacts (${contacts.length})`}
              expanded={expandedSections.has("contacts")}
              onToggle={() => toggleSection("contacts")}
            >
              {contacts.length > 0 ? (
                <div className="space-y-2">
                  {contacts.slice(0, 5).map((contact) => (
                    <div key={contact.id} className="bg-white rounded-lg p-2 border border-gray-100">
                      <div className="flex items-center gap-1.5">
                        <span className="text-sm font-medium text-gray-700">{contact.name}</span>
                        {contact.isPrimary && (
                          <span className="text-[10px] font-medium text-plum bg-plum/10 px-1.5 py-0.5 rounded-full">
                            Primary
                          </span>
                        )}
                      </div>
                      {contact.title && (
                        <div className="text-xs text-gray-500 mt-0.5">{contact.title}</div>
                      )}
                      {contact.email && (
                        <a href={`mailto:${contact.email}`} className="text-xs text-steel-blue hover:underline mt-0.5 block truncate">
                          {contact.email}
                        </a>
                      )}
                    </div>
                  ))}
                  {contacts.length > 5 && (
                    <p className="text-xs text-gray-400 text-center">
                      +{contacts.length - 5} more
                    </p>
                  )}
                </div>
              ) : (
                <p className="text-xs text-gray-400">No contacts found</p>
              )}
            </ExpandableSection>

            <p className="text-[10px] text-gray-300 text-center pt-1">
              LEAID: {selectedLeaid}
            </p>
          </>
        ) : (
          <div className="text-center py-8 text-sm text-gray-400">
            District not found
          </div>
        )}
      </div>
    </div>
  );
}

// --- Subcomponents ---

function MetricCard({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div className="rounded-xl bg-gray-50 p-2.5">
      <div className="text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-0.5">
        {label}
      </div>
      <div className={`text-sm font-semibold ${accent ? "text-plum" : "text-gray-700"}`}>
        {value}
      </div>
    </div>
  );
}

function MetricRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between items-center">
      <span className="text-gray-500">{label}</span>
      <span className="font-medium text-gray-700">{value}</span>
    </div>
  );
}

function ExpandableSection({
  title,
  expanded,
  onToggle,
  children,
}: {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div className="border border-gray-100 rounded-xl overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-3 py-2.5 hover:bg-gray-50 transition-colors"
      >
        <span className="text-sm font-medium text-gray-600">{title}</span>
        <svg
          width="12"
          height="12"
          viewBox="0 0 12 12"
          fill="none"
          className={`text-gray-400 transition-transform duration-200 ${expanded ? "rotate-180" : ""}`}
        >
          <path d="M3 4.5L6 7.5L9 4.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {expanded && (
        <div className="px-3 pb-3 pt-0">
          {children}
        </div>
      )}
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div>
        <div className="h-5 bg-gray-200 rounded w-4/5 mb-1 animate-pulse" />
        <div className="h-3 bg-gray-100 rounded w-1/3 animate-pulse" />
      </div>
      <div className="h-6 bg-plum/10 rounded-full w-28 animate-pulse" />
      <div className="grid grid-cols-2 gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl bg-gray-50 p-3 animate-pulse">
            <div className="h-2.5 bg-gray-200 rounded w-2/3 mb-2" />
            <div className="h-4 bg-gray-200 rounded w-1/2" />
          </div>
        ))}
      </div>
    </div>
  );
}
