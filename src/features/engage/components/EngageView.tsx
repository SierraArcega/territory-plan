"use client";

import { useState } from "react";

type EngageSubTab = "sequences" | "active-runs" | "templates" | "history";

const SUB_TABS: { id: EngageSubTab; label: string }[] = [
  { id: "sequences", label: "Sequences" },
  { id: "active-runs", label: "Active Runs" },
  { id: "templates", label: "Templates" },
  { id: "history", label: "History" },
];

export default function EngageView() {
  const [activeSubTab, setActiveSubTab] = useState<EngageSubTab>("sequences");

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
            </button>
          ))}
        </div>

        {/* Sub-tab content — placeholder for now */}
        <div className="text-sm text-[#6B5F8A]">
          {activeSubTab === "sequences" && <p>Sequences tab — coming next</p>}
          {activeSubTab === "active-runs" && (
            <p>Active runs tab — coming next</p>
          )}
          {activeSubTab === "templates" && <p>Templates tab — coming next</p>}
          {activeSubTab === "history" && <p>History tab — coming next</p>}
        </div>
      </div>
    </div>
  );
}
