"use client";

import { useState } from "react";
import SequencesTab from "./SequencesTab";
import ActiveRunsTab from "./ActiveRunsTab";
import TemplatesTab from "./TemplatesTab";
import HistoryTab from "./HistoryTab";
import ExecutionPanel from "./ExecutionPanel";
import { useExecutions } from "../lib/queries";

type EngageSubTab = "sequences" | "active-runs" | "templates" | "history";

const SUB_TABS: { id: EngageSubTab; label: string }[] = [
  { id: "sequences", label: "Sequences" },
  { id: "active-runs", label: "Active Runs" },
  { id: "templates", label: "Templates" },
  { id: "history", label: "History" },
];

export default function EngageView() {
  const [activeSubTab, setActiveSubTab] = useState<EngageSubTab>("sequences");
  const [activeExecutionId, setActiveExecutionId] = useState<number | null>(
    null
  );

  // Badge count for active runs
  const { data: activeRuns } = useExecutions("active");
  const { data: pausedRuns } = useExecutions("paused");
  const activeRunCount = (activeRuns?.length ?? 0) + (pausedRuns?.length ?? 0);

  // If an execution is active, show the execution panel
  if (activeExecutionId !== null) {
    return (
      <ExecutionPanel
        executionId={activeExecutionId}
        onClose={() => {
          setActiveExecutionId(null);
          setActiveSubTab("active-runs");
        }}
      />
    );
  }

  return (
    <div className="h-full overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-8">
        <div className="mb-6">
          <h1 className="text-2xl font-bold text-[#403770]">Engage</h1>
          <p className="text-sm text-[#6B5F8A] mt-1">
            Create sequences, manage templates, and track outreach
          </p>
        </div>

        {/* Sub-tab navigation */}
        <div className="flex gap-1 border-b border-[#E2DEEC] mb-6">
          {SUB_TABS.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveSubTab(tab.id)}
              className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
                activeSubTab === tab.id
                  ? "border-[#F37167] text-[#403770]"
                  : "border-transparent text-[#6B5F8A] hover:text-[#403770] hover:border-[#E2DEEC]"
              }`}
            >
              {tab.label}
              {tab.id === "active-runs" && activeRunCount > 0 && (
                <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-[#F37167] rounded-full">
                  {activeRunCount}
                </span>
              )}
            </button>
          ))}
        </div>

        {/* Sub-tab content */}
        {activeSubTab === "sequences" && <SequencesTab />}
        {activeSubTab === "active-runs" && (
          <ActiveRunsTab
            onResume={(executionId) => setActiveExecutionId(executionId)}
          />
        )}
        {activeSubTab === "templates" && <TemplatesTab />}
        {activeSubTab === "history" && <HistoryTab />}
      </div>
    </div>
  );
}
