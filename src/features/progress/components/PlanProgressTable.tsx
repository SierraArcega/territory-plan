"use client";

import { useState } from "react";
import type { PlanProgress, DistrictProgress, OpportunityItem, UnmappedDistrict } from "../lib/types";

interface PlanProgressTableProps {
  plans: PlanProgress[];
  unmapped: {
    totalRevenue: number;
    districtCount: number;
    districts: UnmappedDistrict[];
  };
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatCompact(value: number): string {
  if (value === 0) return "$0";
  const abs = Math.abs(value);
  const sign = value < 0 ? "-" : "";
  if (abs >= 1_000_000) {
    const m = abs / 1_000_000;
    return `${sign}$${m % 1 === 0 ? m.toFixed(0) : m.toFixed(1)}M`;
  }
  if (abs >= 1_000) {
    const k = abs / 1_000;
    return `${sign}$${k % 1 === 0 ? k.toFixed(0) : k.toFixed(1)}k`;
  }
  return `${sign}$${abs.toFixed(0)}`;
}

const CATEGORY_COLORS = {
  renewal: "#403770",
  expansion: "#6EA3BE",
  winback: "#F37167",
  newBusiness: "#8AA891",
} as const;

type CategoryKey = keyof typeof CATEGORY_COLORS;

const CATEGORY_KEYS: CategoryKey[] = ["renewal", "expansion", "winback", "newBusiness"];
const CATEGORY_HEADERS = ["Renewal", "Expansion", "Winback", "New Biz"];

// ---------------------------------------------------------------------------
// Tiny sub-components
// ---------------------------------------------------------------------------

function ChevronIcon({ expanded }: { expanded: boolean }) {
  return (
    <svg
      className={`w-4 h-4 text-gray-400 transition-transform duration-150 ${expanded ? "rotate-90" : ""}`}
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
    </svg>
  );
}

function InlineProgressBar({
  actual,
  target,
  color,
}: {
  actual: number;
  target: number;
  color: string;
}) {
  const pct = target > 0 ? Math.min((actual / target) * 100, 100) : 0;
  return (
    <div className="flex items-center gap-1.5">
      <span className="text-[13px] tabular-nums text-gray-700">
        {formatCompact(actual)}
      </span>
      <span className="text-[11px] text-gray-400">/</span>
      <span className="text-[11px] tabular-nums text-gray-400">
        {formatCompact(target)}
      </span>
      <div className="w-[60px] h-1 rounded-full bg-gray-200 overflow-hidden flex-shrink-0">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${pct}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

function OwnerCell({ owner }: { owner: PlanProgress["owner"] }) {
  if (!owner) {
    return <span className="text-[13px] text-gray-400 italic">Unassigned</span>;
  }
  return (
    <div className="flex items-center gap-2">
      {owner.avatarUrl ? (
        <img
          src={owner.avatarUrl}
          alt={owner.fullName}
          className="w-6 h-6 rounded-full object-cover"
        />
      ) : (
        <div className="w-6 h-6 rounded-full bg-[#403770] flex items-center justify-center text-[10px] font-semibold text-white">
          {owner.fullName
            .split(" ")
            .map((w) => w[0])
            .join("")
            .slice(0, 2)
            .toUpperCase()}
        </div>
      )}
      <span className="text-[13px] text-gray-700 truncate max-w-[120px]">
        {owner.fullName}
      </span>
    </div>
  );
}

function StageBadge({ stage }: { stage: string }) {
  // Derive a color based on common stage names
  let bg = "bg-gray-100";
  let text = "text-gray-600";
  const lower = stage.toLowerCase();
  if (lower.includes("closed") && lower.includes("won")) {
    bg = "bg-green-100";
    text = "text-green-700";
  } else if (lower.includes("closed") && lower.includes("lost")) {
    bg = "bg-red-100";
    text = "text-red-700";
  } else if (lower.includes("negotiat") || lower.includes("proposal")) {
    bg = "bg-amber-100";
    text = "text-amber-700";
  } else if (lower.includes("qualif") || lower.includes("discovery")) {
    bg = "bg-blue-100";
    text = "text-blue-700";
  } else if (lower.includes("prospect")) {
    bg = "bg-purple-100";
    text = "text-purple-700";
  }
  return (
    <span className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full ${bg} ${text}`}>
      {stage}
    </span>
  );
}

function WarningIcon() {
  return (
    <svg
      className="w-4 h-4 text-amber-500 flex-shrink-0"
      fill="none"
      stroke="currentColor"
      viewBox="0 0 24 24"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        strokeWidth={2}
        d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4.5c-.77-.833-2.694-.833-3.464 0L3.34 16.5c-.77.833.192 2.5 1.732 2.5z"
      />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Opportunity row
// ---------------------------------------------------------------------------

function OpportunityRow({ opp }: { opp: OpportunityItem }) {
  return (
    <tr className="border-b border-gray-50 last:border-b-0">
      <td className="pl-16 pr-4 py-2">
        <a
          href={`https://lms.fullmindlearning.com/opportunities/${opp.id}`}
          target="_blank"
          rel="noopener noreferrer"
          className="text-[12px] text-[#6EA3BE] hover:text-[#403770] hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          {opp.name}
          <svg className="inline-block w-3 h-3 ml-1 -mt-0.5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 6H6a2 2 0 00-2 2v10a2 2 0 002 2h10a2 2 0 002-2v-4M14 4h6m0 0v6m0-6L10 14" />
          </svg>
        </a>
      </td>
      <td className="px-3 py-2">
        <StageBadge stage={opp.stage} />
      </td>
      {/* Span across the four category columns */}
      <td colSpan={4} />
      <td className="px-3 py-2 text-right">
        <div className="flex items-center justify-end gap-3">
          <span className="text-[12px] tabular-nums text-gray-500">
            Rev {formatCompact(opp.totalRevenue)}
          </span>
          <span className="text-[12px] tabular-nums text-gray-400">
            Take {formatCompact(opp.totalTake)}
          </span>
        </div>
      </td>
    </tr>
  );
}

// ---------------------------------------------------------------------------
// District row (nested under a plan)
// ---------------------------------------------------------------------------

function DistrictRows({
  district,
  expandedDistricts,
  toggleDistrict,
}: {
  district: DistrictProgress;
  expandedDistricts: Set<string>;
  toggleDistrict: (leaid: string) => void;
}) {
  const isExpanded = expandedDistricts.has(district.leaid);
  const hasOpps = district.opportunities.length > 0;

  const actuals: Record<CategoryKey, number> = {
    renewal: district.renewalActual,
    expansion: district.expansionActual,
    winback: district.winbackActual,
    newBusiness: district.newBusinessActual,
  };
  const targets: Record<CategoryKey, number> = {
    renewal: district.renewalTarget,
    expansion: district.expansionTarget,
    winback: district.winbackTarget,
    newBusiness: district.newBusinessTarget,
  };
  const totalActual = actuals.renewal + actuals.expansion + actuals.winback + actuals.newBusiness;
  const totalTarget = targets.renewal + targets.expansion + targets.winback + targets.newBusiness;

  return (
    <>
      <tr
        className={`border-b border-gray-100 bg-gray-50/40 transition-colors hover:bg-gray-100/60 ${hasOpps ? "cursor-pointer" : ""}`}
        onClick={() => hasOpps && toggleDistrict(district.leaid)}
      >
        <td className="pl-10 pr-4 py-2.5">
          <div className="flex items-center gap-2">
            {hasOpps && <ChevronIcon expanded={isExpanded} />}
            {!hasOpps && <div className="w-4" />}
            <span className="text-[13px] font-medium text-[#403770]">
              {district.name}
            </span>
            {district.stateAbbrev && (
              <span className="text-[11px] text-gray-400 font-medium">
                {district.stateAbbrev}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5" />
        {CATEGORY_KEYS.map((key) => (
          <td key={key} className="px-3 py-2.5 text-right">
            <div className="flex items-center justify-end">
              <InlineProgressBar
                actual={actuals[key]}
                target={targets[key]}
                color={CATEGORY_COLORS[key]}
              />
            </div>
          </td>
        ))}
        <td className="px-3 py-2.5 text-right">
          <span className="text-[13px] font-medium tabular-nums text-gray-700">
            {formatCompact(totalActual)}
          </span>
          <span className="text-[11px] text-gray-400 ml-1">
            / {formatCompact(totalTarget)}
          </span>
        </td>
      </tr>
      {isExpanded &&
        district.opportunities.map((opp) => (
          <OpportunityRow key={opp.id} opp={opp} />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Plan row (top level)
// ---------------------------------------------------------------------------

function PlanRows({
  plan,
  expandedPlans,
  expandedDistricts,
  togglePlan,
  toggleDistrict,
}: {
  plan: PlanProgress;
  expandedPlans: Set<string>;
  expandedDistricts: Set<string>;
  togglePlan: (id: string) => void;
  toggleDistrict: (leaid: string) => void;
}) {
  const isExpanded = expandedPlans.has(plan.id);

  const categories: Record<CategoryKey, { actual: number; target: number }> = {
    renewal: plan.renewal,
    expansion: plan.expansion,
    winback: plan.winback,
    newBusiness: plan.newBusiness,
  };

  return (
    <>
      <tr
        className="border-b border-gray-200 bg-white hover:bg-gray-50/50 cursor-pointer transition-colors"
        onClick={() => togglePlan(plan.id)}
      >
        <td className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <ChevronIcon expanded={isExpanded} />
            <span
              className="w-2.5 h-2.5 rounded-full flex-shrink-0"
              style={{ backgroundColor: plan.color }}
            />
            <span className="text-sm font-semibold text-[#403770]">
              {plan.name}
            </span>
            <span className="text-[11px] text-gray-400 ml-1">
              {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
            </span>
          </div>
        </td>
        <td className="px-3 py-3">
          <OwnerCell owner={plan.owner} />
        </td>
        {CATEGORY_KEYS.map((key) => (
          <td key={key} className="px-3 py-3 text-right">
            <div className="flex items-center justify-end">
              <InlineProgressBar
                actual={categories[key].actual}
                target={categories[key].target}
                color={CATEGORY_COLORS[key]}
              />
            </div>
          </td>
        ))}
        <td className="px-3 py-3 text-right">
          <span className="text-sm font-semibold tabular-nums text-gray-800">
            {formatCompact(plan.total.actual)}
          </span>
          <span className="text-[11px] text-gray-400 ml-1">
            / {formatCompact(plan.total.target)}
          </span>
        </td>
      </tr>
      {isExpanded &&
        plan.districts.map((district) => (
          <DistrictRows
            key={district.leaid}
            district={district}
            expandedDistricts={expandedDistricts}
            toggleDistrict={toggleDistrict}
          />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Unmapped district row
// ---------------------------------------------------------------------------

function UnmappedDistrictRows({
  district,
  expandedDistricts,
  toggleDistrict,
}: {
  district: UnmappedDistrict;
  expandedDistricts: Set<string>;
  toggleDistrict: (leaid: string) => void;
}) {
  const isExpanded = expandedDistricts.has(district.leaid);
  const hasOpps = district.opportunities.length > 0;

  return (
    <>
      <tr
        className={`border-b border-gray-100 bg-amber-50/30 hover:bg-amber-50/60 transition-colors ${hasOpps ? "cursor-pointer" : ""}`}
        onClick={() => hasOpps && toggleDistrict(district.leaid)}
      >
        <td className="pl-10 pr-4 py-2.5">
          <div className="flex items-center gap-2">
            {hasOpps && <ChevronIcon expanded={isExpanded} />}
            {!hasOpps && <div className="w-4" />}
            <span className="text-[13px] font-medium text-gray-700">
              {district.name}
            </span>
            {district.stateAbbrev && (
              <span className="text-[11px] text-gray-400 font-medium">
                {district.stateAbbrev}
              </span>
            )}
          </div>
        </td>
        <td className="px-3 py-2.5" />
        <td colSpan={4} className="px-3 py-2.5 text-center">
          <span className="text-[11px] text-gray-400 italic">Not in any plan</span>
        </td>
        <td className="px-3 py-2.5 text-right">
          <span className="text-[13px] tabular-nums text-gray-600">
            {formatCompact(district.currentRevenue)}
          </span>
        </td>
      </tr>
      {isExpanded &&
        district.opportunities.map((opp) => (
          <OpportunityRow key={opp.id} opp={opp} />
        ))}
    </>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------

export default function PlanProgressTable({ plans, unmapped }: PlanProgressTableProps) {
  const [expandedPlans, setExpandedPlans] = useState<Set<string>>(new Set());
  const [expandedDistricts, setExpandedDistricts] = useState<Set<string>>(new Set());
  const [unmappedExpanded, setUnmappedExpanded] = useState(false);

  const togglePlan = (id: string) => {
    setExpandedPlans((prev) => {
      const next = new Set(prev);
      if (next.has(id)) {
        next.delete(id);
      } else {
        next.add(id);
      }
      return next;
    });
  };

  const toggleDistrict = (leaid: string) => {
    setExpandedDistricts((prev) => {
      const next = new Set(prev);
      if (next.has(leaid)) {
        next.delete(leaid);
      } else {
        next.add(leaid);
      }
      return next;
    });
  };

  return (
    <div className="overflow-hidden border border-gray-200 rounded-lg bg-white shadow-sm">
      <div className="overflow-x-auto">
        <table className="min-w-full">
          {/* ---- Header ---- */}
          <thead>
            <tr className="border-b border-gray-200 bg-gray-50/80">
              <th className="px-4 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider min-w-[240px]">
                Plan / District / Opp
              </th>
              <th className="px-3 py-3 text-left text-[11px] font-semibold text-gray-500 uppercase tracking-wider min-w-[140px]">
                Owner
              </th>
              {CATEGORY_HEADERS.map((label, i) => (
                <th
                  key={label}
                  className="px-3 py-3 text-right text-[11px] font-semibold uppercase tracking-wider min-w-[160px]"
                  style={{ color: CATEGORY_COLORS[CATEGORY_KEYS[i]] }}
                >
                  {label}
                </th>
              ))}
              <th className="px-3 py-3 text-right text-[11px] font-semibold text-gray-500 uppercase tracking-wider min-w-[120px]">
                Total
              </th>
            </tr>
          </thead>

          {/* ---- Plan rows ---- */}
          <tbody>
            {plans.map((plan) => (
              <PlanRows
                key={plan.id}
                plan={plan}
                expandedPlans={expandedPlans}
                expandedDistricts={expandedDistricts}
                togglePlan={togglePlan}
                toggleDistrict={toggleDistrict}
              />
            ))}
          </tbody>

          {/* ---- Unmapped section ---- */}
          {unmapped.districtCount > 0 && (
            <tbody>
              {/* Dashed separator */}
              <tr>
                <td colSpan={7} className="px-4 py-0">
                  <div className="border-t-2 border-dashed border-gray-200" />
                </td>
              </tr>

              {/* Unmapped header row */}
              <tr
                className="bg-amber-50/50 hover:bg-amber-50/80 cursor-pointer transition-colors border-b border-gray-200"
                onClick={() => setUnmappedExpanded((v) => !v)}
              >
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5">
                    <ChevronIcon expanded={unmappedExpanded} />
                    <WarningIcon />
                    <span className="text-sm font-semibold text-amber-700">
                      Unmapped Opportunities
                    </span>
                    <span className="text-[11px] text-amber-500 ml-1">
                      {unmapped.districtCount} district{unmapped.districtCount !== 1 ? "s" : ""}
                    </span>
                  </div>
                </td>
                <td className="px-3 py-3" />
                <td colSpan={4} className="px-3 py-3 text-center">
                  <span className="text-[12px] text-amber-600 font-medium">
                    Revenue not assigned to any territory plan
                  </span>
                </td>
                <td className="px-3 py-3 text-right">
                  <span className="text-sm font-semibold tabular-nums text-amber-700">
                    {formatCompact(unmapped.totalRevenue)}
                  </span>
                </td>
              </tr>

              {unmappedExpanded &&
                unmapped.districts.map((district) => (
                  <UnmappedDistrictRows
                    key={district.leaid}
                    district={district}
                    expandedDistricts={expandedDistricts}
                    toggleDistrict={toggleDistrict}
                  />
                ))}
            </tbody>
          )}
        </table>
      </div>

      {/* ---- Footer summary ---- */}
      <div className="px-4 py-2.5 border-t border-gray-100 bg-gray-50/60 flex items-center justify-between">
        <span className="text-[12px] font-medium text-gray-400 tracking-wide">
          {plans.length} plan{plans.length !== 1 ? "s" : ""}
        </span>
        <div className="flex gap-4 text-[12px] text-gray-400">
          {CATEGORY_KEYS.map((key, i) => {
            const totalActual = plans.reduce((s, p) => s + p[key].actual, 0);
            const totalTarget = plans.reduce((s, p) => s + p[key].target, 0);
            return (
              <span key={key}>
                <span style={{ color: CATEGORY_COLORS[key] }} className="font-medium">
                  {CATEGORY_HEADERS[i]}:
                </span>{" "}
                <span className="font-medium text-gray-500">
                  {formatCompact(totalActual)}
                </span>
                <span className="text-gray-300"> / </span>
                <span className="text-gray-400">{formatCompact(totalTarget)}</span>
              </span>
            );
          })}
        </div>
      </div>
    </div>
  );
}
