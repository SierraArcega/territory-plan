"use client";

import { useState, lazy, Suspense } from "react";
import { useExecutions } from "../lib/queries";
import { Loader2 } from "lucide-react";

// Lazy-load sub-tab components so Next.js only compiles the active tab on first visit
const SequencesTab = lazy(() => import("./SequencesTab"));
const ActiveRunsTab = lazy(() => import("./ActiveRunsTab"));
const TemplatesTab = lazy(() => import("./TemplatesTab"));
const HistoryTab = lazy(() => import("./HistoryTab"));
const ExecutionPanel = lazy(() => import("./ExecutionPanel"));

type EngageSubTab = "sequences" | "active-runs" | "templates" | "history";

const SUB_TABS: { id: EngageSubTab; label: string }[] = [
  { id: "sequences", label: "Sequences" },
  { id: "active-runs", label: "Active Runs" },
  { id: "templates", label: "Templates" },
  { id: "history", label: "History" },
];

function TabSpinner() {
  return (
    <div className="flex items-center justify-center py-20">
      <Loader2 className="w-6 h-6 text-[#A69DC0] animate-spin" />
    </div>
  );
}

function ActiveRunBadge() {
  // Isolated component so badge fetches don't block the parent render
  const { data: activeRuns } = useExecutions("active");
  const { data: pausedRuns } = useExecutions("paused");
  const count = (activeRuns?.length ?? 0) + (pausedRuns?.length ?? 0);

  if (count === 0) return null;
  return (
    <span className="ml-1.5 inline-flex items-center justify-center w-5 h-5 text-xs font-semibold text-white bg-[#F37167] rounded-full">
      {count}
    </span>
  );
}

export default function EngageView() {
  const [activeSubTab, setActiveSubTab] = useState<EngageSubTab>("sequences");
  const [activeExecutionId, setActiveExecutionId] = useState<number | null>(
    null
  );

  // If an execution is active, show the execution panel
  if (activeExecutionId !== null) {
    return (
      <Suspense fallback={<TabSpinner />}>
        <ExecutionPanel
          executionId={activeExecutionId}
          onClose={() => {
            setActiveExecutionId(null);
            setActiveSubTab("active-runs");
          }}
        />
      </Suspense>
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
              {tab.id === "active-runs" && <ActiveRunBadge />}
            </button>
          ))}
        </div>

        {/* Sub-tab content — only the active tab's code is loaded */}
        <Suspense fallback={<TabSpinner />}>
          {activeSubTab === "sequences" && <SequencesTab />}
          {activeSubTab === "active-runs" && (
            <ActiveRunsTab
              onResume={(executionId) => setActiveExecutionId(executionId)}
            />
          )}
          {activeSubTab === "templates" && <TemplatesTab />}
          {activeSubTab === "history" && <HistoryTab />}
        </Suspense>
      </div>
    </div>
  );
}
