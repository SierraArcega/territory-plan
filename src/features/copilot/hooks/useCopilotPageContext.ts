"use client";

import { useCallback } from "react";
import { useMapStore } from "@/features/shared/lib/app-store";
import type { CopilotPageContext } from "@/features/copilot/lib/types";

/**
 * Returns a getter that snapshots what the rep is currently looking at, so the
 * copilot can resolve "here" / "this district" / "this plan". Read at submit
 * time (not render) so each turn sees the latest selection.
 */
export function useCopilotPageContext(): () => CopilotPageContext {
  const activeTab = useMapStore((s) => s.activeTab);
  const selectedLeaid = useMapStore((s) => s.selectedLeaid);
  const currentPlanId = useMapStore((s) => s.currentPlanId);
  const selectedLeaids = useMapStore((s) => s.selectedLeaids);

  return useCallback(() => {
    const ctx: CopilotPageContext = { tab: activeTab };
    if (typeof window !== "undefined") ctx.route = window.location.pathname;
    if (selectedLeaid) ctx.openDistrict = { leaid: selectedLeaid };
    if (currentPlanId) ctx.openPlanId = currentPlanId;
    if (selectedLeaids && selectedLeaids.size > 0) {
      ctx.selectedLeaids = Array.from(selectedLeaids);
    }
    return ctx;
  }, [activeTab, selectedLeaid, currentPlanId, selectedLeaids]);
}
