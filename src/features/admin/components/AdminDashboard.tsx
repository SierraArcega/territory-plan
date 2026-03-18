"use client";

import { useState, useEffect, lazy, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
// Lazy-load tab content to keep initial bundle small
const UnmatchedOpsContent = lazy(() => import("@/app/admin/unmatched-opportunities/page"));
const UsersTab = lazy(() => import("./UsersTab"));
const IntegrationsTab = lazy(() => import("./IntegrationsTab"));
const DataSyncTab = lazy(() => import("./DataSyncTab"));
const VacancyConfigTab = lazy(() => import("./VacancyConfigTab"));

type AdminTab = "unmatched" | "users" | "integrations" | "sync" | "vacancy-config";

const TABS: { id: AdminTab; label: string }[] = [
  { id: "unmatched", label: "Unmatched Opps" },
  { id: "users", label: "Users" },
  { id: "integrations", label: "Integrations" },
  { id: "sync", label: "Data Sync" },
  { id: "vacancy-config", label: "Vacancy Config" },
];

function TabSkeleton() {
  return (
    <div className="space-y-4 pt-6">
      {[...Array(5)].map((_, i) => (
        <div key={i} className="h-12 bg-[#E2DEEC]/40 rounded-lg animate-pulse" />
      ))}
    </div>
  );
}

export default function AdminDashboard() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // Read initial section from URL, default to "unmatched"
  const sectionParam = searchParams.get("section") as AdminTab | null;
  const [activeTab, setActiveTab] = useState<AdminTab>(
    sectionParam && TABS.some((t) => t.id === sectionParam) ? sectionParam : "unmatched",
  );

  // Sync tab state with URL
  useEffect(() => {
    if (sectionParam && TABS.some((t) => t.id === sectionParam) && sectionParam !== activeTab) {
      setActiveTab(sectionParam);
    }
  }, [sectionParam, activeTab]);

  const handleTabChange = (tab: AdminTab) => {
    setActiveTab(tab);
    const params = new URLSearchParams(searchParams.toString());
    params.set("section", tab);
    router.replace(`?${params.toString()}`, { scroll: false });
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-[#403770]">Admin</h1>
        <p className="text-sm text-[#8A80A8] mt-1">System overview and management</p>
      </div>

      {/* Tabs */}
      <div>
        <nav className="flex items-center border-b border-[#E2DEEC]" aria-label="Admin tabs">
          {TABS.map((tab) => {
            const isActive = activeTab === tab.id;
            return (
              <button
                key={tab.id}
                onClick={() => handleTabChange(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`
                  relative flex items-center gap-2 px-6 py-3 text-sm font-medium transition-colors duration-100
                  ${isActive
                    ? "text-[#F37167]"
                    : "text-[#8A80A8] hover:text-[#403770]"
                  }
                `}
              >
                {tab.label}
                {isActive && (
                  <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-[#F37167]" />
                )}
              </button>
            );
          })}
        </nav>

        {/* Tab content */}
        <div className="pt-6">
          <Suspense fallback={<TabSkeleton />}>
            {activeTab === "unmatched" && <UnmatchedOpsContent />}
            {activeTab === "users" && <UsersTab />}
            {activeTab === "integrations" && <IntegrationsTab />}
            {activeTab === "sync" && <DataSyncTab />}
            {activeTab === "vacancy-config" && <VacancyConfigTab />}
          </Suspense>
        </div>
      </div>
    </div>
  );
}
