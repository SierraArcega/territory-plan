"use client";

import { useState } from "react";
import { useMapV2Store } from "@/lib/map-v2-store";
import { useFocusModeData } from "@/lib/api";
import AnimatedCard from "./AnimatedCard";
import RevenueTrendCard from "./RevenueTrendCard";
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
      {/* Top right — Revenue Trend (Uniswap-style area chart) */}
      {!dismissed.has("trend") && (
        <AnimatedCard
          from="right"
          delay={0}
          className="absolute top-4 right-4 z-[8]"
        >
          <RevenueTrendCard
            states={data.states}
            onDismiss={() => dismiss("trend")}
            animationDelay={600}
          />
        </AnimatedCard>
      )}

      {/* Bottom left — Territory Footprint */}
      {!dismissed.has("footprint") && (
        <AnimatedCard
          from="left"
          delay={150}
          className="absolute bottom-4 left-[396px] z-[8]"
        >
          <FootprintCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("footprint")}
            animationDelay={750}
          />
        </AnimatedCard>
      )}

      {/* Bottom right — YoY Performance */}
      {!dismissed.has("yoy") && (
        <AnimatedCard
          from="right"
          delay={300}
          className="absolute bottom-4 right-4 z-[8]"
        >
          <YoYCard
            states={data.states}
            selectedState={activeState}
            onSelectState={setSelectedState}
            onDismiss={() => dismiss("yoy")}
            animationDelay={800}
          />
        </AnimatedCard>
      )}
    </>
  );
}
