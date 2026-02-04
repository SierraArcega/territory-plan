"use client";

// ViewToggle - A pair of icon buttons to switch between card grid and table views.
// Used in PlansListView and ActivitiesPanel headers.

interface ViewToggleProps {
  view: "cards" | "table";
  onViewChange: (view: "cards" | "table") => void;
}

export default function ViewToggle({ view, onViewChange }: ViewToggleProps) {
  // Button styling: active state uses plum background, inactive uses gray
  const baseStyles = "p-1.5 transition-colors";
  const activeStyles = "bg-[#403770] text-white";
  const inactiveStyles = "bg-gray-100 text-gray-500 hover:bg-gray-200";

  return (
    <div className="inline-flex rounded-md" role="group">
      {/* Grid/Cards view button */}
      <button
        type="button"
        onClick={() => onViewChange("cards")}
        className={`${baseStyles} rounded-l-md ${view === "cards" ? activeStyles : inactiveStyles}`}
        aria-label="Grid view"
        aria-pressed={view === "cards"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z"
          />
        </svg>
      </button>

      {/* Table/List view button */}
      <button
        type="button"
        onClick={() => onViewChange("table")}
        className={`${baseStyles} rounded-r-md ${view === "table" ? activeStyles : inactiveStyles}`}
        aria-label="Table view"
        aria-pressed={view === "table"}
      >
        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M4 6h16M4 10h16M4 14h16M4 18h16"
          />
        </svg>
      </button>
    </div>
  );
}
