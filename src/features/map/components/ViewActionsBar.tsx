"use client";

import { useState, useEffect, useRef } from "react";
import { useMapV2Store } from "@/features/map/lib/store";
import type { MapViewState } from "@/features/map/lib/store";
import { useCreateMapView, useMapViews } from "@/features/map/lib/map-view-queries";
import { useTerritoryPlans, useCreateTerritoryPlan, useAddDistrictsToPlan } from "@/features/plans/lib/queries";
import { fetchJson, API_BASE } from "@/features/shared/lib/api-client";

type ActivePopover = "save" | "load" | "create-plan" | "add-to-plan" | null;

export default function ViewActionsBar() {
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 2500);
    return () => clearTimeout(timer);
  }, [toast]);

  const toggle = (p: ActivePopover) =>
    setActivePopover((cur) => (cur === p ? null : p));

  return (
    <div className="relative">
      <div className="flex items-center gap-1.5 px-3 py-1.5 border-b border-gray-200/60">
        <ActionBtn label="Save View" onClick={() => toggle("save")} />
        <ActionBtn label="Load View" onClick={() => toggle("load")} />
        <div className="w-px h-4 bg-gray-200/60 shrink-0" />
        <ActionBtn label="Create Plan" onClick={() => toggle("create-plan")} />
        <ActionBtn label="Add to Plan" onClick={() => toggle("add-to-plan")} />
      </div>

      {activePopover === "save" && (
        <SaveViewPopover
          onClose={() => setActivePopover(null)}
          onSuccess={(name) => {
            setActivePopover(null);
            setToast(`Saved view "${name}"`);
          }}
        />
      )}
      {activePopover === "load" && (
        <LoadViewPopover
          onClose={() => setActivePopover(null)}
          onLoaded={(name) => {
            setActivePopover(null);
            setToast(`Loaded view "${name}"`);
          }}
        />
      )}
      {activePopover === "create-plan" && (
        <CreatePlanPopover
          onClose={() => setActivePopover(null)}
          onSuccess={(name) => {
            setActivePopover(null);
            setToast(`Created plan "${name}"`);
          }}
        />
      )}
      {activePopover === "add-to-plan" && (
        <AddToPlanPopover
          onClose={() => setActivePopover(null)}
          onSuccess={(name, count) => {
            setActivePopover(null);
            setToast(`Added ${count} district${count !== 1 ? "s" : ""} to "${name}"`);
          }}
        />
      )}

      {toast && (
        <div className="absolute -bottom-10 left-1/2 -translate-x-1/2 whitespace-nowrap px-3 py-1.5 bg-gray-900 text-white text-xs rounded-lg shadow-lg z-20">
          {toast}
        </div>
      )}
    </div>
  );
}

function ActionBtn({ label, onClick }: { label: string; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className="text-[10px] font-medium text-gray-500 hover:text-gray-700 hover:bg-gray-100 px-2 py-1 rounded-md transition-colors"
    >
      {label}
    </button>
  );
}

function Popover({
  onClose,
  children,
}: {
  onClose: () => void;
  children: React.ReactNode;
}) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose();
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [onClose]);

  return (
    <div
      ref={ref}
      className="absolute top-full left-3 mt-1 w-72 bg-white rounded-xl shadow-xl border border-gray-200 p-3 z-20"
    >
      {children}
    </div>
  );
}

function SaveViewPopover({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [isShared, setIsShared] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getViewSnapshot = useMapV2Store((s) => s.getViewSnapshot);
  const createView = useCreateMapView();
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleSave = async () => {
    if (!name.trim()) return;
    setError(null);
    try {
      await createView.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        isShared,
        state: getViewSnapshot() as unknown as Record<string, unknown>,
      });
      onSuccess(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to save view");
    }
  };

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Save View</div>
      <input
        ref={inputRef}
        type="text"
        placeholder="View name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        maxLength={200}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2"
        onKeyDown={(e) => e.key === "Enter" && handleSave()}
      />
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2 resize-none"
      />
      <label className="flex items-center gap-1.5 text-xs text-gray-600 mb-3 cursor-pointer">
        <input
          type="checkbox"
          checked={isShared}
          onChange={(e) => setIsShared(e.target.checked)}
          className="rounded border-gray-300 text-indigo-500 focus:ring-indigo-400"
        />
        Share with team
      </label>
      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button
          onClick={onClose}
          className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1"
        >
          Cancel
        </button>
        <button
          onClick={handleSave}
          disabled={!name.trim() || createView.isPending}
          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
        >
          {createView.isPending ? "Saving..." : "Save"}
        </button>
      </div>
    </Popover>
  );
}

function LoadViewPopover({
  onClose,
  onLoaded,
}: {
  onClose: () => void;
  onLoaded: (name: string) => void;
}) {
  const { data: views, isLoading } = useMapViews();
  const applyViewSnapshot = useMapV2Store((s) => s.applyViewSnapshot);
  const [error, setError] = useState<string | null>(null);

  const handleLoad = async (viewId: string, viewName: string) => {
    setError(null);
    try {
      const detail = await fetchJson<{ state: MapViewState }>(
        `${API_BASE}/map-views/${viewId}`
      );
      applyViewSnapshot(detail.state);
      onLoaded(viewName);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load view");
    }
  };

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Load View</div>
      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      {isLoading ? (
        <div className="text-xs text-gray-400 py-2">Loading...</div>
      ) : !views?.length ? (
        <div className="text-xs text-gray-400 py-2">No saved views yet</div>
      ) : (
        <div className="max-h-48 overflow-y-auto -mx-1">
          {views.map((v) => (
            <button
              key={v.id}
              onClick={() => handleLoad(v.id, v.name)}
              className="w-full text-left text-xs text-gray-600 hover:bg-gray-100 rounded px-2 py-1.5 truncate"
            >
              {v.name}
              {v.isShared && (
                <span className="text-gray-400 ml-1 text-[10px]">shared</span>
              )}
            </button>
          ))}
        </div>
      )}
    </Popover>
  );
}

function useFilterParams() {
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const filterStates = useMapV2Store((s) => s.filterStates);
  const filterOwner = useMapV2Store((s) => s.filterOwner);
  const filterPlanId = useMapV2Store((s) => s.filterPlanId);
  const filterAccountTypes = useMapV2Store((s) => s.filterAccountTypes);
  const activeVendors = useMapV2Store((s) => s.activeVendors);

  return () => {
    const params = new URLSearchParams();
    params.set("fy", selectedFiscalYear);
    const statesCsv = [...filterStates].sort().join(",");
    const vendorsCsv = [...activeVendors].sort().join(",");
    const accountTypesCsv = [...filterAccountTypes].sort().join(",");
    if (statesCsv) params.set("states", statesCsv);
    if (filterOwner) params.set("owner", filterOwner);
    if (filterPlanId) params.set("planId", filterPlanId);
    if (accountTypesCsv) params.set("accountTypes", accountTypesCsv);
    if (vendorsCsv) params.set("vendors", vendorsCsv);
    return params;
  };
}

function CreatePlanPopover({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const selectedFiscalYear = useMapV2Store((s) => s.selectedFiscalYear);
  const [fiscalYear, setFiscalYear] = useState(
    parseInt(selectedFiscalYear.replace("fy", "20"), 10)
  );
  const createPlan = useCreateTerritoryPlan();
  const addDistricts = useAddDistrictsToPlan();
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const getFilterParams = useFilterParams();

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleCreate = async () => {
    if (!name.trim()) return;
    setIsWorking(true);
    setError(null);
    try {
      const params = getFilterParams();
      const { leaids } = await fetchJson<{ leaids: string[] }>(
        `${API_BASE}/districts/leaids?${params.toString()}`
      );

      const plan = await createPlan.mutateAsync({
        name: name.trim(),
        description: description.trim() || undefined,
        fiscalYear,
      });

      if (leaids.length > 0) {
        await addDistricts.mutateAsync({ planId: plan.id, leaids });
      }

      onSuccess(name.trim());
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to create plan");
      setIsWorking(false);
    }
  };

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Create Plan from Visible Districts</div>
      <input
        ref={inputRef}
        type="text"
        placeholder="Plan name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2"
        onKeyDown={(e) => e.key === "Enter" && handleCreate()}
      />
      <select
        value={fiscalYear}
        onChange={(e) => setFiscalYear(Number(e.target.value))}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2 bg-white"
      >
        <option value={2024}>FY24</option>
        <option value={2025}>FY25</option>
        <option value={2026}>FY26</option>
        <option value={2027}>FY27</option>
      </select>
      <textarea
        placeholder="Description (optional)"
        value={description}
        onChange={(e) => setDescription(e.target.value)}
        rows={2}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2 resize-none"
      />
      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
        <button
          onClick={handleCreate}
          disabled={!name.trim() || isWorking}
          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
        >
          {isWorking ? "Creating..." : "Create"}
        </button>
      </div>
    </Popover>
  );
}

function AddToPlanPopover({
  onClose,
  onSuccess,
}: {
  onClose: () => void;
  onSuccess: (name: string, count: number) => void;
}) {
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const { data: plans, isLoading: plansLoading } = useTerritoryPlans();
  const addDistricts = useAddDistrictsToPlan();
  const [isWorking, setIsWorking] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const getFilterParams = useFilterParams();

  const filtered = plans?.filter((p) =>
    p.name.toLowerCase().includes(search.toLowerCase())
  ) ?? [];

  const handleAdd = async () => {
    if (!selectedPlanId) return;
    const plan = plans?.find((p) => p.id === selectedPlanId);
    if (!plan) return;
    setIsWorking(true);
    setError(null);
    try {
      const params = getFilterParams();
      const { leaids } = await fetchJson<{ leaids: string[] }>(
        `${API_BASE}/districts/leaids?${params.toString()}`
      );

      const result = await addDistricts.mutateAsync({
        planId: selectedPlanId,
        leaids,
      });

      onSuccess(plan.name, result.added);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to add districts");
      setIsWorking(false);
    }
  };

  return (
    <Popover onClose={onClose}>
      <div className="text-xs font-semibold text-gray-700 mb-2">Add Visible Districts to Plan</div>
      <input
        type="text"
        placeholder="Search plans..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
        className="w-full text-xs border border-gray-200 rounded-md px-2 py-1.5 focus:outline-none focus:ring-1 focus:ring-indigo-400 mb-2"
        autoFocus
      />
      <div className="max-h-36 overflow-y-auto mb-2 -mx-1">
        {plansLoading ? (
          <div className="text-xs text-gray-400 py-2 px-1">Loading...</div>
        ) : filtered.length === 0 ? (
          <div className="text-xs text-gray-400 py-2 px-1">No plans found</div>
        ) : (
          filtered.map((p) => (
            <button
              key={p.id}
              onClick={() => setSelectedPlanId(p.id)}
              className={`w-full text-left text-xs rounded px-2 py-1.5 truncate ${
                selectedPlanId === p.id
                  ? "bg-indigo-50 text-indigo-700"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <span
                className="inline-block w-2 h-2 rounded-full mr-1.5 align-middle"
                style={{ backgroundColor: p.color }}
              />
              {p.name}
              <span className="text-gray-400 ml-1">({p.districtCount} districts)</span>
            </button>
          ))
        )}
      </div>
      {error && <div className="text-xs text-red-500 mb-2">{error}</div>}
      <div className="flex justify-end gap-2">
        <button onClick={onClose} className="text-xs text-gray-500 hover:text-gray-700 px-2 py-1">Cancel</button>
        <button
          onClick={handleAdd}
          disabled={!selectedPlanId || isWorking}
          className="text-xs font-medium text-white bg-indigo-500 hover:bg-indigo-600 disabled:opacity-50 px-3 py-1 rounded-md transition-colors"
        >
          {isWorking ? "Adding..." : "Add Districts"}
        </button>
      </div>
    </Popover>
  );
}
