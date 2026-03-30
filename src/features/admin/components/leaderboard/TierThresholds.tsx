"use client";

import { useState, useEffect } from "react";
import CollapsibleSection from "./CollapsibleSection";
import PreviewConfirmModal from "./PreviewConfirmModal";
import { useUpdateTiers, usePreviewChanges } from "@/features/admin/hooks/useAdminLeaderboard";
import { TIER_LABELS, TIER_COLORS } from "@/features/leaderboard/lib/types";
import type { AdminInitiativeConfig } from "@/features/admin/lib/leaderboard-types";

interface TierThresholdsProps {
  config: AdminInitiativeConfig;
}

const TIER_ORDER = ["valedictorian", "deans_list", "honor_roll", "freshman"] as const;

const TIER_GRADIENTS: Record<string, string> = {
  valedictorian: "from-[#FFF8EE] to-[#FFF1D6]",
  deans_list: "from-[#EEF4F9] to-[#E0EDF5]",
  honor_roll: "from-[#FEF2F1] to-[#FCE5E3]",
  freshman: "from-[#F7F5FA] to-[#EFEDF5]",
};

export default function TierThresholds({ config }: TierThresholdsProps) {
  const [thresholds, setThresholds] = useState(
    TIER_ORDER.map((tier) => {
      const existing = config.thresholds.find((t) => t.tier === tier);
      return { tier, minPoints: existing?.minPoints ?? 0 };
    })
  );
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setThresholds(
      TIER_ORDER.map((tier) => {
        const existing = config.thresholds.find((t) => t.tier === tier);
        return { tier, minPoints: existing?.minPoints ?? 0 };
      })
    );
  }, [config.thresholds]);

  const updateMutation = useUpdateTiers();
  const previewMutation = usePreviewChanges();

  const handleSave = () => {
    previewMutation.mutate(
      { section: "tiers", data: { thresholds } },
      { onSuccess: () => setShowPreview(true) }
    );
  };

  const handleConfirm = () => {
    updateMutation.mutate({ thresholds }, { onSuccess: () => setShowPreview(false) });
  };

  return (
    <>
      <CollapsibleSection title="Tier Thresholds">
        <div className="space-y-3">
          {thresholds.map((t) => {
            const colors = TIER_COLORS[t.tier as keyof typeof TIER_COLORS];
            const gradient = TIER_GRADIENTS[t.tier];
            const repCount = config.repCounts[t.tier] ?? 0;
            const isFreshman = t.tier === "freshman";

            return (
              <div
                key={t.tier}
                className={`flex items-center justify-between px-5 py-4 rounded-xl bg-gradient-to-r ${gradient} border border-[#E2DEEC]`}
              >
                <div className="flex items-center gap-3">
                  <div
                    className="w-8 h-8 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: colors?.bg, color: colors?.text }}
                  >
                    {TIER_LABELS[t.tier as keyof typeof TIER_LABELS]?.[0] ?? "?"}
                  </div>
                  <div>
                    <div className="text-sm font-semibold text-[#403770]">
                      {TIER_LABELS[t.tier as keyof typeof TIER_LABELS] ?? t.tier}
                    </div>
                    <div className="text-xs text-[#8A80A8]">
                      {repCount} rep{repCount !== 1 ? "s" : ""}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  {isFreshman ? (
                    <span className="text-sm text-[#A69DC0]">0 pts (fixed)</span>
                  ) : (
                    <>
                      <input
                        type="number"
                        value={t.minPoints}
                        onChange={(e) => {
                          const val = parseInt(e.target.value) || 0;
                          setThresholds(
                            thresholds.map((th) =>
                              th.tier === t.tier ? { ...th, minPoints: val } : th
                            )
                          );
                        }}
                        className="w-24 px-2 py-1 text-sm text-right border border-[#C2BBD4] rounded text-[#403770] focus:border-[#403770] focus:ring-1 focus:ring-[#403770]/30 outline-none"
                      />
                      <span className="text-sm text-[#8A80A8]">pts</span>
                    </>
                  )}
                </div>
              </div>
            );
          })}

          <div className="pt-2">
            <button
              onClick={handleSave}
              disabled={previewMutation.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50"
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
