"use client";

import { useState, useRef, useEffect } from "react";
import { useUpdateTerritoryPlan, useUsers, useStates } from "@/lib/api";
import type { TerritoryPlanDetail } from "@/features/shared/types/api-types";

const STATUS_OPTIONS: { value: string; label: string; dot: string }[] = [
  { value: "planning", label: "Planning", dot: "bg-[#A69DC0]" },
  { value: "working", label: "Working", dot: "bg-[#8AA891]" },
  { value: "stale", label: "Stale", dot: "bg-[#D4A843]" },
  { value: "archived", label: "Archived", dot: "bg-[#A69DC0]" },
];

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  planning: { bg: "bg-[#f0edf5]", text: "text-[#6E6390]" },
  working: { bg: "bg-[#EFF5F0]", text: "text-[#5a7a61]" },
  stale: { bg: "bg-[#FEF3C7]", text: "text-[#92700C]" },
  archived: { bg: "bg-[#f0edf5]", text: "text-[#8A80A8]" },
};

function formatCurrency(value: number | null | undefined): string {
  if (value == null || value === 0) return "$0";
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(1)}K`;
  return `$${value.toLocaleString()}`;
}

function formatDate(dateString: string | null): string {
  if (!dateString) return "—";
  return new Date(dateString + "T00:00:00").toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

interface PlanDetailSidebarProps {
  plan: TerritoryPlanDetail;
}

export default function PlanDetailSidebar({ plan }: PlanDetailSidebarProps) {
  const [isEditing, setIsEditing] = useState(false);

  const statusBadge = STATUS_BADGE[plan.status] ?? STATUS_BADGE.planning;

  // Compute totals from districts
  const totalTarget =
    (plan.renewalRollup || 0) +
    (plan.expansionRollup || 0) +
    (plan.winbackRollup || 0) +
    (plan.newBusinessRollup || 0);

  const totalActual = plan.districts.reduce((sum, d) => {
    return sum + (d.actuals?.totalRevenue ?? 0);
  }, 0);

  const totalPipeline = plan.districts.reduce((sum, d) => {
    return sum + (d.actuals?.openPipeline ?? 0);
  }, 0);

  return (
    <div className="w-[260px] shrink-0 flex flex-col overflow-hidden" style={{ background: "linear-gradient(180deg, #F7F5FA 0%, #EFEDF5 100%)" }}>
      {/* Header */}
      <div className="px-5 pt-5 pb-4 border-b border-[#E2DEEC]">
        <div className="flex items-start justify-between gap-2 mb-2.5">
          <div className="flex items-center gap-2.5 min-w-0">
            <span
              className="w-3.5 h-3.5 rounded-full shrink-0"
              style={{ backgroundColor: plan.color || "#403770" }}
            />
            <h2 className="text-base font-bold text-[#403770] truncate">
              {plan.name}
            </h2>
          </div>
          <button
            onClick={() => setIsEditing(!isEditing)}
            className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors ${
              isEditing
                ? "bg-[#403770] text-white"
                : "hover:bg-[#f0edf5] text-[#8A80A8]"
            }`}
            aria-label={isEditing ? "Close edit mode" : "Edit plan"}
          >
            <svg width="13" height="13" viewBox="0 0 13 13" fill="none">
              <path
                d="M9.5 1.5L11.5 3.5L4 11H2V9L9.5 1.5Z"
                stroke="currentColor"
                strokeWidth="1.3"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </div>

        {/* Badges */}
        <div className="flex items-center gap-2">
          <span className="px-2 py-0.5 text-[10px] font-bold rounded-full bg-[#403770] text-white">
            FY{String(plan.fiscalYear).slice(-2)}
          </span>
          <span
            className={`px-2 py-0.5 text-[10px] font-bold rounded-full capitalize ${statusBadge.bg} ${statusBadge.text}`}
          >
            {plan.status}
          </span>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="flex-1 overflow-y-auto px-5 py-4">
        {isEditing ? (
          <EditMode plan={plan} />
        ) : (
          <ReadMode
            plan={plan}
            totalTarget={totalTarget}
            totalActual={totalActual}
            totalPipeline={totalPipeline}
          />
        )}
      </div>
    </div>
  );
}

function ReadMode({
  plan,
  totalTarget,
  totalActual,
  totalPipeline,
}: {
  plan: TerritoryPlanDetail;
  totalTarget: number;
  totalActual: number;
  totalPipeline: number;
}) {
  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="space-y-2.5">
        <SectionLabel>Overview</SectionLabel>
        <StatRow label="Districts" value={`${plan.districts.length}`} />
        <StatRow label="States" value={`${plan.stateCount}`} />
        <StatRow
          label="Enrollment"
          value={plan.totalEnrollment?.toLocaleString() ?? "—"}
        />
      </div>

      {/* Targets */}
      <div className="space-y-2.5">
        <SectionLabel>Targets</SectionLabel>
        <StatRow label="Total Target" value={formatCurrency(totalTarget)} highlight />
        <StatRow label="Renewal" value={formatCurrency(plan.renewalRollup)} />
        <StatRow label="Expansion" value={formatCurrency(plan.expansionRollup)} />
        <StatRow label="Winback" value={formatCurrency(plan.winbackRollup)} />
        <StatRow label="New Business" value={formatCurrency(plan.newBusinessRollup)} />
      </div>

      {/* Actuals */}
      <div className="space-y-2.5">
        <SectionLabel>Actuals</SectionLabel>
        <StatRow label="Revenue" value={formatCurrency(totalActual)} highlight />
        <StatRow label="Pipeline" value={formatCurrency(totalPipeline)} />
      </div>

      {/* Owner */}
      {plan.owner?.fullName && (
        <div className="space-y-2.5">
          <SectionLabel>Owner</SectionLabel>
          <p className="text-sm text-[#544A78] font-medium">{plan.owner.fullName}</p>
        </div>
      )}

      {/* Dates */}
      {(plan.startDate || plan.endDate) && (
        <div className="space-y-2.5">
          <SectionLabel>Date Range</SectionLabel>
          <p className="text-xs text-[#6E6390]">
            {formatDate(plan.startDate)} — {formatDate(plan.endDate)}
          </p>
        </div>
      )}

      {/* Description */}
      {plan.description && (
        <div className="space-y-2.5">
          <SectionLabel>Description</SectionLabel>
          <p className="text-xs text-[#6E6390] leading-relaxed">{plan.description}</p>
        </div>
      )}

      {/* Tasks */}
      {plan.taskCount > 0 && (
        <div className="space-y-2.5">
          <SectionLabel>Tasks</SectionLabel>
          <div className="flex items-center gap-2">
            <div className="flex-1 h-1.5 bg-[#f0edf5] rounded-full overflow-hidden">
              <div
                className="h-full rounded-full bg-[#403770]/60 transition-all"
                style={{
                  width: `${Math.round((plan.completedTaskCount / plan.taskCount) * 100)}%`,
                }}
              />
            </div>
            <span className="text-[10px] text-[#8A80A8] tabular-nums shrink-0">
              {plan.completedTaskCount}/{plan.taskCount}
            </span>
          </div>
        </div>
      )}
    </div>
  );
}

function EditMode({ plan }: { plan: TerritoryPlanDetail }) {
  const updatePlan = useUpdateTerritoryPlan();
  const { data: users } = useUsers();
  const { data: allStates } = useStates();

  const save = (field: string, value: unknown) => {
    updatePlan.mutate({ id: plan.id, [field]: value });
  };

  return (
    <div className="space-y-4">
      <SectionLabel>Edit Plan</SectionLabel>

      {/* Name */}
      <EditField label="Name">
        <AutoSaveInput
          initialValue={plan.name}
          onSave={(v) => save("name", v)}
        />
      </EditField>

      {/* Status */}
      <EditField label="Status">
        <select
          defaultValue={plan.status}
          onChange={(e) => save("status", e.target.value)}
          className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78]"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>
      </EditField>

      {/* Owner */}
      <EditField label="Owner">
        <select
          defaultValue={plan.owner?.id ?? ""}
          onChange={(e) => save("ownerId", e.target.value || null)}
          className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78]"
        >
          <option value="">No owner</option>
          {users?.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName || u.email}
            </option>
          ))}
        </select>
      </EditField>

      {/* States */}
      <EditField label="States">
        <StatesMultiSelect
          allStates={allStates ?? []}
          initialValue={plan.states?.map((s) => s.fips) ?? []}
          onSave={(fips) => save("stateFips", fips)}
        />
      </EditField>

      {/* Fiscal Year */}
      <EditField label="Fiscal Year">
        <AutoSaveInput
          initialValue={String(plan.fiscalYear)}
          onSave={(v) => save("fiscalYear", parseInt(v) || plan.fiscalYear)}
          type="number"
        />
      </EditField>

      {/* Start Date */}
      <EditField label="Start Date">
        <input
          type="date"
          defaultValue={plan.startDate?.split("T")[0] ?? ""}
          onBlur={(e) => save("startDate", e.target.value || null)}
          className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78]"
        />
      </EditField>

      {/* End Date */}
      <EditField label="End Date">
        <input
          type="date"
          defaultValue={plan.endDate?.split("T")[0] ?? ""}
          onBlur={(e) => save("endDate", e.target.value || null)}
          className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78]"
        />
      </EditField>

      {/* Description */}
      <EditField label="Description">
        <AutoSaveTextarea
          initialValue={plan.description ?? ""}
          onSave={(v) => save("description", v || null)}
        />
      </EditField>
    </div>
  );
}

// ─── Shared sub-components ─────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[10px] font-bold uppercase tracking-wider text-[#A69DC0]">
      {children}
    </p>
  );
}

function StatRow({
  label,
  value,
  highlight,
}: {
  label: string;
  value: string;
  highlight?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className="text-xs text-[#8A80A8]">{label}</span>
      <span
        className={`text-xs tabular-nums ${
          highlight ? "font-bold text-[#403770]" : "font-medium text-[#544A78]"
        }`}
      >
        {value}
      </span>
    </div>
  );
}

function EditField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <label className="block text-[10px] font-bold uppercase tracking-wider text-[#A69DC0] mb-1">
        {label}
      </label>
      {children}
    </div>
  );
}

function AutoSaveInput({
  initialValue,
  onSave,
  type = "text",
}: {
  initialValue: string;
  onSave: (value: string) => void;
  type?: string;
}) {
  const ref = useRef<HTMLInputElement>(null);

  return (
    <input
      ref={ref}
      type={type}
      defaultValue={initialValue}
      onBlur={(e) => {
        if (e.target.value !== initialValue) {
          onSave(e.target.value);
        }
      }}
      onKeyDown={(e) => {
        if (e.key === "Enter") ref.current?.blur();
      }}
      className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78]"
    />
  );
}

function AutoSaveTextarea({
  initialValue,
  onSave,
}: {
  initialValue: string;
  onSave: (value: string) => void;
}) {
  return (
    <textarea
      defaultValue={initialValue}
      onBlur={(e) => {
        if (e.target.value !== initialValue) {
          onSave(e.target.value);
        }
      }}
      rows={3}
      className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-[#544A78] resize-none"
    />
  );
}

function StatesMultiSelect({
  allStates,
  initialValue,
  onSave,
}: {
  allStates: { fips: string; abbrev: string; name: string }[];
  initialValue: string[];
  onSave: (fips: string[]) => void;
}) {
  const [selected, setSelected] = useState<string[]>(initialValue);
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const commit = (next: string[]) => {
    setSelected(next);
    onSave(next);
  };

  const toggle = (fips: string) => {
    commit(
      selected.includes(fips)
        ? selected.filter((f) => f !== fips)
        : [...selected, fips]
    );
  };

  const filtered = search
    ? allStates.filter((s) => {
        const q = search.toLowerCase();
        return s.name.toLowerCase().includes(q) || s.abbrev.toLowerCase().includes(q);
      })
    : allStates;

  return (
    <div ref={containerRef} className="relative">
      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1 mb-1.5">
          {selected.map((fips) => {
            const st = allStates.find((s) => s.fips === fips);
            return (
              <span
                key={fips}
                className="inline-flex items-center gap-1 pl-2 pr-1 py-0.5 bg-[#EFEDF5] border border-[#D4CFE2] text-[#544A78] rounded-full text-[10px] font-semibold"
              >
                {st?.abbrev ?? fips}
                <button
                  type="button"
                  onClick={() => commit(selected.filter((f) => f !== fips))}
                  className="w-3.5 h-3.5 flex items-center justify-center rounded-full text-[#8A80A8] hover:text-[#403770] hover:bg-white transition-colors"
                  aria-label={`Unlink ${st?.name ?? fips}`}
                >
                  <svg width="7" height="7" viewBox="0 0 7 7" fill="none">
                    <path
                      d="M1 1L6 6M6 1L1 6"
                      stroke="currentColor"
                      strokeWidth="1.3"
                      strokeLinecap="round"
                    />
                  </svg>
                </button>
              </span>
            );
          })}
        </div>
      )}

      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="w-full px-2.5 py-1.5 text-xs border border-[#D4CFE2] rounded-lg bg-white focus:outline-none focus:ring-1 focus:ring-[#403770]/30 text-left flex items-center justify-between transition-colors hover:border-[#A69DC0]"
      >
        <span className={selected.length === 0 ? "text-[#A69DC0]" : "text-[#544A78]"}>
          {selected.length === 0
            ? "Link a state…"
            : selected.length === 1
            ? "1 state linked"
            : `${selected.length} states linked`}
        </span>
        <svg
          width="10"
          height="10"
          viewBox="0 0 10 10"
          fill="none"
          className={`text-[#A69DC0] transition-transform duration-100 ${open ? "rotate-180" : ""}`}
        >
          <path
            d="M2 3.5L5 6.5L8 3.5"
            stroke="currentColor"
            strokeWidth="1.3"
            strokeLinecap="round"
            strokeLinejoin="round"
          />
        </svg>
      </button>

      {open && (
        <div className="absolute z-20 mt-1 w-full bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg overflow-hidden">
          <div className="p-1.5 border-b border-[#E2DEEC]">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search states…"
              autoFocus
              className="w-full px-2 py-1 text-xs rounded-md bg-[#F7F5FA] border border-transparent focus:outline-none focus:bg-white focus:border-[#D4CFE2] text-[#544A78] placeholder:text-[#A69DC0]"
            />
          </div>
          <div className="max-h-44 overflow-y-auto py-1">
            {filtered.length === 0 ? (
              <p className="px-3 py-2 text-[11px] text-[#A69DC0]">No matches</p>
            ) : (
              filtered.map((state) => {
                const checked = selected.includes(state.fips);
                return (
                  <label
                    key={state.fips}
                    className="flex items-center gap-2 px-2.5 py-1.5 text-xs text-[#544A78] cursor-pointer hover:bg-[#EFEDF5] transition-colors"
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggle(state.fips)}
                      className="rounded border-[#D4CFE2] text-[#403770] focus:ring-[#403770]/30"
                    />
                    <span className="font-semibold w-7 shrink-0 text-[#403770]">
                      {state.abbrev}
                    </span>
                    <span className="truncate">{state.name}</span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}
