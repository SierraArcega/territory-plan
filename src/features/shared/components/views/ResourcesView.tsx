"use client";

import { useState } from "react";
import dynamic from "next/dynamic";

// Lazy-load resource pages so the shell stays fast
const IcpScoringPage = dynamic(
  () => import("@/app/admin/icp-scoring/page"),
  { ssr: false, loading: () => <ResourceSkeleton /> }
);

function ResourceSkeleton() {
  return (
    <div className="flex flex-col gap-6 p-6">
      {Array.from({ length: 3 }).map((_, i) => (
        <div key={i} className="bg-[#F7F5FA] rounded-lg h-48 animate-pulse border border-[#E2DEEC]" />
      ))}
    </div>
  );
}

// ── Resource catalog ────────────────────────────────────────────────────────

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
}

const RESOURCES: Resource[] = [
  {
    id: "icp-scoring",
    title: "District Opportunity Score",
    description: "Interactive ICP scoring report — composite scores, tier distribution, state landscape, and district explorer across 17,910 districts.",
    category: "Sales Intelligence",
    icon: (
      <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
      </svg>
    ),
  },
];

// ── Component ───────────────────────────────────────────────────────────────

export default function ResourcesView() {
  const [activeResource, setActiveResource] = useState<string | null>(null);

  // Render the active resource page
  if (activeResource === "icp-scoring") {
    return (
      <div className="h-full flex flex-col">
        {/* Back bar */}
        <div className="shrink-0 bg-white border-b border-[#D4CFE2] px-6 py-3 flex items-center gap-3">
          <button
            onClick={() => setActiveResource(null)}
            className="flex items-center gap-1.5 text-sm font-medium text-[#6E6390] hover:text-[#403770] transition-colors"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
            Resources
          </button>
          <span className="text-[#D4CFE2]">/</span>
          <span className="text-sm font-semibold text-[#403770]">District Opportunity Score</span>
        </div>
        {/* Resource content */}
        <div className="flex-1 overflow-y-auto">
          <IcpScoringPage />
        </div>
      </div>
    );
  }

  // Resource library landing
  return (
    <div className="h-full overflow-y-auto bg-off-white">
      <div className="max-w-[1200px] mx-auto px-6 py-8">
        {/* Header */}
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-[#403770] tracking-tight">Resources</h1>
          <p className="text-sm text-[#8A80A8] mt-1">
            Reports, methodology guides, and reference materials for the Fullmind team.
          </p>
        </div>

        {/* Category sections */}
        {(() => {
          const categories = [...new Set(RESOURCES.map((r) => r.category))];
          return categories.map((category) => (
            <div key={category} className="mb-8">
              <h2 className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-3">{category}</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                {RESOURCES.filter((r) => r.category === category).map((resource) => (
                  <button
                    key={resource.id}
                    onClick={() => setActiveResource(resource.id)}
                    className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-5 text-left hover:border-[#403770]/30 hover:shadow-md transition-all group"
                  >
                    <div className="flex items-start gap-4">
                      <div className="shrink-0 w-10 h-10 rounded-lg bg-[#F7F5FA] border border-[#E2DEEC] flex items-center justify-center text-[#8A80A8] group-hover:text-[#403770] group-hover:bg-[#EFEDF5] transition-colors">
                        {resource.icon}
                      </div>
                      <div className="min-w-0">
                        <h3 className="text-sm font-semibold text-[#403770] group-hover:text-[#322a5a] transition-colors">
                          {resource.title}
                        </h3>
                        <p className="text-xs text-[#8A80A8] mt-1 leading-relaxed line-clamp-2">
                          {resource.description}
                        </p>
                      </div>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          ));
        })()}
      </div>
    </div>
  );
}
