"use client";

import { useState, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useTerritoryPlan, useUpdateTerritoryPlan, useDeleteTerritoryPlan } from "@/lib/api";

// Plan colors for the color picker
const PLAN_COLORS = [
  { name: "Plum", value: "#403770" },
  { name: "Coral", value: "#F37167" },
  { name: "Steel Blue", value: "#6EA3BE" },
  { name: "Sage", value: "#8AA891" },
  { name: "Gold", value: "#D4A84B" },
];

const STATUS_OPTIONS = [
  { value: "planning", label: "Planning" },
  { value: "working", label: "Working" },
  { value: "stale", label: "Stale" },
  { value: "archived", label: "Archived" },
];

export default function PlanEditForm() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const closeRightPanel = useMapV2Store((s) => s.closeRightPanel);
  const goBack = useMapV2Store((s) => s.goBack);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);
  const updatePlan = useUpdateTerritoryPlan();
  const deletePlan = useDeleteTerritoryPlan();

  // Form state
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [owner, setOwner] = useState("");
  const [color, setColor] = useState("#403770");
  const [status, setStatus] = useState<"planning" | "working" | "stale" | "archived">("planning");
  const [fiscalYear, setFiscalYear] = useState(2026);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Pre-fill from plan data
  useEffect(() => {
    if (plan) {
      setName(plan.name);
      setDescription(plan.description || "");
      setOwner(plan.owner?.fullName || "");
      setColor(plan.color || "#403770");
      setStatus(plan.status as "planning" | "working" | "stale" | "archived");
      setFiscalYear(plan.fiscalYear);
    }
  }, [plan]);

  const handleSave = async () => {
    if (!activePlanId || !name.trim()) return;
    try {
      await updatePlan.mutateAsync({
        id: activePlanId,
        name: name.trim(),
        description: description.trim() || undefined,
        color,
        status,
        fiscalYear,
      });
      closeRightPanel();
    } catch {
      // Error handled by mutation
    }
  };

  const handleDelete = async () => {
    if (!activePlanId) return;
    await deletePlan.mutateAsync(activePlanId);
    closeRightPanel();
    goBack();
  };

  if (isLoading) {
    return <LoadingSkeleton />;
  }

  return (
    <div className="space-y-3">
      {/* Plan Name */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Plan Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Q3 Texas Expansion"
          autoFocus
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors placeholder:text-gray-300"
        />
      </div>

      {/* Fiscal Year */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Fiscal Year
        </label>
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(parseInt(e.target.value))}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors text-gray-700"
        >
          <option value={2025}>FY 2025</option>
          <option value={2026}>FY 2026</option>
          <option value={2027}>FY 2027</option>
          <option value={2028}>FY 2028</option>
          <option value={2029}>FY 2029</option>
        </select>
      </div>

      {/* Status */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "planning" | "working" | "stale" | "archived")}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors text-gray-700"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Color */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1.5">
          Color
        </label>
        <div className="flex gap-2">
          {PLAN_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`w-6 h-6 rounded-full transition-all ${
                color === c.value
                  ? "ring-2 ring-offset-1 ring-gray-400"
                  : "hover:scale-110"
              }`}
              style={{ backgroundColor: c.value }}
              title={c.name}
            />
          ))}
        </div>
      </div>

      {/* Owner */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Owner
        </label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="e.g., John Smith"
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors placeholder:text-gray-300"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-[10px] font-medium text-gray-400 uppercase tracking-wider mb-1">
          Description
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this plan..."
          rows={3}
          className="w-full px-3 py-2 text-xs rounded-lg border border-gray-200 focus:border-gray-400 focus:outline-none focus:ring-0 transition-colors placeholder:text-gray-300 resize-none"
        />
      </div>

      {/* Error */}
      {updatePlan.isError && (
        <div className="bg-red-50 text-red-600 text-xs rounded-lg px-3 py-2">
          Failed to update plan. Please try again.
        </div>
      )}

      {/* Save button */}
      <div className="space-y-2 pt-1">
        <button
          onClick={handleSave}
          disabled={!name.trim() || updatePlan.isPending}
          className="w-full py-2 bg-gray-800 text-white text-xs font-medium rounded-lg hover:bg-gray-900 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {updatePlan.isPending ? "Saving..." : "Save Changes"}
        </button>

        {/* Delete button */}
        {!showDeleteConfirm && (
          <button
            onClick={() => setShowDeleteConfirm(true)}
            className="w-full py-2 text-red-500 text-xs font-medium rounded-lg hover:bg-red-50 transition-colors"
          >
            Delete Plan
          </button>
        )}

        {/* Delete confirmation */}
        {showDeleteConfirm && (
          <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
            <p className="text-xs text-red-600 font-medium">
              Delete this plan and all its associations?
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleDelete}
                disabled={deletePlan.isPending}
                className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
              >
                {deletePlan.isPending ? "Deleting..." : "Delete"}
              </button>
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function LoadingSkeleton() {
  return (
    <div className="space-y-3">
      <div>
        <div className="h-2 bg-gray-200 rounded w-16 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div>
        <div className="h-2 bg-gray-200 rounded w-20 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div>
        <div className="h-2 bg-gray-200 rounded w-12 mb-1.5 animate-pulse" />
        <div className="h-9 bg-gray-100 rounded-lg animate-pulse" />
      </div>
      <div>
        <div className="h-2 bg-gray-200 rounded w-10 mb-1.5 animate-pulse" />
        <div className="flex gap-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="w-6 h-6 rounded-full bg-gray-100 animate-pulse" />
          ))}
        </div>
      </div>
      <div className="h-9 bg-gray-200 rounded-lg animate-pulse" />
    </div>
  );
}
