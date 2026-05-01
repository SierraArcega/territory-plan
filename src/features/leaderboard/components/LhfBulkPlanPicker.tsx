"use client";

import { useEffect, useState, type RefObject } from "react";
import { X, ArrowLeft, SkipForward, Plus } from "lucide-react";
import type { IncreaseTarget, IncreaseTargetBucket } from "../lib/types";
import { useMyPlans, useAddDistrictToPlanMutation } from "../lib/queries";
import { useCreateTerritoryPlan } from "@/features/plans/lib/queries";
import { formatCurrency } from "@/features/shared/lib/format";

interface Props {
  districts: IncreaseTarget[];
  /** Unused — kept for call-site compatibility (the wizard is a centered modal). */
  anchorRef?: RefObject<HTMLButtonElement | null>;
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (planName: string, addedCount: number) => void;
}

const TARGET_FY = 2027;

const BUCKETS: { value: IncreaseTargetBucket; label: string }[] = [
  { value: "renewal", label: "Renewal" },
  { value: "winback", label: "Winback" },
  { value: "expansion", label: "Expansion" },
  { value: "newBusiness", label: "New Business" },
];

function defaultBucket(cat: IncreaseTarget["category"]): IncreaseTargetBucket {
  return cat === "missing_renewal" ? "renewal" : "winback";
}

export default function LhfBulkPlanPicker({
  districts,
  isOpen,
  onClose,
  onSuccess,
}: Props) {
  const plansQuery = useMyPlans();
  const addMutation = useAddDistrictToPlanMutation();
  const createMutation = useCreateTerritoryPlan();

  const [stepIdx, setStepIdx] = useState(0);
  const [planId, setPlanId] = useState<string>("");
  const [bucket, setBucket] = useState<IncreaseTargetBucket>(() =>
    districts[0] ? defaultBucket(districts[0].category) : "renewal",
  );
  const [target, setTarget] = useState<string>(() =>
    districts[0]?.suggestedTarget != null ? String(districts[0].suggestedTarget) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);
  const [namingNew, setNamingNew] = useState(false);
  const [newName, setNewName] = useState("");

  const row = districts[stepIdx];
  const total = districts.length;
  const isLast = stepIdx === total - 1;

  const fy27Plans = (plansQuery.data ?? []).filter((p) => p.fiscalYear === TARGET_FY);
  const selectedPlanName = fy27Plans.find((p) => p.id === planId)?.name ?? null;

  // Reset everything on open.
  useEffect(() => {
    if (!isOpen) return;
    setStepIdx(0);
    setPlanId("");
    setAddedCount(0);
    setError(null);
    setNamingNew(false);
    setNewName("");
  }, [isOpen]);

  // Per-step defaults (bucket + target follow each row).
  useEffect(() => {
    if (!isOpen || !row) return;
    setError(null);
    setBucket(defaultBucket(row.category));
    setTarget(row.suggestedTarget != null ? String(row.suggestedTarget) : "");
  }, [isOpen, stepIdx, row]);

  // Escape closes.
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.stopPropagation();
        onClose();
      }
    };
    document.addEventListener("keydown", onKey, true);
    return () => document.removeEventListener("keydown", onKey, true);
  }, [isOpen, onClose]);

  if (!isOpen || !row) return null;

  const targetNum = Number(target);
  const isPending = addMutation.isPending || createMutation.isPending;
  const canSubmit =
    !!planId && Number.isFinite(targetNum) && targetNum > 0 && !isPending;

  const finish = (added: number) => {
    if (added > 0 && selectedPlanName) {
      onSuccess(selectedPlanName, added);
    } else {
      onClose();
    }
  };

  const advance = (added: number) => {
    if (isLast) {
      finish(added);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !row) return;
    try {
      await addMutation.mutateAsync({
        planId,
        leaid: row.leaid,
        bucket,
        targetAmount: targetNum,
      });
      const next = addedCount + 1;
      setAddedCount(next);
      advance(next);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add. Try again.");
    }
  };

  const handleSkip = () => {
    if (isLast) {
      finish(addedCount);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  const handleCreatePlan = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isPending) return;
    const trimmed = newName.trim();
    if (!trimmed) return;
    setError(null);
    try {
      const created = await createMutation.mutateAsync({
        name: trimmed,
        fiscalYear: TARGET_FY,
      });
      setPlanId(created.id);
      setNamingNew(false);
      setNewName("");
    } catch {
      setError("Couldn't create the plan. Try again.");
    }
  };

  return (
    <div
      role="dialog"
      aria-labelledby="bulk-wizard-title"
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        aria-hidden
      />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-[#E2DEEC]">
          <h2 id="bulk-wizard-title" className="text-sm font-bold text-[#403770]">
            Add to plan
          </h2>
          <div className="flex items-center gap-3 text-xs text-[#8A80A8]">
            <span className="tabular-nums">
              Step {stepIdx + 1} of {total}
            </span>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              className="p-1 rounded hover:bg-[#EFEDF5]"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-base font-bold text-[#403770]">
              {row.districtName}
            </div>
            <div className="text-xs text-[#8A80A8]">
              {row.state} ·{" "}
              {formatCurrency(
                row.category === "missing_renewal"
                  ? row.fy26Revenue
                  : row.priorYearRevenue,
                true,
              )}{" "}
              {row.category === "missing_renewal"
                ? "FY26"
                : row.priorYearFy ?? "prior"}
            </div>
          </div>

          {/* Plan select OR new-plan name input */}
          {namingNew ? (
            <form onSubmit={handleCreatePlan} className="space-y-2">
              <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
                New FY27 plan name
              </label>
              <div className="flex items-center gap-2">
                <input
                  autoFocus
                  type="text"
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  placeholder="FY27 · "
                  disabled={isPending}
                  className="flex-1 px-3 py-2 rounded-lg border border-[#C2BBD4] text-sm text-[#403770] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40"
                />
                <button
                  type="submit"
                  disabled={isPending || !newName.trim()}
                  className="px-3 py-2 rounded-lg text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50"
                >
                  Create
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setNamingNew(false);
                    setNewName("");
                  }}
                  disabled={isPending}
                  className="text-xs font-semibold text-[#6E6390] hover:text-[#403770] disabled:opacity-50"
                >
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <div>
              <div className="flex items-center justify-between mb-1">
                <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
                  Plan
                </label>
                <button
                  type="button"
                  onClick={() => setNamingNew(true)}
                  className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#403770] hover:underline"
                >
                  <Plus className="w-3 h-3" />
                  New plan…
                </button>
              </div>
              <select
                value={planId}
                onChange={(e) => setPlanId(e.target.value)}
                className="w-full px-3 py-2 rounded-lg border border-[#C2BBD4] text-sm text-[#403770]"
                disabled={plansQuery.isLoading || fy27Plans.length === 0}
              >
                <option value="">
                  {fy27Plans.length === 0
                    ? "No FY27 plans — create one"
                    : "Select a plan…"}
                </option>
                {fy27Plans.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
              Type
            </label>
            <div className="flex flex-wrap gap-3">
              {BUCKETS.map((b) => (
                <label
                  key={b.value}
                  className="flex items-center gap-1.5 text-xs text-[#6E6390] cursor-pointer"
                >
                  <input
                    type="radio"
                    name="bulk-bucket"
                    checked={bucket === b.value}
                    onChange={() => setBucket(b.value)}
                    className="w-3.5 h-3.5"
                    style={{ accentColor: "#403770" }}
                  />
                  <span>{b.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label
              htmlFor="bulk-target-input"
              className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1"
            >
              Target
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A80A8]">
                  $
                </span>
                <input
                  id="bulk-target-input"
                  type="text"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) =>
                    setTarget(e.target.value.replace(/[^\d.]/g, ""))
                  }
                  className="w-full pl-6 pr-3 py-2 rounded-lg border border-[#C2BBD4] text-sm text-[#403770] tabular-nums"
                />
              </div>
              {row.suggestedTarget != null && (
                <span className="text-xs text-[#8A80A8] whitespace-nowrap">
                  Suggested: {formatCurrency(row.suggestedTarget, true)}
                </span>
              )}
            </div>
            {error && (
              <div className="mt-1 text-xs text-[#B5453D]" role="alert">
                {error}
              </div>
            )}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#E2DEEC] bg-[#F7F5FA]">
          <button
            type="button"
            disabled={stepIdx === 0 || isPending}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E6390] hover:text-[#403770] disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              disabled={isPending}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-[#6E6390] hover:bg-[#EFEDF5] disabled:opacity-40"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip this one
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {isPending && (
                <span
                  className="w-3 h-3 border-2 border-white border-t-transparent rounded-full animate-spin"
                  aria-hidden
                />
              )}
              {isPending
                ? "Adding…"
                : isLast
                  ? "Add & finish"
                  : "Add & continue →"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
