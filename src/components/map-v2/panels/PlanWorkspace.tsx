"use client";

import { useState, useEffect } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import type { PlanSection } from "@/lib/map-v2-store";
import { useTerritoryPlan, useUpdateTerritoryPlan, useDeleteTerritoryPlan } from "@/lib/api";
import PlanOverviewSection from "./PlanOverviewSection";
import PlanTasksSection from "./PlanTasksSection";
import PlanContactsSection from "./PlanContactsSection";
import PlanPerfSection from "./PlanPerfSection";
import PlanActivitiesSection from "./PlanActivitiesSection";

const STATUS_BADGE: Record<string, { bg: string; text: string }> = {
  draft: { bg: "bg-gray-100", text: "text-gray-600" },
  active: { bg: "bg-green-100", text: "text-green-700" },
  archived: { bg: "bg-amber-100", text: "text-amber-700" },
};

const ICON_TABS: { key: PlanSection; label: string; path: string; stroke?: boolean }[] = [
  {
    key: "districts",
    label: "Districts",
    path: "M3 3H7V7H3V3ZM9 3H13V7H9V3ZM3 9H7V13H3V9ZM9 9H13V13H9V9Z",
    stroke: false,
  },
  {
    key: "activities",
    label: "Activities",
    path: "M8 2V5M3 8H5M11 8H13M4.9 4.9L6.3 6.3M11.1 4.9L9.7 6.3M8 14C11.3 14 14 11.3 14 8S11.3 2 8 2 2 4.7 2 8 4.7 14 8 14Z",
    stroke: true,
  },
  {
    key: "tasks",
    label: "Tasks",
    path: "M3 4H5V6H3V4ZM7 4.5H13M3 8H5V10H3V8ZM7 8.5H13M3 12H5V14H3V12ZM7 12.5H13",
    stroke: true,
  },
  {
    key: "contacts",
    label: "Contacts",
    path: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13",
    stroke: true,
  },
  {
    key: "performance",
    label: "Performance",
    path: "M3 13V8M7 13V5M11 13V9M15 13V3",
    stroke: true,
  },
];

export default function PlanWorkspace() {
  const activePlanId = useMapV2Store((s) => s.activePlanId);
  const planSection = useMapV2Store((s) => s.planSection);
  const setPlanSection = useMapV2Store((s) => s.setPlanSection);
  const goBack = useMapV2Store((s) => s.goBack);

  const { data: plan, isLoading } = useTerritoryPlan(activePlanId);
  const updatePlan = useUpdateTerritoryPlan();
  const deletePlan = useDeleteTerritoryPlan();

  const [isEditing, setIsEditing] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // Inline edit form state
  const [editName, setEditName] = useState("");
  const [editDescription, setEditDescription] = useState("");
  const [editOwner, setEditOwner] = useState("");
  const [editColor, setEditColor] = useState("#403770");
  const [editStatus, setEditStatus] = useState<"draft" | "active" | "archived">("active");
  const [editFiscalYear, setEditFiscalYear] = useState(2026);

  const badge = plan ? STATUS_BADGE[plan.status] || STATUS_BADGE.draft : null;

  // Pre-fill edit form when entering edit mode
  useEffect(() => {
    if (isEditing && plan) {
      setEditName(plan.name);
      setEditDescription(plan.description || "");
      setEditOwner(plan.owner || "");
      setEditColor(plan.color || "#403770");
      setEditStatus(plan.status as "draft" | "active" | "archived");
      setEditFiscalYear(plan.fiscalYear);
    }
  }, [isEditing, plan]);

  // Handle plan edit save
  const handleEditSave = async () => {
    if (!activePlanId || !editName.trim()) return;
    try {
      await updatePlan.mutateAsync({
        id: activePlanId,
        name: editName.trim(),
        description: editDescription.trim() || undefined,
        owner: editOwner.trim() || undefined,
        color: editColor,
        status: editStatus,
        fiscalYear: editFiscalYear,
      });
      setIsEditing(false);
    } catch {
      // Error handled by mutation
    }
  };

  // Handle plan delete — delete then navigate back
  const handleDelete = async () => {
    if (!activePlanId) return;
    await deletePlan.mutateAsync(activePlanId);
    goBack();
  };

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="px-3 pt-2.5 pb-2 border-b border-gray-100">
        <div className="flex items-center gap-2 mb-2">
          <button
            onClick={goBack}
            className="w-7 h-7 rounded-lg hover:bg-gray-100 flex items-center justify-center transition-colors shrink-0"
            aria-label="Go back"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              <path
                d="M9 3L5 7L9 11"
                stroke="#6B7280"
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>

          {isLoading ? (
            <div className="flex-1">
              <div className="h-4 bg-gray-200 rounded w-3/4 animate-pulse" />
            </div>
          ) : plan ? (
            <>
              <h2 className="text-sm font-semibold text-gray-800 truncate flex-1">
                {plan.name}
              </h2>
              <button
                onClick={() => setIsEditing(!isEditing)}
                className={`w-7 h-7 rounded-lg flex items-center justify-center transition-colors shrink-0 ${
                  isEditing ? "bg-plum/10 text-plum" : "hover:bg-gray-100"
                }`}
                aria-label="Edit plan"
                title="Edit plan"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M11.5 2.5L13.5 4.5M10 4L2 12V14H4L12 6L10 4Z"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
              <button
                onClick={() => setShowDeleteConfirm(true)}
                className="w-7 h-7 rounded-lg hover:bg-red-50 flex items-center justify-center transition-colors shrink-0"
                aria-label="Delete plan"
                title="Delete plan"
              >
                <svg width="13" height="13" viewBox="0 0 16 16" fill="none">
                  <path
                    d="M3 5H13M5 5V3C5 2.4 5.4 2 6 2H10C10.6 2 11 2.4 11 3V5M6 8V12M10 8V12M4 5L5 14H11L12 5"
                    stroke="#9CA3AF"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  />
                </svg>
              </button>
            </>
          ) : (
            <span className="text-sm text-gray-400">Plan not found</span>
          )}
        </div>

        {/* Badges */}
        {isLoading ? (
          <div className="flex gap-1.5 mb-2 ml-9">
            <div className="h-5 bg-gray-100 rounded-full w-14 animate-pulse" />
            <div className="h-5 bg-plum/10 rounded-full w-12 animate-pulse" />
            <div className="h-5 bg-gray-100 rounded-full w-20 animate-pulse" />
          </div>
        ) : plan ? (
          <div className="flex gap-1.5 flex-wrap ml-9 mb-2">
            {badge && (
              <span
                className={`px-2 py-0.5 text-[10px] font-medium rounded-full ${badge.bg} ${badge.text} capitalize`}
              >
                {plan.status}
              </span>
            )}
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-plum/10 text-plum">
              FY {plan.fiscalYear}
            </span>
            <span className="px-2 py-0.5 text-[10px] font-medium rounded-full bg-gray-100 text-gray-600">
              {plan.districts.length} district{plan.districts.length !== 1 ? "s" : ""}
            </span>
          </div>
        ) : null}
      </div>

      {/* Inline edit form — replaces tabs when editing */}
      {isEditing ? (
        <PlanEditForm
          name={editName}
          setName={setEditName}
          description={editDescription}
          setDescription={setEditDescription}
          owner={editOwner}
          setOwner={setEditOwner}
          color={editColor}
          setColor={setEditColor}
          status={editStatus}
          setStatus={setEditStatus}
          fiscalYear={editFiscalYear}
          setFiscalYear={setEditFiscalYear}
          onSave={handleEditSave}
          onCancel={() => setIsEditing(false)}
          onDelete={() => setShowDeleteConfirm(true)}
          isSaving={updatePlan.isPending}
          showDeleteConfirm={showDeleteConfirm}
          onDeleteConfirm={handleDelete}
          onDeleteCancel={() => setShowDeleteConfirm(false)}
          isDeleting={deletePlan.isPending}
          saveError={updatePlan.isError}
        />
      ) : (
        <>
          {/* Icon strip */}
          <PlanIconStrip activeSection={planSection} onSelect={setPlanSection} />

          {/* Section content */}
          <div className="flex-1 overflow-y-auto min-h-0">
            {planSection === "districts" && <PlanOverviewSection />}
            {planSection === "activities" && <PlanActivitiesSection />}
            {planSection === "tasks" && <PlanTasksSection />}
            {planSection === "contacts" && <PlanContactsSection />}
            {planSection === "performance" && <PlanPerfSection />}
          </div>
        </>
      )}
    </div>
  );
}

function PlanIconStrip({
  activeSection,
  onSelect,
}: {
  activeSection: PlanSection;
  onSelect: (section: PlanSection) => void;
}) {
  return (
    <div className="flex border-b border-gray-100">
      {ICON_TABS.map((tab) => {
        const isActive = activeSection === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              isActive
                ? "bg-plum/10 text-plum"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            <svg
              width="14"
              height="14"
              viewBox="0 0 16 16"
              fill="none"
              className="shrink-0"
            >
              <path
                d={tab.path}
                stroke={isActive ? "currentColor" : "currentColor"}
                strokeWidth="1.5"
                strokeLinecap="round"
                strokeLinejoin="round"
                fill={tab.stroke ? "none" : "currentColor"}
              />
            </svg>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}

// Plan colors for the color picker
const PLAN_COLORS = [
  { name: "Plum", value: "#403770" },
  { name: "Coral", value: "#F37167" },
  { name: "Steel Blue", value: "#6EA3BE" },
  { name: "Sage", value: "#8AA891" },
  { name: "Gold", value: "#D4A84B" },
];

const STATUS_OPTIONS = [
  { value: "draft", label: "Draft" },
  { value: "active", label: "Active" },
  { value: "archived", label: "Archived" },
];

// Inline edit form that replaces the tab content — matches PlanFormPanel styling
function PlanEditForm({
  name, setName,
  description, setDescription,
  owner, setOwner,
  color, setColor,
  status, setStatus,
  fiscalYear, setFiscalYear,
  onSave, onCancel, onDelete,
  isSaving,
  showDeleteConfirm, onDeleteConfirm, onDeleteCancel, isDeleting,
  saveError,
}: {
  name: string; setName: (v: string) => void;
  description: string; setDescription: (v: string) => void;
  owner: string; setOwner: (v: string) => void;
  color: string; setColor: (v: string) => void;
  status: "draft" | "active" | "archived"; setStatus: (v: "draft" | "active" | "archived") => void;
  fiscalYear: number; setFiscalYear: (v: number) => void;
  onSave: () => void; onCancel: () => void; onDelete: () => void;
  isSaving: boolean;
  showDeleteConfirm: boolean; onDeleteConfirm: () => void; onDeleteCancel: () => void; isDeleting: boolean;
  saveError: boolean;
}) {
  return (
    <div className="flex-1 overflow-y-auto p-3 space-y-3">
      {/* Plan Name */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Plan Name
        </label>
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Q3 Texas Expansion"
          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
          autoFocus
        />
      </div>

      {/* Fiscal Year */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Fiscal Year
        </label>
        <select
          value={fiscalYear}
          onChange={(e) => setFiscalYear(parseInt(e.target.value))}
          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 text-gray-700"
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
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Status
        </label>
        <select
          value={status}
          onChange={(e) => setStatus(e.target.value as "draft" | "active" | "archived")}
          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 text-gray-700"
        >
          {STATUS_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>{opt.label}</option>
          ))}
        </select>
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1.5">
          Color
        </label>
        <div className="flex gap-2">
          {PLAN_COLORS.map((c) => (
            <button
              key={c.value}
              type="button"
              onClick={() => setColor(c.value)}
              className={`w-7 h-7 rounded-full transition-all ${
                color === c.value
                  ? "ring-2 ring-offset-2 ring-plum"
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
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Owner <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <input
          type="text"
          value={owner}
          onChange={(e) => setOwner(e.target.value)}
          placeholder="e.g., John Smith"
          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-medium text-gray-500 mb-1">
          Description <span className="text-gray-400 font-normal">(optional)</span>
        </label>
        <textarea
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe this plan..."
          rows={3}
          className="w-full px-3 py-2 text-sm bg-gray-50 border border-gray-200/60 rounded-xl focus:outline-none focus:ring-2 focus:ring-plum/20 focus:border-plum/30 placeholder:text-gray-400 resize-none"
        />
      </div>

      {/* Error */}
      {saveError && (
        <div className="bg-red-50 text-red-600 text-xs rounded-xl px-3 py-2">
          Failed to update plan. Please try again.
        </div>
      )}

      {/* Save + Cancel buttons */}
      <div className="flex gap-2 pt-1">
        <button
          onClick={onSave}
          disabled={!name.trim() || isSaving}
          className="flex-1 py-2 bg-plum text-white text-xs font-medium rounded-xl hover:bg-plum/90 transition-all disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {isSaving ? "Saving..." : "Save Changes"}
        </button>
        <button
          onClick={onCancel}
          className="flex-1 py-2 bg-gray-100 text-gray-600 text-xs font-medium rounded-xl hover:bg-gray-200 transition-colors"
        >
          Cancel
        </button>
      </div>

      {/* Delete section */}
      {!showDeleteConfirm ? (
        <button
          onClick={onDelete}
          className="w-full py-2 text-red-500 text-xs font-medium rounded-xl hover:bg-red-50 transition-colors"
        >
          Delete Plan
        </button>
      ) : (
        <div className="rounded-xl bg-red-50 border border-red-200 p-3 space-y-2">
          <p className="text-xs text-red-600 font-medium">
            Delete this plan and all its associations?
          </p>
          <div className="flex gap-2">
            <button
              onClick={onDeleteConfirm}
              disabled={isDeleting}
              className="flex-1 py-1.5 bg-red-500 text-white text-xs font-medium rounded-lg hover:bg-red-600 transition-colors disabled:opacity-50"
            >
              {isDeleting ? "Deleting..." : "Delete"}
            </button>
            <button
              onClick={onDeleteCancel}
              className="flex-1 py-1.5 bg-white text-gray-600 text-xs font-medium rounded-lg border border-gray-200 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
