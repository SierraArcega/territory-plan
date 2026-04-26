"use client";

import { useState } from "react";
import DealQualifyingPage from "./resources/DealQualifyingPage";
import OrgChartPage from "./resources/OrgChartPage";
import OurServiceModelPage from "./resources/OurServiceModelPage";
import PricingAndPackagingPage from "./resources/PricingAndPackagingPage";
import UnderstandingLeaderboardPage from "./resources/UnderstandingLeaderboardPage";
import UnderstandingTakePage from "./resources/UnderstandingTakePage";

// ── Resource page registry ────────────────────────────────────────────────────
// Add new pages here — one line per resource. The sidebar groups by category.

interface ResourcePage {
  id: string;
  label: string;
  category: string;
  component: React.FC;
}

const RESOURCE_PAGES: ResourcePage[] = [
  { id: "deal-qualifying", label: "Deal Qualifying", category: "Sales Enablement", component: DealQualifyingPage },
  { id: "understanding-leaderboard", label: "Understanding the Leaderboard", category: "Training", component: UnderstandingLeaderboardPage },
  { id: "pricing-and-packaging", label: "Pricing & Packaging", category: "Training", component: PricingAndPackagingPage },
  { id: "understanding-take", label: "Understanding Take", category: "Training", component: UnderstandingTakePage },
  { id: "our-service-model", label: "Our Service Model", category: "Product", component: OurServiceModelPage },
  { id: "org-chart", label: "Org Chart", category: "Team", component: OrgChartPage },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function ResourcesView() {
  const [activePageId, setActivePageId] = useState<string>(
    RESOURCE_PAGES[0]?.id ?? ""
  );

  const activePage = RESOURCE_PAGES.find((p) => p.id === activePageId);
  const ActiveComponent = activePage?.component;

  // Derive ordered categories from registry
  const categories = [...new Set(RESOURCE_PAGES.map((p) => p.category))];

  // Empty state when no pages registered yet
  if (RESOURCE_PAGES.length === 0) {
    return (
      <div className="h-full overflow-y-auto bg-[#FFFCFA]">
        <div className="max-w-[1200px] mx-auto px-6 py-8">
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-[#403770] tracking-tight">
              Resources
            </h1>
            <p className="text-sm text-[#8A80A8] mt-1">
              Documentation, training guides, and tools for the Fullmind team.
            </p>
          </div>
          <div className="flex flex-col items-center justify-center py-24">
            <svg
              className="w-10 h-10 text-[#C2BBD4] mb-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={1.5}
                d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253"
              />
            </svg>
            <span className="text-sm font-semibold text-[#544A78] mb-1">
              No resources yet
            </span>
            <span className="text-xs text-[#8A80A8]">
              Resources will appear here as they become available.
            </span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex h-full">
      {/* Left sidebar — category-grouped page links */}
      <nav className="w-56 flex-shrink-0 bg-white border-r border-[#E2DEEC] h-full overflow-y-auto">
        <div className="py-4">
          <h2 className="px-4 mb-3 text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">
            Resources
          </h2>
          {categories.map((category) => (
            <div key={category} className="mb-4">
              <h3 className="px-4 mb-1 text-xs font-semibold text-[#8A80A8] uppercase tracking-wider">
                {category}
              </h3>
              {RESOURCE_PAGES.filter((p) => p.category === category).map(
                (page) => {
                  const isActive = page.id === activePageId;
                  return (
                    <button
                      key={page.id}
                      onClick={() => setActivePageId(page.id)}
                      className={`
                        block w-full text-left px-4 py-2.5 text-sm font-medium
                        transition-colors duration-100 border-l-[3px]
                        ${
                          isActive
                            ? "border-[#F37167] bg-[#fef1f0] text-[#F37167]"
                            : "border-transparent text-[#6E6390] hover:bg-[#EFEDF5] hover:text-[#403770]"
                        }
                      `}
                    >
                      {page.label}
                    </button>
                  );
                }
              )}
            </div>
          ))}
        </div>
      </nav>

      {/* Right content area — renders selected page */}
      <div className="flex-1 overflow-y-auto bg-[#FFFCFA] px-6 py-6 min-h-0">
        {ActiveComponent ? (
          <ActiveComponent />
        ) : (
          <div className="flex items-center justify-center h-full text-sm text-[#8A80A8]">
            Select a resource from the sidebar.
          </div>
        )}
      </div>
    </div>
  );
}
