"use client";

import { useMapV2Store } from "@/lib/map-v2-store";
import SearchPanel from "./panels/SearchPanel";
import DistrictDetailPanel from "./panels/district/DistrictDetailPanel";
import PlanFormPanel from "./panels/PlanFormPanel";
import PlanWorkspace from "./panels/PlanWorkspace";
import PlanAddPanel from "./panels/PlanAddPanel";
import PlansListPanel from "./panels/PlansListPanel";
import HomePanel from "./panels/HomePanel";

export default function PanelContent() {
  const panelState = useMapV2Store((s) => s.panelState);
  const activeIconTab = useMapV2Store((s) => s.activeIconTab);

  // Plan-related states always show their specific panel
  if (panelState === "PLAN_NEW") return <PanelContentWrapper><PlanFormPanel /></PanelContentWrapper>;

  // Plan workspace states
  if (["PLAN_OVERVIEW", "PLAN_TASKS", "PLAN_CONTACTS", "PLAN_PERF"].includes(panelState))
    return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;

  // PLAN_VIEW routes to PlanWorkspace (backwards compat for finishAddingDistricts)
  if (panelState === "PLAN_VIEW") return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;

  if (panelState === "PLAN_ADD") return <PanelContentWrapper><PlanAddPanel /></PanelContentWrapper>;
  if (panelState === "DISTRICT") return <PanelContentWrapper><DistrictDetailPanel /></PanelContentWrapper>;

  // Icon tab routing for BROWSE/STATE states
  if (activeIconTab === "home") return <PanelContentWrapper><HomePanel /></PanelContentWrapper>;
  if (activeIconTab === "plans") return <PanelContentWrapper><PlansListPanel /></PanelContentWrapper>;
  if (activeIconTab === "search") return <PanelContentWrapper><SearchPanel /></PanelContentWrapper>;

  // Default: search panel
  return <PanelContentWrapper><SearchPanel /></PanelContentWrapper>;
}

function PanelContentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
      {children}
    </div>
  );
}
