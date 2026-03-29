"use client";

import { useState, useEffect } from "react";
import { Check, AlertTriangle } from "lucide-react";
import CollapsibleSection from "./CollapsibleSection";
import PreviewConfirmModal from "./PreviewConfirmModal";
import {
  useUpdateWeights,
  usePreviewChanges,
} from "@/features/admin/hooks/useAdminLeaderboard";
import type { AdminSeasonConfig } from "@/features/admin/lib/leaderboard-types";

interface CombinedWeightsProps {
  config: AdminSeasonConfig;
}

export default function CombinedWeights({ config }: CombinedWeightsProps) {
  const { season } = config;

  const [seasonWeight, setSeasonWeight] = useState(Math.round(season.seasonWeight * 100));
  const [pipelineWeight, setPipelineWeight] = useState(Math.round(season.pipelineWeight * 100));
  const [takeWeight, setTakeWeight] = useState(Math.round(season.takeWeight * 100));
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setSeasonWeight(Math.round(season.seasonWeight * 100));
    setPipelineWeight(Math.round(season.pipelineWeight * 100));
    setTakeWeight(Math.round(season.takeWeight * 100));
  }, [season]);

  const sum = seasonWeight + pipelineWeight + takeWeight;
  const isValid = sum === 100;

  const updateMutation = useUpdateWeights();
  const previewMutation = usePreviewChanges();

  const payload = {
    seasonWeight: seasonWeight / 100,
    pipelineWeight: pipelineWeight / 100,
    takeWeight: takeWeight / 100,
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

  const sliders = [
    { label: "Season Points", value: seasonWeight, onChange: setSeasonWeight },
    { label: "Pipeline", value: pipelineWeight, onChange: setPipelineWeight },
    { label: "Take", value: takeWeight, onChange: setTakeWeight },
  ];

  return (
    <>
      <CollapsibleSection title="Combined Score Weights">
        <div className="space-y-6">
          {sliders.map((s) => (
            <div key={s.label} className="space-y-2">
              <div className="flex items-center justify-between">
                <label className="text-sm font-medium text-[#6E6390]">{s.label}</label>
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
