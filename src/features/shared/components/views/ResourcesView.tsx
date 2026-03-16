"use client";

// ── Resource catalog ────────────────────────────────────────────────────────

interface Resource {
  id: string;
  title: string;
  description: string;
  category: string;
  icon: React.ReactNode;
}

const RESOURCES: Resource[] = [
  // ICP scoring hidden from production — access via /admin/icp-scoring directly
];

// ── Component ───────────────────────────────────────────────────────────────

export default function ResourcesView() {
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

        {RESOURCES.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-24">
            <svg className="w-10 h-10 text-[#C2BBD4] mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10" />
            </svg>
            <span className="text-sm font-semibold text-[#544A78] mb-1">No resources yet</span>
            <span className="text-xs text-[#8A80A8]">Resources will appear here as they become available.</span>
          </div>
        ) : (
          (() => {
            const categories = [...new Set(RESOURCES.map((r) => r.category))];
            return categories.map((category) => (
              <div key={category} className="mb-8">
                <h2 className="text-xs font-semibold text-[#8A80A8] uppercase tracking-wider mb-3">{category}</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {RESOURCES.filter((r) => r.category === category).map((resource) => (
                    <div
                      key={resource.id}
                      className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-5 text-left"
                    >
                      <div className="flex items-start gap-4">
                        <div className="shrink-0 w-10 h-10 rounded-lg bg-[#F7F5FA] border border-[#E2DEEC] flex items-center justify-center text-[#8A80A8]">
                          {resource.icon}
                        </div>
                        <div className="min-w-0">
                          <h3 className="text-sm font-semibold text-[#403770]">
                            {resource.title}
                          </h3>
                          <p className="text-xs text-[#8A80A8] mt-1 leading-relaxed line-clamp-2">
                            {resource.description}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ));
          })()
        )}
      </div>
    </div>
  );
}
