"use client";

export type DistrictTab = "planning" | "signals" | "schools" | "contacts";

const TABS: {
  key: DistrictTab;
  label: string;
  path: string;
  stroke: boolean;
}[] = [
  {
    key: "planning",
    label: "Planning",
    // Clipboard icon
    path: "M9 2H7a1 1 0 00-1 1v1H4a1 1 0 00-1 1v10a1 1 0 001 1h8a1 1 0 001-1V5a1 1 0 00-1-1h-2V3a1 1 0 00-1-1zM7 3h2v2H7V3z",
    stroke: false,
  },
  {
    key: "signals",
    label: "Signals",
    // Chart icon
    path: "M3 13V8M7 13V5M11 13V9M15 13V3",
    stroke: true,
  },
  {
    key: "schools",
    label: "Schools",
    // Building icon
    path: "M2 14H14M3 14V5L8 2L13 5V14M6 14V10H10V14M6 7H6.01M10 7H10.01",
    stroke: true,
  },
  {
    key: "contacts",
    label: "Contacts",
    // People icon
    path: "M8 7C9.1 7 10 6.1 10 5S9.1 3 8 3 6 3.9 6 5 6.9 7 8 7ZM4 13C4 11.3 5.8 10 8 10S12 11.3 12 13",
    stroke: true,
  },
];

interface DistrictTabStripProps {
  activeTab: DistrictTab;
  onSelect: (tab: DistrictTab) => void;
  contactCount?: number;
  showPlanning?: boolean;
  showSignals?: boolean;
}

export default function DistrictTabStrip({
  activeTab,
  onSelect,
  contactCount,
  showPlanning = false,
  showSignals = true,
}: DistrictTabStripProps) {
  const visibleTabs = TABS
    .filter((t) => t.key !== "planning" || showPlanning)
    .filter((t) => t.key !== "signals" || showSignals);

  return (
    <div className="flex border-b border-gray-100">
      {visibleTabs.map((tab) => {
        const isActive = activeTab === tab.key;
        return (
          <button
            key={tab.key}
            onClick={() => onSelect(tab.key)}
            className={`flex-1 flex flex-col items-center gap-1 py-2 text-[10px] font-medium transition-colors ${
              isActive
                ? "bg-plum/10 text-plum"
                : "text-gray-400 hover:text-gray-600 hover:bg-gray-50"
            }`}
          >
            <div className="relative">
              <svg
                width="14"
                height="14"
                viewBox="0 0 16 16"
                fill="none"
                className="shrink-0"
              >
                <path
                  d={tab.path}
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  fill={tab.stroke ? "none" : "currentColor"}
                />
              </svg>
              {tab.key === "contacts" && contactCount != null && contactCount > 0 && (
                <span className="absolute -top-1.5 -right-2.5 min-w-[14px] h-[14px] flex items-center justify-center rounded-full bg-plum text-white text-[8px] font-bold px-0.5">
                  {contactCount > 99 ? "99+" : contactCount}
                </span>
              )}
            </div>
            <span>{tab.label}</span>
          </button>
        );
      })}
    </div>
  );
}
