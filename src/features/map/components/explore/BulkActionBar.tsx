"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import {
  useUsers,
  useTags,
  useBatchEditDistricts,
  useBatchTagDistricts,
  useTerritoryPlans,
  useAddDistrictsToPlan,
  useCreateTerritoryPlan,
  type TerritoryPlan,
} from "@/lib/api";
import { useQueryClient } from "@tanstack/react-query";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface Props {
  selectedCount: number;
  selectedIds: string[];
  selectAllMatchingFilters: boolean;
  totalMatching: number;
  filters: { column: string; op: string; value?: unknown }[];
  onSelectAllMatching: () => void;
  onClearSelection: () => void;
}

type ActivePopover = "owner" | "tag" | "plan" | null;

interface QueuedTag {
  id: number;
  name: string;
  color: string;
  action: "add" | "remove";
}

interface QueuedPlan {
  id: string;
  name: string;
  color: string;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const PLAN_COLORS = [
  { name: "Plum", value: "#403770" },
  { name: "Coral", value: "#F37167" },
  { name: "Steel Blue", value: "#6EA3BE" },
  { name: "Sage", value: "#8AA891" },
  { name: "Gold", value: "#D4A84B" },
];

function getDefaultFiscalYear(): number {
  const now = new Date();
  return now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
}

// ---------------------------------------------------------------------------
// Chip close "x" icon (shared)
// ---------------------------------------------------------------------------

function ChipX() {
  return (
    <svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
      <path d="M2.5 2.5L7.5 7.5M7.5 2.5L2.5 7.5" />
    </svg>
  );
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function BulkActionBar({
  selectedCount,
  selectedIds,
  selectAllMatchingFilters,
  totalMatching,
  filters,
  onSelectAllMatching,
  onClearSelection,
}: Props) {
  // Queued action state — accumulate before applying
  const [queuedOwner, setQueuedOwner] = useState<{ name: string; display: string } | null>(null);
  const [queuedTags, setQueuedTags] = useState<QueuedTag[]>([]);
  const [queuedPlan, setQueuedPlan] = useState<QueuedPlan | null>(null);
  const [isApplying, setIsApplying] = useState(false);

  // Popover UI state
  const [activePopover, setActivePopover] = useState<ActivePopover>(null);
  const [showNewPlanForm, setShowNewPlanForm] = useState(false);
  const [newPlanName, setNewPlanName] = useState("");
  const [newPlanColor, setNewPlanColor] = useState(PLAN_COLORS[0].value);

  const barRef = useRef<HTMLDivElement>(null);
  const planInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Data
  const { data: users } = useUsers();
  const { data: tags } = useTags();
  const { data: plans } = useTerritoryPlans();
  const batchEdit = useBatchEditDistricts();
  const batchTag = useBatchTagDistricts();
  const addToPlan = useAddDistrictsToPlan();
  const createPlan = useCreateTerritoryPlan();

  const count = selectAllMatchingFilters ? totalMatching : selectedCount;
  const pendingCount = (queuedOwner ? 1 : 0) + queuedTags.length + (queuedPlan ? 1 : 0);

  // Focus plan input
  useEffect(() => {
    if (showNewPlanForm && planInputRef.current) planInputRef.current.focus();
  }, [showNewPlanForm]);

  // Close popover on outside click
  const handleOutsideClick = useCallback((e: MouseEvent) => {
    if (barRef.current && !barRef.current.contains(e.target as Node)) {
      setActivePopover(null);
    }
  }, []);

  useEffect(() => {
    if (activePopover) {
      document.addEventListener("mousedown", handleOutsideClick);
    }
    return () => document.removeEventListener("mousedown", handleOutsideClick);
  }, [activePopover, handleOutsideClick]);

  // ---- Queue handlers ----

  const handleSelectOwner = (name: string, display: string) => {
    setQueuedOwner({ name, display });
    setActivePopover(null);
  };

  const handleToggleTag = (id: number, name: string, color: string, action: "add" | "remove") => {
    setQueuedTags((prev) => {
      const already = prev.find((t) => t.id === id && t.action === action);
      if (already) return prev.filter((t) => !(t.id === id && t.action === action));
      // Remove conflicting entry (same tag, opposite action) and add new
      return [...prev.filter((t) => t.id !== id), { id, name, color, action }];
    });
  };

  const handleSelectPlan = (plan: QueuedPlan) => {
    setQueuedPlan(plan);
    setActivePopover(null);
  };

  const handleCreatePlanAndQueue = async () => {
    if (!newPlanName.trim()) return;
    try {
      const plan = await createPlan.mutateAsync({
        name: newPlanName.trim(),
        color: newPlanColor,
        fiscalYear: getDefaultFiscalYear(),
      });
      setQueuedPlan({ id: plan.id, name: plan.name, color: plan.color || newPlanColor });
      setShowNewPlanForm(false);
      setNewPlanName("");
      setNewPlanColor(PLAN_COLORS[0].value);
      setActivePopover(null);
    } catch (error) {
      console.error("Failed to create plan:", error);
    }
  };

  const handleClearQueue = () => {
    setQueuedOwner(null);
    setQueuedTags([]);
    setQueuedPlan(null);
  };

  const handleDismiss = () => {
    handleClearQueue();
    setActivePopover(null);
    onClearSelection();
  };

  // ---- Apply all queued actions ----

  const handleApply = async () => {
    if (pendingCount === 0) return;
    setIsApplying(true);
    setActivePopover(null);

    try {
      const target = selectAllMatchingFilters ? { filters } : { leaids: selectedIds };
      const promises: Promise<unknown>[] = [];

      if (queuedOwner) {
        promises.push(batchEdit.mutateAsync({ ...target, owner: queuedOwner.name }));
      }
      for (const tag of queuedTags) {
        promises.push(batchTag.mutateAsync({ ...target, action: tag.action, tagId: tag.id }));
      }
      if (queuedPlan) {
        const planPayload = selectAllMatchingFilters
          ? { planId: queuedPlan.id, filters }
          : { planId: queuedPlan.id, leaids: selectedIds };
        promises.push(addToPlan.mutateAsync(planPayload));
      }

      await Promise.all(promises);
      // Wait for the explore data to refetch so rows show updated values
      // before clearing the selection and hiding the bar
      await queryClient.invalidateQueries({ queryKey: ["explore"] });
      handleClearQueue();
      onClearSelection();
    } catch (error) {
      console.error("Batch apply failed:", error);
    } finally {
      setIsApplying(false);
    }
  };

  // ---- Helpers ----

  const isTagQueued = (id: number, action: "add" | "remove") =>
    queuedTags.some((t) => t.id === id && t.action === action);

  if (selectedCount === 0 && !selectAllMatchingFilters) return null;

  return (
    <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-30 animate-slide-up">
      <div ref={barRef} className="flex flex-col items-center gap-1.5">

        {/* ---- Queued actions tray (appears above action bar) ---- */}
        {pendingCount > 0 && (
          <div className="queue-row-enter flex items-center gap-1.5 px-3 py-2 bg-white/95 backdrop-blur-md rounded-xl shadow-lg border border-gray-200/80">
            <div className="flex items-center gap-1.5 flex-wrap">

              {/* Owner chip */}
              {queuedOwner && (
                <span className="chip-pop inline-flex items-center gap-1.5 pl-2.5 pr-1 py-1 bg-[#403770]/[0.06] text-[#403770] rounded-full text-xs font-medium">
                  <svg width="11" height="11" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13" />
                  </svg>
                  {queuedOwner.display}
                  <button
                    onClick={() => setQueuedOwner(null)}
                    disabled={isApplying}
                    className="p-0.5 rounded-full hover:bg-[#403770]/10 text-[#403770]/40 hover:text-[#403770] transition-colors"
                  >
                    <ChipX />
                  </button>
                </span>
              )}

              {/* Tag chips */}
              {queuedTags.map((tag) => (
                <span
                  key={`${tag.action}-${tag.id}`}
                  className={`chip-pop inline-flex items-center gap-1.5 pl-1.5 pr-1 py-1 rounded-full text-xs font-medium ${
                    tag.action === "add"
                      ? "bg-emerald-50 text-emerald-700"
                      : "bg-red-50 text-red-600"
                  }`}
                >
                  <span
                    className="w-2 h-2 rounded-full shrink-0 ml-0.5"
                    style={{ backgroundColor: tag.color }}
                  />
                  <span className="opacity-50 text-[10px] -mr-0.5">{tag.action === "add" ? "+" : "\u2212"}</span>
                  {tag.name}
                  <button
                    onClick={() => setQueuedTags((p) => p.filter((t) => !(t.id === tag.id && t.action === tag.action)))}
                    disabled={isApplying}
                    className={`p-0.5 rounded-full transition-colors ${
                      tag.action === "add"
                        ? "hover:bg-emerald-100 text-emerald-400 hover:text-emerald-600"
                        : "hover:bg-red-100 text-red-300 hover:text-red-500"
                    }`}
                  >
                    <ChipX />
                  </button>
                </span>
              ))}

              {/* Plan chip */}
              {queuedPlan && (
                <span className="chip-pop inline-flex items-center gap-1.5 pl-1.5 pr-1 py-1 bg-[#403770]/[0.06] text-[#403770] rounded-full text-xs font-medium">
                  <span className="w-2 h-2 rounded-full shrink-0 ml-0.5" style={{ backgroundColor: queuedPlan.color }} />
                  <span className="opacity-40 text-[10px] -mr-0.5">&rarr;</span>
                  {queuedPlan.name}
                  <button
                    onClick={() => setQueuedPlan(null)}
                    disabled={isApplying}
                    className="p-0.5 rounded-full hover:bg-[#403770]/10 text-[#403770]/40 hover:text-[#403770] transition-colors"
                  >
                    <ChipX />
                  </button>
                </span>
              )}
            </div>

            {pendingCount > 1 && (
              <>
                <div className="w-px h-4 bg-gray-200 shrink-0" />
                <button
                  onClick={handleClearQueue}
                  disabled={isApplying}
                  className="text-[10px] text-gray-400 hover:text-gray-600 transition-colors whitespace-nowrap"
                >
                  Clear
                </button>
              </>
            )}

            <div className="w-px h-4 bg-gray-200 shrink-0" />

            {/* Apply button */}
            <button
              onClick={handleApply}
              disabled={isApplying}
              className="inline-flex items-center gap-1.5 px-3.5 py-1.5 bg-[#403770] text-white text-xs font-semibold rounded-full hover:bg-[#352d60] disabled:opacity-60 transition-all whitespace-nowrap shadow-sm hover:shadow-md"
            >
              {isApplying ? (
                <>
                  <svg className="animate-spin w-3 h-3" viewBox="0 0 16 16" fill="none">
                    <circle cx="8" cy="8" r="6" stroke="currentColor" strokeWidth="2" strokeDasharray="28" strokeDashoffset="8" strokeLinecap="round" />
                  </svg>
                  {"Applying\u2026"}
                </>
              ) : (
                <>
                  Apply
                  <span className="bg-white/20 text-[10px] px-1.5 py-0.5 rounded-full tabular-nums leading-none">
                    {pendingCount}
                  </span>
                </>
              )}
            </button>
          </div>
        )}

        {/* ---- Main action bar ---- */}
        <div className="flex items-center gap-3 px-4 py-2.5 bg-[#403770] text-white rounded-xl shadow-lg shadow-[#403770]/20 border border-[#403770]/80">

          {/* Count */}
          <span className="text-sm font-medium tabular-nums">
            {count.toLocaleString()} selected
          </span>

          {/* Select all matching */}
          {!selectAllMatchingFilters && totalMatching > selectedCount && (
            <button
              onClick={onSelectAllMatching}
              className="text-xs text-white/70 hover:text-white underline underline-offset-2 transition-colors"
            >
              Select all {totalMatching.toLocaleString()}
            </button>
          )}

          <div className="w-px h-5 bg-white/20" />

          {/* ---- Owner ---- */}
          <div className="relative">
            <button
              onClick={() => !isApplying && setActivePopover(activePopover === "owner" ? null : "owner")}
              disabled={isApplying}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
                queuedOwner
                  ? "bg-white/20 ring-1 ring-inset ring-white/25"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13" />
              </svg>
              Owner
              {queuedOwner && (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            {activePopover === "owner" && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden z-50">
                <div className="max-h-48 overflow-y-auto py-1">
                  <button
                    onClick={() => handleSelectOwner("", "Unassigned")}
                    className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                      queuedOwner?.name === "" ? "bg-[#403770]/5 text-[#403770] font-medium" : "text-gray-400 italic hover:bg-gray-50"
                    }`}
                  >
                    Unassigned
                    {queuedOwner?.name === "" && <Check />}
                  </button>
                  {(users || []).map((u: { id: string; fullName: string | null; email: string }) => {
                    const display = u.fullName || u.email;
                    const selected = queuedOwner?.name === display;
                    return (
                      <button
                        key={u.id}
                        onClick={() => handleSelectOwner(display, display)}
                        className={`w-full text-left px-3 py-2 text-sm transition-colors flex items-center justify-between ${
                          selected ? "bg-[#403770]/5 text-[#403770] font-medium" : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        {display}
                        {selected && <Check />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>

          {/* ---- Tags (multi-select — popover stays open) ---- */}
          <div className="relative">
            <button
              onClick={() => !isApplying && setActivePopover(activePopover === "tag" ? null : "tag")}
              disabled={isApplying}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
                queuedTags.length > 0
                  ? "bg-white/20 ring-1 ring-inset ring-white/25"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M2 8.5V3C2 2.4 2.4 2 3 2H8.5L14 7.5L8.5 13L2 8.5Z" />
                <circle cx="5.5" cy="5.5" r="1" fill="currentColor" />
              </svg>
              Tags
              {queuedTags.length > 0 && (
                <span className="bg-white/25 text-[10px] leading-none px-1.5 py-0.5 rounded-full tabular-nums">
                  {queuedTags.length}
                </span>
              )}
            </button>

            {activePopover === "tag" && (
              <div className="absolute bottom-full left-0 mb-2 w-56 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden z-50">
                <div className="max-h-64 overflow-y-auto">
                  {/* Add tag section */}
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Add tag
                  </div>
                  {(tags || []).map((tag: { id: number; name: string; color: string }) => {
                    const queued = isTagQueued(tag.id, "add");
                    return (
                      <button
                        key={`add-${tag.id}`}
                        onClick={() => handleToggleTag(tag.id, tag.name, tag.color, "add")}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                          queued
                            ? "bg-emerald-50/80 text-emerald-700 font-medium"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1">{tag.name}</span>
                        {queued && <Check className="text-emerald-500" />}
                      </button>
                    );
                  })}

                  <div className="border-t border-gray-100 my-1" />

                  {/* Remove tag section */}
                  <div className="px-3 pt-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-gray-400">
                    Remove tag
                  </div>
                  {(tags || []).map((tag: { id: number; name: string; color: string }) => {
                    const queued = isTagQueued(tag.id, "remove");
                    return (
                      <button
                        key={`rm-${tag.id}`}
                        onClick={() => handleToggleTag(tag.id, tag.name, tag.color, "remove")}
                        className={`w-full text-left px-3 py-1.5 text-sm flex items-center gap-2 transition-colors ${
                          queued
                            ? "bg-red-50/80 text-red-600 font-medium"
                            : "text-red-500/80 hover:bg-red-50/50 hover:text-red-600"
                        }`}
                      >
                        <span className="w-2.5 h-2.5 rounded-full shrink-0 opacity-60" style={{ backgroundColor: tag.color }} />
                        <span className="flex-1">{tag.name}</span>
                        {queued && <Check className="text-red-400" />}
                      </button>
                    );
                  })}

                  {(!tags || tags.length === 0) && (
                    <div className="px-3 py-3 text-xs text-gray-400 text-center">
                      No tags created yet
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* ---- Add to Plan ---- */}
          <div className="relative">
            <button
              onClick={() => {
                if (isApplying) return;
                setActivePopover(activePopover === "plan" ? null : "plan");
                setShowNewPlanForm(false);
                setNewPlanName("");
              }}
              disabled={isApplying}
              className={`flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-lg transition-all ${
                queuedPlan
                  ? "bg-white/20 ring-1 ring-inset ring-white/25"
                  : "bg-white/10 hover:bg-white/20"
              }`}
            >
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 2H10L13 5V14H3V2Z" />
                <path d="M8 8V12M6 10H10" />
              </svg>
              Plan
              {queuedPlan && (
                <span className="w-1.5 h-1.5 rounded-full bg-white" />
              )}
            </button>

            {activePopover === "plan" && (
              <div className="absolute bottom-full left-0 mb-2 w-64 bg-white rounded-lg border border-gray-200 shadow-xl overflow-hidden z-50">
                {showNewPlanForm ? (
                  <div className="p-3">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-xs font-semibold text-[#403770]">New Plan</span>
                      <button
                        onClick={() => { setShowNewPlanForm(false); setNewPlanName(""); }}
                        className="text-gray-400 hover:text-gray-600 transition-colors"
                      >
                        <svg width="12" height="12" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M3 3L11 11M11 3L3 11" />
                        </svg>
                      </button>
                    </div>
                    <input
                      ref={planInputRef}
                      type="text"
                      placeholder="Plan name"
                      value={newPlanName}
                      onChange={(e) => setNewPlanName(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleCreatePlanAndQueue();
                        if (e.key === "Escape") { setShowNewPlanForm(false); setNewPlanName(""); }
                      }}
                      className="w-full px-2.5 py-1.5 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent text-gray-700"
                    />
                    <div className="mt-2">
                      <label className="text-[10px] text-gray-400 mb-1 block">Color</label>
                      <div className="flex gap-1.5">
                        {PLAN_COLORS.map((c) => (
                          <button
                            key={c.value}
                            onClick={() => setNewPlanColor(c.value)}
                            className={`w-5 h-5 rounded-full transition-all ${
                              newPlanColor === c.value ? "ring-2 ring-offset-1 ring-[#403770]" : "hover:scale-110"
                            }`}
                            style={{ backgroundColor: c.value }}
                            title={c.name}
                          />
                        ))}
                      </div>
                    </div>
                    <button
                      onClick={handleCreatePlanAndQueue}
                      disabled={!newPlanName.trim() || createPlan.isPending}
                      className="w-full mt-3 px-3 py-1.5 text-xs font-medium text-white bg-[#403770] rounded-lg hover:bg-[#352d60] disabled:opacity-50 transition-colors"
                    >
                      {createPlan.isPending ? "Creating\u2026" : "Create & Add Districts"}
                    </button>
                  </div>
                ) : (
                  <>
                    <div className="max-h-48 overflow-y-auto">
                      {plans && plans.length > 0 ? (
                        plans.map((plan: TerritoryPlan) => {
                          const selected = queuedPlan?.id === plan.id;
                          return (
                            <button
                              key={plan.id}
                              onClick={() => handleSelectPlan({ id: plan.id, name: plan.name, color: plan.color })}
                              className={`w-full text-left px-3 py-2 flex items-center gap-2 transition-colors ${
                                selected ? "bg-[#403770]/5" : "hover:bg-gray-50"
                              }`}
                            >
                              <span className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: plan.color }} />
                              <div className="flex-1 min-w-0">
                                <p className={`text-sm truncate ${selected ? "text-[#403770] font-medium" : "text-gray-700"}`}>{plan.name}</p>
                                <p className="text-[10px] text-gray-400">
                                  {plan.districtCount} district{plan.districtCount !== 1 ? "s" : ""}
                                </p>
                              </div>
                              {selected && <Check />}
                            </button>
                          );
                        })
                      ) : (
                        <div className="px-3 py-4 text-xs text-gray-400 text-center">
                          No plans yet
                        </div>
                      )}
                    </div>
                    <div className="border-t border-gray-100">
                      <button
                        onClick={() => setShowNewPlanForm(true)}
                        className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#403770] hover:bg-gray-50 transition-colors"
                      >
                        <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
                          <path d="M8 4V12M4 8H12" />
                        </svg>
                        Create new plan
                      </button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>

          <div className="w-px h-5 bg-white/20" />

          {/* Dismiss */}
          <button
            onClick={handleDismiss}
            disabled={isApplying}
            className="p-1 text-white/60 hover:text-white transition-colors"
            title="Clear selection"
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round">
              <path d="M3 3L11 11M11 3L3 11" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}

// Shared check icon
function Check({ className = "text-[#403770]" }: { className?: string }) {
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" className={`shrink-0 ${className}`} stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 7L6 10L11 4" />
    </svg>
  );
}
