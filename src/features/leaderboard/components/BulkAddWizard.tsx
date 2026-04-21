"use client";

import { useEffect, useState } from "react";
import { X, ArrowLeft, SkipForward } from "lucide-react";
import type { IncreaseTarget, IncreaseTargetBucket } from "../lib/types";
import { useMyPlans, useAddDistrictToPlanMutation } from "../lib/queries";
import { formatCurrency } from "@/features/shared/lib/format";

interface Props {
  rows: IncreaseTarget[];
  onClose: () => void;
  /** Called after the wizard finishes (exhausted all rows or user closes). */
  onFinish: (addedCount: number, planName: string | null) => void;
}

const BUCKETS: { value: IncreaseTargetBucket; label: string }[] = [
  { value: "renewal", label: "Renewal" },
  { value: "winback", label: "Winback" },
  { value: "expansion", label: "Expansion" },
  { value: "newBusiness", label: "New Business" },
];

function defaultBucket(cat: IncreaseTarget["category"]): IncreaseTargetBucket {
  return cat === "missing_renewal" ? "renewal" : "winback";
}

export default function BulkAddWizard({ rows, onClose, onFinish }: Props) {
  const plansQuery = useMyPlans();
  const mutation = useAddDistrictToPlanMutation();

  const [stepIdx, setStepIdx] = useState(0);
  const [planId, setPlanId] = useState<string>("");
  const [bucket, setBucket] = useState<IncreaseTargetBucket>(() =>
    rows[0] ? defaultBucket(rows[0].category) : "renewal",
  );
  const [target, setTarget] = useState<string>(() =>
    rows[0]?.suggestedTarget != null ? String(rows[0].suggestedTarget) : "",
  );
  const [error, setError] = useState<string | null>(null);
  const [addedCount, setAddedCount] = useState(0);

  const row = rows[stepIdx];
  const total = rows.length;
  const isLast = stepIdx === total - 1;

  useEffect(() => {
    setError(null);
    setTarget(row?.suggestedTarget != null ? String(row.suggestedTarget) : "");
    if (stepIdx === 0 && row) setBucket(defaultBucket(row.category));
  }, [stepIdx, row]);

  const targetNum = Number(target);
  const canSubmit = !!planId && Number.isFinite(targetNum) && targetNum > 0 && !mutation.isPending;

  const plans = plansQuery.data ?? [];
  const selectedPlanName = plans.find((p) => p.id === planId)?.name ?? null;

  const advance = () => {
    if (isLast) {
      onFinish(addedCount + 1, selectedPlanName);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  const handleSubmit = async () => {
    if (!canSubmit || !row) return;
    try {
      await mutation.mutateAsync({
        planId,
        leaid: row.leaid,
        bucket,
        targetAmount: targetNum,
      });
      setAddedCount((c) => c + 1);
      advance();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't add. Try again.");
    }
  };

  const handleSkip = () => {
    if (isLast) {
      onFinish(addedCount, selectedPlanName);
      return;
    }
    setStepIdx((i) => i + 1);
  };

  if (!row) return null;

  return (
    <div role="dialog" aria-labelledby="wizard-title" className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/40" onClick={onClose} aria-hidden />
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-xl overflow-hidden">
        <header className="flex items-center justify-between px-5 py-3 border-b border-[#E2DEEC]">
          <h2 id="wizard-title" className="text-sm font-bold text-[#403770]">Add to plan</h2>
          <div className="flex items-center gap-3 text-xs text-[#8A80A8]">
            <span>Step {stepIdx + 1} of {total}</span>
            <button type="button" onClick={onClose} aria-label="Close" className="p-1 rounded hover:bg-[#EFEDF5]">
              <X className="w-4 h-4" />
            </button>
          </div>
        </header>

        <div className="p-5 space-y-4">
          <div>
            <div className="text-base font-bold text-[#403770]">{row.districtName}</div>
            <div className="text-xs text-[#8A80A8]">
              {row.state} · {formatCurrency(row.category === "missing_renewal" ? row.fy26Revenue : row.priorYearRevenue, true)}{" "}
              {row.category === "missing_renewal" ? "FY26" : row.priorYearFy ?? "prior"}
            </div>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">Plan</label>
            <select
              value={planId}
              onChange={(e) => setPlanId(e.target.value)}
              className="w-full px-3 py-2 rounded-lg border border-[#C2BBD4] text-sm text-[#403770]"
              disabled={plansQuery.isLoading || plans.length === 0}
            >
              <option value="">
                {plans.length === 0 ? "You have no plans — create one first." : "Select a plan…"}
              </option>
              {plans.map((p) => (
                <option key={p.id} value={p.id}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">Type</label>
            <div className="flex flex-wrap gap-3">
              {BUCKETS.map((b) => (
                <label key={b.value} className="flex items-center gap-1.5 text-xs text-[#6E6390] cursor-pointer">
                  <input
                    type="radio"
                    name="bucket"
                    checked={bucket === b.value}
                    onChange={() => setBucket(b.value)}
                    className="w-3.5 h-3.5"
                  />
                  <span>{b.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label htmlFor="target-input" className="block text-[10px] uppercase tracking-wider font-bold text-[#8A80A8] mb-1">
              Target
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 relative">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#8A80A8]">$</span>
                <input
                  id="target-input"
                  type="text"
                  inputMode="decimal"
                  value={target}
                  onChange={(e) => setTarget(e.target.value.replace(/[^\d.]/g, ""))}
                  className="w-full pl-6 pr-3 py-2 rounded-lg border border-[#C2BBD4] text-sm text-[#403770] tabular-nums"
                />
              </div>
              {row.suggestedTarget != null && (
                <span className="text-xs text-[#8A80A8]">
                  Suggested: {formatCurrency(row.suggestedTarget, true)}
                </span>
              )}
            </div>
            {error && <div className="mt-1 text-xs text-[#B5453D]">{error}</div>}
          </div>
        </div>

        <footer className="flex items-center justify-between gap-2 px-5 py-3 border-t border-[#E2DEEC] bg-[#F7F5FA]">
          <button
            type="button"
            disabled={stepIdx === 0}
            onClick={() => setStepIdx((i) => Math.max(0, i - 1))}
            className="inline-flex items-center gap-1 text-xs font-semibold text-[#6E6390] hover:text-[#403770] disabled:opacity-40"
          >
            <ArrowLeft className="w-3.5 h-3.5" /> Back
          </button>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleSkip}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-[#6E6390] hover:bg-[#EFEDF5]"
            >
              <SkipForward className="w-3.5 h-3.5" /> Skip this one
            </button>
            <button
              type="button"
              disabled={!canSubmit}
              onClick={handleSubmit}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              {mutation.isPending ? "Adding…" : isLast ? "Add & finish" : "Add & continue →"}
            </button>
          </div>
        </footer>
      </div>
    </div>
  );
}
