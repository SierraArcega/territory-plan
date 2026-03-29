"use client";

import { useState, useEffect, useMemo } from "react";
import { Minus, Plus } from "lucide-react";
import CollapsibleSection from "./CollapsibleSection";
import PreviewConfirmModal from "./PreviewConfirmModal";
import {
  useUpdateTransition,
  usePreviewChanges,
} from "@/features/admin/hooks/useAdminLeaderboard";
import { TIER_LABELS } from "@/features/leaderboard/lib/types";
import type { AdminSeasonConfig } from "@/features/admin/lib/leaderboard-types";

interface SeasonTransitionProps {
  config: AdminSeasonConfig;
}

const TIER_ORDER = ["freshman", "honor_roll", "deans_list", "valedictorian"] as const;

export default function SeasonTransition({ config }: SeasonTransitionProps) {
  const [depth, setDepth] = useState(config.season.softResetTiers);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    setDepth(config.season.softResetTiers);
  }, [config.season.softResetTiers]);

  const updateMutation = useUpdateTransition();
  const previewMutation = usePreviewChanges();

  const transitions = useMemo(() => {
    return TIER_ORDER.map((tier) => {
      const currentIdx = TIER_ORDER.indexOf(tier);
      const newIdx = Math.max(0, currentIdx - depth);
      const newTier = TIER_ORDER[newIdx];
      return {
        from: TIER_LABELS[tier] ?? tier,
        to: TIER_LABELS[newTier] ?? newTier,
        changed: tier !== newTier,
      };
    }).reverse();
  }, [depth]);

  const handleSave = () => {
    previewMutation.mutate(
      { section: "transition", data: { softResetTiers: depth } },
      { onSuccess: () => setShowPreview(true) }
    );
  };

  const handleConfirm = () => {
    updateMutation.mutate({ softResetTiers: depth }, { onSuccess: () => setShowPreview(false) });
  };

  return (
    <>
      <CollapsibleSection title="Season Transition">
        <div className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-[#6E6390] mb-3">
              Soft Reset Depth
            </label>
            <div className="flex items-center gap-4">
              <button
                onClick={() => setDepth(Math.max(0, depth - 1))}
                disabled={depth <= 0}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#C2BBD4] text-[#6E6390] hover:bg-[#F7F5FA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Minus className="w-4 h-4" />
              </button>
              <span className="text-2xl font-bold text-[#403770] w-8 text-center">{depth}</span>
              <button
                onClick={() => setDepth(Math.min(3, depth + 1))}
                disabled={depth >= 3}
                className="w-9 h-9 flex items-center justify-center rounded-lg border border-[#C2BBD4] text-[#6E6390] hover:bg-[#F7F5FA] disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
              <span className="text-sm text-[#8A80A8]">
                tier{depth !== 1 ? "s" : ""} dropped per rep
              </span>
            </div>
          </div>

          <div>
            <h4 className="text-sm font-medium text-[#6E6390] mb-2">Transition Preview</h4>
            <div className="space-y-2">
              {transitions.map((t) => (
                <div
                  key={t.from}
                  className={`flex items-center gap-3 px-4 py-2 rounded-lg text-sm ${
                    t.changed ? "bg-[#fffaf1] border border-[#ffd98d]" : "bg-[#F7F5FA]"
                  }`}
                >
                  <span
                    className={t.changed ? "text-[#403770] font-medium" : "text-[#8A80A8]"}
                  >
                    {t.from}
                  </span>
                  <span className="text-[#A69DC0]">&rarr;</span>
                  <span
                    className={t.changed ? "text-[#403770] font-medium" : "text-[#8A80A8]"}
                  >
                    {t.to}
                  </span>
                </div>
              ))}
            </div>
          </div>

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
