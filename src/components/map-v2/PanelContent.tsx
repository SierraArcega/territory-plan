"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import BrowsePanel from "./panels/BrowsePanel";
import DistrictDetailPanel from "./panels/DistrictDetailPanel";
import PlanFormPanel from "./panels/PlanFormPanel";
import PlanViewPanel from "./panels/PlanViewPanel";
import PlanAddPanel from "./panels/PlanAddPanel";

export default function PanelContent() {
  const panelState = useMapV2Store((s) => s.panelState);

  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
      {panelState === "BROWSE" && <BrowsePanel />}
      {panelState === "DISTRICT" && <DistrictDetailPanel />}
      {panelState === "STATE" && <BrowsePanel />}
      {panelState === "PLAN_NEW" && <PlanFormPanel />}
      {panelState === "PLAN_VIEW" && <PlanViewPanel />}
      {panelState === "PLAN_ADD" && <PlanAddPanel />}
    </div>
  );
}
