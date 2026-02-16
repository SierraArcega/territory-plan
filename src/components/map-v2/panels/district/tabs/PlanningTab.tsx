"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import {
  usePlanDistrictDetail,
  useUpdateDistrictTargets,
  useServices,
  useTerritoryPlan,
  type DistrictDetail,
  type Service,
} from "@/lib/api";
import PurchasingHistoryCard from "../PurchasingHistoryCard";
import CompetitorSpendCard from "../CompetitorSpendCard";
import AddToPlanButton from "../AddToPlanButton";

interface PlanningTabProps {
  data: DistrictDetail;
  leaid: string;
}

export default function PlanningTab({ data, leaid }: PlanningTabProps) {
  const activePlanId = useMapV2Store((s) => s.activePlanId);

  if (!activePlanId) {
    return <NoPlanView data={data} leaid={leaid} />;
  }

  return <ActivePlanView data={data} leaid={leaid} planId={activePlanId} />;
}

// ---------- No active plan ----------

function NoPlanView({ data, leaid }: { data: DistrictDetail; leaid: string }) {
  return (
    <div className="p-3 space-y-3">
      <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center">
        <p className="text-sm text-gray-500">
          Open a territory plan to set targets and services
        </p>
      </div>

      <PurchasingHistoryCard fullmindData={data.fullmindData} />
      <CompetitorSpendCard leaid={leaid} />
    </div>
  );
}

// ---------- Active plan ----------

function ActivePlanView({
  data,
  leaid,
  planId,
}: {
  data: DistrictDetail;
  leaid: string;
  planId: string;
}) {
  const {
    data: planDistrict,
    isLoading,
    error,
  } = usePlanDistrictDetail(planId, leaid);
  const { data: plan } = useTerritoryPlan(planId);

  if (isLoading) {
    return (
      <div className="p-3 space-y-3">
        <div className="h-32 bg-gray-100 rounded-xl animate-pulse" />
        <div className="h-24 bg-gray-100 rounded-xl animate-pulse" />
      </div>
    );
  }

  if (error || !planDistrict) {
    // District not in this plan
    return (
      <div className="p-3 space-y-3">
        <div className="rounded-xl border border-dashed border-gray-200 p-4 text-center space-y-3">
          <p className="text-sm text-gray-500">
            Not in{" "}
            <span className="font-medium text-gray-700">
              {plan?.name || "this plan"}
            </span>
          </p>
          <AddToPlanButton leaid={leaid} existingPlanIds={data.territoryPlanIds} />
        </div>

        <PurchasingHistoryCard fullmindData={data.fullmindData} />
        <CompetitorSpendCard leaid={leaid} />
      </div>
    );
  }

  return (
    <div className="p-3 space-y-3">
      <TargetsForm
        planId={planId}
        leaid={leaid}
        renewalTarget={planDistrict.renewalTarget}
        winbackTarget={planDistrict.winbackTarget}
        expansionTarget={planDistrict.expansionTarget}
        newBusinessTarget={planDistrict.newBusinessTarget}
      />

      <ServicesSection
        planId={planId}
        leaid={leaid}
        returnServices={planDistrict.returnServices}
        newServices={planDistrict.newServices}
      />

      <NotesField
        planId={planId}
        leaid={leaid}
        notes={planDistrict.notes}
      />

      <PurchasingHistoryCard fullmindData={data.fullmindData} />
      <CompetitorSpendCard leaid={leaid} />
    </div>
  );
}

// ---------- Targets ----------

const TARGET_FIELDS = [
  { key: "renewalTarget" as const, label: "Renewal" },
  { key: "winbackTarget" as const, label: "Winback" },
  { key: "expansionTarget" as const, label: "Expansion" },
  { key: "newBusinessTarget" as const, label: "New Business" },
];

function TargetsForm({
  planId,
  leaid,
  renewalTarget,
  winbackTarget,
  expansionTarget,
  newBusinessTarget,
}: {
  planId: string;
  leaid: string;
  renewalTarget: number | null;
  winbackTarget: number | null;
  expansionTarget: number | null;
  newBusinessTarget: number | null;
}) {
  const initial = {
    renewalTarget,
    winbackTarget,
    expansionTarget,
    newBusinessTarget,
  };

  const [values, setValues] = useState(initial);
  const { mutate } = useUpdateDistrictTargets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Sync from server when props change
  useEffect(() => {
    setValues({
      renewalTarget,
      winbackTarget,
      expansionTarget,
      newBusinessTarget,
    });
  }, [renewalTarget, winbackTarget, expansionTarget, newBusinessTarget]);

  const save = useCallback(
    (patch: Partial<typeof values>) => {
      const next = { ...values, ...patch };
      setValues(next);

      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        mutate({ planId, leaid, ...next });
      }, 600);
    },
    [values, mutate, planId, leaid]
  );

  // Cleanup on unmount
  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="rounded-xl border border-gray-100 p-3 space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Targets
      </h3>
      <div className="grid grid-cols-2 gap-2">
        {TARGET_FIELDS.map((field) => (
          <div key={field.key}>
            <label className="text-[11px] text-gray-400 mb-0.5 block">
              {field.label}
            </label>
            <div className="relative">
              <span className="absolute left-2 top-1/2 -translate-y-1/2 text-xs text-gray-400">
                $
              </span>
              <input
                type="number"
                min={0}
                value={values[field.key] ?? ""}
                onChange={(e) => {
                  const v = e.target.value === "" ? null : Number(e.target.value);
                  save({ [field.key]: v });
                }}
                className="w-full pl-5 pr-2 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-1 focus:ring-plum/30 focus:border-plum/40"
                placeholder="0"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------- Services ----------

function ServicesSection({
  planId,
  leaid,
  returnServices,
  newServices,
}: {
  planId: string;
  leaid: string;
  returnServices: Array<{ id: number; name: string; slug: string; color: string }>;
  newServices: Array<{ id: number; name: string; slug: string; color: string }>;
}) {
  const { data: allServices } = useServices();
  const { mutate } = useUpdateDistrictTargets();

  const addService = useCallback(
    (serviceId: number, group: "return" | "new", currentIds: number[]) => {
      const next = [...currentIds, serviceId];
      if (group === "return") {
        mutate({ planId, leaid, returnServiceIds: next });
      } else {
        mutate({ planId, leaid, newServiceIds: next });
      }
    },
    [mutate, planId, leaid]
  );

  const removeService = useCallback(
    (serviceId: number, group: "return" | "new", currentIds: number[]) => {
      const next = currentIds.filter((id) => id !== serviceId);
      if (group === "return") {
        mutate({ planId, leaid, returnServiceIds: next });
      } else {
        mutate({ planId, leaid, newServiceIds: next });
      }
    },
    [mutate, planId, leaid]
  );

  const returnIds = returnServices.map((s) => s.id);
  const newIds = newServices.map((s) => s.id);
  const usedIds = new Set([...returnIds, ...newIds]);
  const availableServices = (allServices || []).filter((s) => !usedIds.has(s.id));

  return (
    <div className="rounded-xl border border-gray-100 p-3 space-y-3">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Services
      </h3>

      <ServiceGroup
        label="Return Services"
        selected={returnServices}
        available={availableServices}
        onAdd={(id) => addService(id, "return", returnIds)}
        onRemove={(id) => removeService(id, "return", returnIds)}
      />

      <ServiceGroup
        label="New Services"
        selected={newServices}
        available={availableServices}
        onAdd={(id) => addService(id, "new", newIds)}
        onRemove={(id) => removeService(id, "new", newIds)}
      />
    </div>
  );
}

function ServiceGroup({
  label,
  selected,
  available,
  onAdd,
  onRemove,
}: {
  label: string;
  selected: Array<{ id: number; name: string; color: string }>;
  available: Service[];
  onAdd: (id: number) => void;
  onRemove: (id: number) => void;
}) {
  const [open, setOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdown on outside click
  useEffect(() => {
    if (!open) return;
    const handleClick = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  return (
    <div>
      <div className="flex items-center justify-between mb-1.5">
        <p className="text-[11px] text-gray-400">{label}</p>
        {available.length > 0 && (
          <div className="relative" ref={dropdownRef}>
            <button
              onClick={() => setOpen(!open)}
              className="text-[11px] text-plum hover:text-plum/80 font-medium transition-colors"
            >
              + Add
            </button>
            {open && (
              <div className="absolute z-10 top-6 right-0 w-48 bg-white border border-gray-200 rounded-lg shadow-lg py-1 max-h-48 overflow-y-auto">
                {available.map((svc) => (
                  <button
                    key={svc.id}
                    onClick={() => {
                      onAdd(svc.id);
                      setOpen(false);
                    }}
                    className="w-full text-left px-3 py-1.5 text-xs text-gray-700 hover:bg-gray-50 flex items-center gap-2 transition-colors"
                  >
                    <span
                      className="w-2 h-2 rounded-full shrink-0"
                      style={{ backgroundColor: svc.color }}
                    />
                    {svc.name}
                  </button>
                ))}
              </div>
            )}
          </div>
        )}
      </div>

      {selected.length > 0 && (
        <div className="flex flex-wrap gap-1.5">
          {selected.map((svc) => (
            <span
              key={svc.id}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-[11px] font-medium text-white"
              style={{ backgroundColor: svc.color }}
            >
              {svc.name}
              <button
                onClick={() => onRemove(svc.id)}
                className="hover:opacity-70 transition-opacity"
                aria-label={`Remove ${svc.name}`}
              >
                <svg width="10" height="10" viewBox="0 0 10 10" fill="none">
                  <path d="M3 3L7 7M7 3L3 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
              </button>
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

// ---------- Notes ----------

function NotesField({
  planId,
  leaid,
  notes,
}: {
  planId: string;
  leaid: string;
  notes: string | null;
}) {
  const [value, setValue] = useState(notes ?? "");
  const { mutate } = useUpdateDistrictTargets();
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setValue(notes ?? "");
  }, [notes]);

  const handleChange = useCallback(
    (text: string) => {
      setValue(text);
      if (timerRef.current) clearTimeout(timerRef.current);
      timerRef.current = setTimeout(() => {
        mutate({ planId, leaid, notes: text || null });
      }, 600);
    },
    [mutate, planId, leaid]
  );

  useEffect(() => () => { if (timerRef.current) clearTimeout(timerRef.current); }, []);

  return (
    <div className="rounded-xl border border-gray-100 p-3 space-y-2">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">
        Plan Notes
      </h3>
      <textarea
        value={value}
        onChange={(e) => handleChange(e.target.value)}
        placeholder="Add notes for this district..."
        rows={3}
        className="w-full text-sm border border-gray-200 rounded-lg p-2 focus:outline-none focus:ring-1 focus:ring-plum/30 focus:border-plum/40 resize-none"
      />
    </div>
  );
}
