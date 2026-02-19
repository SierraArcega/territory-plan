"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useFocusModeData } from "@/lib/api";
import TrajectoryCard from "./TrajectoryCard";
import FootprintCard from "./FootprintCard";
import YoYCard from "./YoYCard";

export default function FocusModeOverlay() {
  const focusPlanId = useMapV2Store((s) => s.focusPlanId);
  const { data, isLoading } = useFocusModeData(focusPlanId);

  // Track which cards are dismissed
  const [dismissed, setDismissed] = useState<Set<string>>(new Set());

  // State selector (synced between footprint + yoy)
  const [selectedState, setSelectedState] = useState<string>("");

  // Set default selected state when data loads
  const defaultState = data?.states[0]?.abbrev || "";
  const activeState = selectedState || defaultState;

  // Reset dismissed cards when focus changes
  const [lastPlanId, setLastPlanId] = useState<string | null>(null);
  if (focusPlanId !== lastPlanId) {
    setLastPlanId(focusPlanId);
    setDismissed(new Set());
    setSelectedState("");
  }

  if (!focusPlanId || !data || isLoading) return null;

  const dismiss = (card: string) => {
    setDismissed((prev) => new Set(prev).add(card));
  };

  return (
    <>
      {/* Top right — FY Trajectory */}
      {!dismissed.has("trajectory") && (
        <div className="absolute top-4 right-4 z-[8]">
          <TrajectoryCard
            states={data.states}
            onDismiss={() => dismiss("trajectory")}
          />
        </div>
      )}

      {/* Bottom left — stacked: Footprint + YoY */}
      <div className="absolute bottom-4 left-[396px] z-[8] flex flex-col gap-2">
        {!dismissed.has("footprint") && (
          <FootprintCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("footprint")}
          />
        )}
        {!dismissed.has("yoy") && (
          <YoYCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("yoy")}
          />
        )}
      </div>
    </>
  );
}
