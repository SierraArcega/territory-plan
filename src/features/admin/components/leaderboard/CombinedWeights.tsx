"use client";

import { useState, useEffect, useMemo } from "react";
import { Check, AlertTriangle } from "lucide-react";
import CollapsibleSection from "./CollapsibleSection";
import PreviewConfirmModal from "./PreviewConfirmModal";
import {
  useUpdateWeights,
  usePreviewChanges,
} from "@/features/admin/hooks/useAdminLeaderboard";
import type { AdminInitiativeConfig } from "@/features/admin/lib/leaderboard-types";

interface CombinedWeightsProps {
  config: AdminInitiativeConfig;
}

export default function CombinedWeights({ config }: CombinedWeightsProps) {
  const { initiative } = config;

  const [initiativeWeight, setInitiativeWeight] = useState(Math.round(initiative.initiativeWeight * 100));
  const [pipelineWeight, setPipelineWeight] = useState(Math.round(initiative.pipelineWeight * 100));
  const [takeWeight, setTakeWeight] = useState(Math.round(initiative.takeWeight * 100));
  const [revenueWeight, setRevenueWeight] = useState(Math.round(initiative.revenueWeight * 100));
  const [revenueTargetedWeight, setRevenueTargetedWeight] = useState(Math.round(initiative.revenueTargetedWeight * 100));
  const [pipelineFY, setPipelineFY] = useState(initiative.pipelineFiscalYear ?? "");
  const [takeFY, setTakeFY] = useState(initiative.takeFiscalYear ?? "");
  const [revenueFY, setRevenueFY] = useState(initiative.revenueFiscalYear ?? "");
  const [revenueTargetedFY, setRevenueTargetedFY] = useState(initiative.revenueTargetedFiscalYear ?? "");
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setInitiativeWeight(Math.round(initiative.initiativeWeight * 100));
    setPipelineWeight(Math.round(initiative.pipelineWeight * 100));
    setTakeWeight(Math.round(initiative.takeWeight * 100));
    setRevenueWeight(Math.round(initiative.revenueWeight * 100));
    setRevenueTargetedWeight(Math.round(initiative.revenueTargetedWeight * 100));
    setPipelineFY(initiative.pipelineFiscalYear ?? "");
    setTakeFY(initiative.takeFiscalYear ?? "");
    setRevenueFY(initiative.revenueFiscalYear ?? "");
    setRevenueTargetedFY(initiative.revenueTargetedFiscalYear ?? "");
  }, [initiative]);

  const fyOptions = useMemo(() => {
    const now = new Date();
    const currentFY = now.getMonth() >= 6 ? now.getFullYear() + 1 : now.getFullYear();
    return Array.from({ length: 5 }, (_, i) => {
      const fy = currentFY - 2 + i;
      return { value: `${fy - 1}-${String(fy).slice(-2)}`, label: `FY${String(fy).slice(-2)}` };
    });
  }, []);

  const sum = initiativeWeight + pipelineWeight + takeWeight + revenueWeight + revenueTargetedWeight;
  const isValid = sum === 100;

  const updateMutation = useUpdateWeights();
  const previewMutation = usePreviewChanges();

  const payload = {
    initiativeWeight: initiativeWeight / 100,
    pipelineWeight: pipelineWeight / 100,
    takeWeight: takeWeight / 100,
    revenueWeight: revenueWeight / 100,
    revenueTargetedWeight: revenueTargetedWeight / 100,
    pipelineFiscalYear: pipelineFY || null,
    takeFiscalYear: takeFY || null,
    revenueFiscalYear: revenueFY || null,
    revenueTargetedFiscalYear: revenueTargetedFY || null,
  };

  const handleSave = () => {
    previewMutation.mutate(
      { section: "weights", data: payload },
      { onSuccess: () => setShowPreview(true) }
    );
  };

  const handleConfirm = () => {
    updateMutation.mutate(payload, { onSuccess: () => setShowPreview(false) });
  };

  const sliders: {
    label: string;
    value: number;
    onChange: (v: number) => void;
    fy?: { value: string; onChange: (v: string) => void };
  }[] = [
    { label: "Initiative Points", value: initiativeWeight, onChange: setInitiativeWeight },
    { label: "Pipeline", value: pipelineWeight, onChange: setPipelineWeight, fy: { value: pipelineFY, onChange: setPipelineFY } },
    { label: "Take", value: takeWeight, onChange: setTakeWeight, fy: { value: takeFY, onChange: setTakeFY } },
    { label: "Revenue", value: revenueWeight, onChange: setRevenueWeight, fy: { value: revenueFY, onChange: setRevenueFY } },
    { label: "Revenue Targeted", value: revenueTargetedWeight, onChange: setRevenueTargetedWeight, fy: { value: revenueTargetedFY, onChange: setRevenueTargetedFY } },
  ];

  return (
    <>
      <CollapsibleSection title="Combined Score Weights">
        <div className="space-y-6">
          {sliders.map((s) => (
            <div key={s.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <label className="text-sm font-medium text-[#6E6390]">{s.label}</label>
                  {s.fy && (
                    <select
                      value={s.fy.value}
                      onChange={(e) => s.fy!.onChange(e.target.value)}
                      className="px-2 py-0.5 text-xs border border-[#D4CFE2] rounded text-[#6E6390] bg-white focus:border-[#403770] outline-none"
                    >
                      <option value="">Current FY</option>
                      {fyOptions.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                      ))}
                    </select>
                  )}
                </div>
                <span className="text-sm font-semibold text-[#403770]">{s.value}%</span>
              </div>
              <input
                type="range"
                min={0}
                max={100}
                value={s.value}
                onChange={(e) => s.onChange(parseInt(e.target.value))}
                className="w-full h-2 rounded-full appearance-none cursor-pointer"
                style={{
                  background: `linear-gradient(to right, #403770 ${s.value}%, #E2DEEC ${s.value}%)`,
                }}
              />
            </div>
          ))}

          <div
            className={`flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium ${
              isValid ? "bg-[#F7FFF2] text-[#69B34A]" : "bg-[#fffaf1] text-[#FFCF70]"
            }`}
          >
            {isValid ? (
              <Check className="w-4 h-4" />
            ) : (
              <AlertTriangle className="w-4 h-4" />
            )}
            Total: {sum}%{!isValid && " (must equal 100%)"}
          </div>

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={!isValid || previewMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {previewMutation.isPending ? "Loading preview..." : "Save Changes"}
            </button>
          </div>
        </div>
      </CollapsibleSection>

      <PreviewConfirmModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        onConfirm={handleConfirm}
        preview={previewMutation.data ?? null}
        isLoading={previewMutation.isPending}
        isSaving={updateMutation.isPending}
      />
    </>
  );
}
