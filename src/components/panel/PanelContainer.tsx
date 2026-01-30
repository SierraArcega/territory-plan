"use client";

import { useMapStore } from "@/lib/store";
import SidePanel from "./SidePanel";
import StatePanel from "./StatePanel";

export default function PanelContainer() {
  const { activePanelType, sidePanelOpen } = useMapStore();

  if (!sidePanelOpen) {
    return null;
  }

  // Render the appropriate panel based on activePanelType
  if (activePanelType === "state") {
    return <StatePanel />;
  }

  if (activePanelType === "district") {
    return <SidePanel />;
  }

  // Fallback - shouldn't happen but return SidePanel for backward compatibility
  return <SidePanel />;
}
