"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import BrowsePanel from "./panels/BrowsePanel";
import DistrictDetailPanel from "./panels/DistrictDetailPanel";
import PlanFormPanel from "./panels/PlanFormPanel";
import PlanViewPanel from "./panels/PlanViewPanel";
import PlanAddPanel from "./panels/PlanAddPanel";
import PlansListPanel from "./panels/PlansListPanel";
import HomePanel from "./panels/HomePanel";

export default function PanelContent() {
  const panelState = useMapV2Store((s) => s.panelState);
  const activeIconTab = useMapV2Store((s) => s.activeIconTab);

  // Plan-related states always show their specific panel
  if (panelState === "PLAN_NEW") return <PanelContentWrapper><PlanFormPanel /></PanelContentWrapper>;
  if (panelState === "PLAN_VIEW") return <PanelContentWrapper><PlanViewPanel /></PanelContentWrapper>;
  if (panelState === "PLAN_ADD") return <PanelContentWrapper><PlanAddPanel /></PanelContentWrapper>;
  if (panelState === "DISTRICT") return <PanelContentWrapper><DistrictDetailPanel /></PanelContentWrapper>;

  // Icon tab routing for BROWSE/STATE states
  if (activeIconTab === "home") return <PanelContentWrapper><HomePanel /></PanelContentWrapper>;
  if (activeIconTab === "plans") return <PanelContentWrapper><PlansListPanel /></PanelContentWrapper>;

  // Default: browse with layers
  return <PanelContentWrapper><BrowsePanel /></PanelContentWrapper>;
}

function PanelContentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
      {children}
    </div>
  );
}
