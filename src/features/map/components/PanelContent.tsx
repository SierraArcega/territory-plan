"use client";

import { useMapV2Store } from "@/features/map/lib/store";
import DistrictDetailPanel from "./panels/district/DistrictDetailPanel";
import PlanFormPanel from "./panels/PlanFormPanel";
import PlanWorkspace from "./panels/PlanWorkspace";
import PlanAddPanel from "./panels/PlanAddPanel";
import PlansListPanel from "./panels/PlansListPanel";
import HomePanel from "./panels/HomePanel";
import AccountForm from "./panels/AccountForm";

export default function PanelContent() {
  const panelState = useMapV2Store((s) => s.panelState);
  const activeIconTab = useMapV2Store((s) => s.activeIconTab);
  const showAccountForm = useMapV2Store((s) => s.showAccountForm);

  // Account creation form takes priority when open
  if (showAccountForm) return <PanelContentWrapper><AccountForm /></PanelContentWrapper>;

  // Plan-related states always show their specific panel
  if (panelState === "PLAN_NEW") return <PanelContentWrapper><PlanFormPanel /></PanelContentWrapper>;

  // Plan workspace states
  if (["PLAN_OVERVIEW", "PLAN_ACTIVITIES", "PLAN_TASKS", "PLAN_CONTACTS", "PLAN_PERF"].includes(panelState))
    return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;

  // PLAN_VIEW routes to PlanWorkspace (backwards compat for finishAddingDistricts)
  if (panelState === "PLAN_VIEW") return <PanelContentWrapper><PlanWorkspace /></PanelContentWrapper>;

  if (panelState === "PLAN_ADD") return <PanelContentWrapper><PlanAddPanel /></PanelContentWrapper>;
  if (panelState === "DISTRICT") return <PanelContentWrapper><DistrictDetailPanel /></PanelContentWrapper>;

  // Icon tab routing for BROWSE/STATE states
  if (activeIconTab === "home") return <PanelContentWrapper><HomePanel /></PanelContentWrapper>;
  if (activeIconTab === "plans") return <PanelContentWrapper><PlansListPanel /></PanelContentWrapper>;
  // Default: home panel
  return <PanelContentWrapper><HomePanel /></PanelContentWrapper>;
}

function PanelContentWrapper({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex-1 overflow-y-auto overflow-x-hidden min-h-0">
      {children}
    </div>
  );
}
