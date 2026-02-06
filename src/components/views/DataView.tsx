"use client";

import { useState, useMemo, Fragment } from "react";
import {
  useReconciliationUnmatched,
  useReconciliationFragmented,
  useDistrictProfiles,
  ReconciliationFilters,
  ReconciliationUnmatchedAccount,
  ReconciliationFragmentedDistrict,
  DistrictProfile,
  DistrictProfileFilters,
} from "@/lib/api";

type TabType = "duplicates" | "unmatched" | "fragmented";

// Name normalization for duplicate detection — strips common suffixes so
// "Richland School District Two" and "Richland Two" group together.
// Matches the algorithm from the API spec.
function normalizeName(name: string | null): string {
  if (!name) return "";
  return name
    .toUpperCase()
    .replace(
      /SCHOOL DISTRICT|PUBLIC SCHOOLS|UNIFIED SCHOOL DISTRICT|CITY SCHOOLS|COUNTY SCHOOLS|SCHOOLS|DISTRICT/g,
      ""
    )
    .trim();
}

// A group of district profiles that share the same normalized name + state
interface DuplicateGroup {
  key: string; // "NORMALIZED_NAME|STATE"
  displayName: string; // Original name from the first district in the group
  state: string | null;
  districts: DistrictProfile[];
  totalRevenue: number;
  totalEntities: number;
}

export default function DataView() {
  // "duplicates" is the default/primary tab
  const [activeTab, setActiveTab] = useState<TabType>("duplicates");
  const [filters, setFilters] = useState<ReconciliationFilters>({});
  const [searchTerm, setSearchTerm] = useState("");

  const {
    data: unmatchedData,
    isLoading: unmatchedLoading,
    error: unmatchedError,
  } = useReconciliationUnmatched(filters);

  const {
    data: fragmentedData,
    isLoading: fragmentedLoading,
    error: fragmentedError,
  } = useReconciliationFragmented(filters);

  // District profiles — fetches all districts from FastAPI (default limit is 50,000)
  const [profileFilters] = useState<DistrictProfileFilters>({});

  const {
    data: profilesData,
    isLoading: profilesLoading,
    error: profilesError,
  } = useDistrictProfiles(profileFilters);

  const isLoading =
    activeTab === "duplicates" ? profilesLoading :
    activeTab === "unmatched" ? unmatchedLoading :
    fragmentedLoading;

  const error =
    activeTab === "duplicates" ? profilesError :
    activeTab === "unmatched" ? unmatchedError :
    fragmentedError;

  // Compute duplicate groups from the full profiles dataset
  const duplicateGroups = useMemo(() => {
    if (!profilesData) return [];

    // Group by normalized name + state (states are already 2-letter codes from API)
    const groups: Record<string, DistrictProfile[]> = {};
    for (const d of profilesData) {
      const key = `${normalizeName(d.district_name)}|${d.state || ""}`;
      if (!groups[key]) groups[key] = [];
      groups[key].push(d);
    }

    // Only keep groups with 2+ entries (actual duplicates)
    const dupeGroups: DuplicateGroup[] = Object.entries(groups)
      .filter(([, districts]) => districts.length > 1)
      .map(([key, districts]) => ({
        key,
        displayName: districts[0].district_name || "Unknown",
        state: districts[0].state,
        districts: districts.sort((a, b) => {
          // Sort within group: valid (non-orphaned) first, then orphaned
          if (a.data_quality.is_orphaned !== b.data_quality.is_orphaned) {
            return a.data_quality.is_orphaned ? 1 : -1;
          }
          return b.totals.total_revenue - a.totals.total_revenue;
        }),
        totalRevenue: districts.reduce((sum, d) => sum + d.totals.total_revenue, 0),
        totalEntities: districts.reduce((sum, d) => sum + d.totals.entity_count, 0),
      }))
      // Sort by revenue impact (highest first)
      .sort((a, b) => b.totalRevenue - a.totalRevenue);

    return dupeGroups;
  }, [profilesData]);

  const handleExport = () => {
    let csv = "";
    if (activeTab === "unmatched") {
      if (!unmatchedData) return;
      csv = "Account Name,State,Sales Exec,Total Revenue,Opportunity Count\n";
      csv += unmatchedData
        .map(
          (row) =>
            `"${row.account_name}","${row.state || ""}","${row.sales_exec || ""}",${row.total_revenue},${row.opportunity_count}`
        )
        .join("\n");
    } else if (activeTab === "fragmented") {
      if (!fragmentedData) return;
      csv = "NCES ID,District Name,State,Account Variants,Similarity Score\n";
      csv += fragmentedData
        .map(
          (row) =>
            `"${row.nces_id}","${row.district_name || ""}","${row.state || ""}","${row.account_variants.map((v) => v.name).join("; ")}",${row.similarity_score}`
        )
        .join("\n");
    } else if (activeTab === "duplicates") {
      if (!duplicateGroups.length) return;
      csv = "Group Name,State,District ID,District Name,NCES ID,Orphaned,Opps,Schools,Sessions,Courses,Total Revenue\n";
      csv += duplicateGroups
        .flatMap((g) =>
          g.districts.map(
            (d) =>
              `"${g.displayName}","${g.state || ""}","${d.district_id}","${d.district_name || ""}","${d.nces_id || ""}",${d.data_quality.is_orphaned},${d.opportunities.count},${d.schools.count},${d.sessions.count},${d.courses.count},${d.totals.total_revenue}`
          )
        )
        .join("\n");
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}-${new Date().toISOString().split("T")[0]}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-[#403770]">Data Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Review data quality issues affecting actuals accuracy
          </p>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-6xl mx-auto px-6 py-6">
        {/* Tabs — Duplicate Districts is first/primary */}
        <div className="flex gap-2 mb-6">
          <button
            onClick={() => setActiveTab("duplicates")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "duplicates"
                ? "bg-[#403770] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Duplicate Districts
            {duplicateGroups.length > 0 && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {duplicateGroups.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("unmatched")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "unmatched"
                ? "bg-[#403770] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Unmatched Accounts
            {unmatchedData && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {unmatchedData.length}
              </span>
            )}
          </button>
          <button
            onClick={() => setActiveTab("fragmented")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "fragmented"
                ? "bg-[#403770] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            Account Fragmentation
            {fragmentedData && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {fragmentedData.length}
              </span>
            )}
          </button>
        </div>

        {/* Filter Bar */}
        <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
          <div className="flex gap-4 items-center">
            <div className="flex-1">
              <input
                type="text"
                placeholder="Search by name, state, or ID..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770]"
              />
            </div>
            {activeTab !== "duplicates" && (
              <select
                value={filters.state || ""}
                onChange={(e) =>
                  setFilters((f) => ({ ...f, state: e.target.value || undefined }))
                }
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
              >
                <option value="">All States</option>
                <option value="CA">California</option>
                <option value="TX">Texas</option>
                <option value="NY">New York</option>
                <option value="FL">Florida</option>
                <option value="IL">Illinois</option>
              </select>
            )}
            <button
              onClick={handleExport}
              className="px-4 py-2 bg-[#C4E7E6] text-[#403770] rounded-lg font-medium hover:bg-[#b3dbd9] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Export CSV
            </button>
          </div>
        </div>

        {/* Loading State */}
        {isLoading && (
          <div className="flex items-center justify-center py-20">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#403770]"></div>
          </div>
        )}

        {/* Error State */}
        {error && (
          <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
            Failed to load data. Make sure the data service is running.
          </div>
        )}

        {/* Duplicate Districts */}
        {!isLoading && !error && activeTab === "duplicates" && profilesData && (
          <DuplicateDistrictsView
            groups={duplicateGroups}
            searchTerm={searchTerm}
          />
        )}

        {/* Unmatched Accounts Table */}
        {!isLoading && !error && activeTab === "unmatched" && unmatchedData && (
          <UnmatchedTable data={unmatchedData} searchTerm={searchTerm} />
        )}

        {/* Fragmented Accounts Table */}
        {!isLoading && !error && activeTab === "fragmented" && fragmentedData && (
          <FragmentedTable data={fragmentedData} searchTerm={searchTerm} />
        )}
      </main>
    </div>
  );
}

// =============================================================================
// Duplicate Districts View — groups districts by normalized name + state
// =============================================================================

function DuplicateDistrictsView({
  groups,
  searchTerm,
}: {
  groups: DuplicateGroup[];
  searchTerm: string;
}) {
  const [expandedGroup, setExpandedGroup] = useState<string | null>(null);

  // Filter groups by search term
  const filtered = useMemo(() => {
    if (!searchTerm) return groups;
    const term = searchTerm.toLowerCase();
    return groups.filter(
      (g) =>
        g.displayName.toLowerCase().includes(term) ||
        g.state?.toLowerCase().includes(term) ||
        g.districts.some(
          (d) =>
            d.district_id.includes(term) ||
            d.nces_id?.includes(term)
        )
    );
  }, [groups, searchTerm]);

  // Compute unique states from filtered groups for the summary
  const uniqueStates = useMemo(
    () => new Set(filtered.map((g) => g.state).filter(Boolean)).size,
    [filtered]
  );

  return (
    <div className="space-y-4">
      {/* Summary bar */}
      <div className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center justify-between">
        <div className="flex items-center gap-6">
          <div>
            <span className="text-2xl font-bold text-[#F37167]">
              {filtered.length.toLocaleString()}
            </span>
            <span className="text-sm text-gray-500 ml-2">
              duplicate groups
            </span>
          </div>
          <div className="h-8 w-px bg-gray-200" />
          <div>
            <span className="text-sm text-gray-500">across </span>
            <span className="text-sm font-semibold text-gray-700">
              {uniqueStates} states
            </span>
          </div>
        </div>
        <p className="text-xs text-gray-400">
          Sorted by revenue impact (highest first)
        </p>
      </div>

      {/* Group list */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No duplicate groups match the current search.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden divide-y divide-gray-100">
          {filtered.map((group) => {
            const isExpanded = expandedGroup === group.key;
            return (
              <div key={group.key}>
                {/* Group header row */}
                <button
                  onClick={() =>
                    setExpandedGroup(isExpanded ? null : group.key)
                  }
                  className="w-full flex items-center gap-3 px-4 py-3 hover:bg-gray-50 transition-colors text-left"
                >
                  {/* Chevron */}
                  <svg
                    className={`w-4 h-4 text-gray-400 shrink-0 transition-transform ${isExpanded ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>

                  {/* Name + state */}
                  <div className="flex-1 min-w-0">
                    <span className="text-sm font-medium text-[#403770]">
                      {group.displayName}
                    </span>
                    {group.state && (
                      <span className="ml-2 text-xs text-gray-400">
                        ({group.state})
                      </span>
                    )}
                  </div>

                  {/* Badges */}
                  <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700 shrink-0">
                    {group.districts.length} IDs
                  </span>

                  {/* Revenue */}
                  {group.totalRevenue > 0 && (
                    <span className="text-xs font-mono text-gray-500 shrink-0">
                      ${group.totalRevenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}
                    </span>
                  )}
                </button>

                {/* Expanded: show each district in the group */}
                {isExpanded && (
                  <div className="bg-gray-50 px-4 py-3 border-t border-gray-100">
                    <table className="w-full">
                      <thead>
                        <tr>
                          <th className="text-left px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                            Status
                          </th>
                          <th className="text-left px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            District ID
                          </th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Opps
                          </th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Schools
                          </th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Sessions
                          </th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Courses
                          </th>
                          <th className="text-right px-2 py-1 text-xs font-medium text-gray-500 uppercase tracking-wider">
                            Revenue
                          </th>
                        </tr>
                      </thead>
                      <tbody>
                        {group.districts.map((d) => (
                          <tr key={d.district_id} className="border-t border-gray-200">
                            {/* Status badge */}
                            <td className="px-2 py-2">
                              {!d.data_quality.is_orphaned && d.data_quality.has_nces ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-green-100 text-green-700">
                                  <span>&#10003;</span> VALID
                                </span>
                              ) : d.data_quality.is_orphaned ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                                  <span>&#10007;</span> ORPHANED
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                                  NO NCES
                                </span>
                              )}
                            </td>

                            {/* District ID */}
                            <td className="px-2 py-2">
                              <span className="text-xs text-gray-600 font-mono">
                                {d.district_id}
                              </span>
                            </td>

                            {/* Counts */}
                            <td className="px-2 py-2 text-xs text-gray-600 text-right">
                              {d.opportunities.count.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-xs text-gray-600 text-right">
                              {d.schools.count.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-xs text-gray-600 text-right">
                              {d.sessions.count.toLocaleString()}
                            </td>
                            <td className="px-2 py-2 text-xs text-gray-600 text-right">
                              {d.courses.count.toLocaleString()}
                            </td>

                            {/* Revenue */}
                            <td className="px-2 py-2 text-xs text-gray-900 text-right font-mono">
                              {d.totals.total_revenue > 0
                                ? `$${d.totals.total_revenue.toLocaleString(undefined, { maximumFractionDigits: 0 })}`
                                : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// =============================================================================
// Unmatched Accounts Table
// =============================================================================

function UnmatchedTable({
  data,
  searchTerm,
}: {
  data: ReconciliationUnmatchedAccount[];
  searchTerm: string;
}) {
  const filtered = data.filter(
    (item) =>
      item.account_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.state?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.sales_exec?.toLowerCase().includes(searchTerm.toLowerCase())
  );

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No unmatched accounts found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Account Name
            </th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              State
            </th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Sales Exec
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Total Revenue
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Opps
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <tr
              key={row.account_id}
              className="border-b border-gray-100 hover:bg-gray-50"
            >
              <td className="px-3 py-2 text-sm text-[#403770] font-medium">
                {row.account_name}
              </td>
              <td className="px-3 py-2 text-xs text-gray-600">
                {row.state || "—"}
              </td>
              <td className="px-3 py-2 text-xs text-gray-600">
                {row.sales_exec || "Unassigned"}
              </td>
              <td className="px-3 py-2 text-sm text-gray-900 text-right font-mono">
                ${row.total_revenue.toLocaleString()}
              </td>
              <td className="px-3 py-2 text-xs text-gray-600 text-right">
                {row.opportunity_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

// =============================================================================
// Fragmented Accounts Table
// =============================================================================

function FragmentedTable({
  data,
  searchTerm,
}: {
  data: ReconciliationFragmentedDistrict[];
  searchTerm: string;
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);

  const filtered = data.filter(
    (item) =>
      item.district_name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      item.nces_id.includes(searchTerm) ||
      item.account_variants.some((v) =>
        v.name.toLowerCase().includes(searchTerm.toLowerCase())
      )
  );

  if (filtered.length === 0) {
    return (
      <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
        No account fragmentation issues found.
      </div>
    );
  }

  return (
    <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
      <table className="w-full">
        <thead className="bg-gray-50 border-b border-gray-200">
          <tr>
            <th className="w-8 px-2 py-2"></th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              NCES ID
            </th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              District Name
            </th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              State
            </th>
            <th className="text-left px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Account Variants
            </th>
            <th className="text-right px-3 py-2 text-xs font-medium text-gray-500 uppercase tracking-wider">
              Similarity
            </th>
          </tr>
        </thead>
        <tbody>
          {filtered.map((row) => (
            <Fragment key={row.nces_id}>
              <tr
                onClick={() =>
                  setExpandedRow(expandedRow === row.nces_id ? null : row.nces_id)
                }
                className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
              >
                {/* Chevron indicator */}
                <td className="w-8 px-2 py-2 text-gray-400">
                  <svg
                    className={`w-4 h-4 transition-transform ${expandedRow === row.nces_id ? "rotate-90" : ""}`}
                    fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
                  </svg>
                </td>
                <td className="px-3 py-2 text-xs text-gray-600 font-mono">
                  {row.nces_id}
                </td>
                <td className="px-3 py-2 text-sm text-[#403770] font-medium">
                  {row.district_name || "Unknown"}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  {row.state || "—"}
                </td>
                <td className="px-3 py-2 text-xs text-gray-600">
                  <div className="flex gap-1 flex-wrap">
                    {row.account_variants.slice(0, 2).map((v, i) => (
                      <span
                        key={i}
                        className={`px-1.5 py-0.5 rounded text-xs ${
                          v.source === "districts"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {v.name.length > 25 ? v.name.slice(0, 25) + "..." : v.name}
                      </span>
                    ))}
                    {row.account_variants.length > 2 && (
                      <span className="px-1.5 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        +{row.account_variants.length - 2} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-xs text-right">
                  <span
                    className={`px-1.5 py-0.5 rounded text-xs font-medium ${
                      row.similarity_score < 0.5
                        ? "bg-red-100 text-red-700"
                        : "bg-yellow-100 text-yellow-700"
                    }`}
                  >
                    {Math.round(row.similarity_score * 100)}%
                  </span>
                </td>
              </tr>
              {expandedRow === row.nces_id && (
                <tr className="bg-gray-50">
                  <td colSpan={6} className="px-3 py-3">
                    <div className="text-sm text-gray-600">
                      <strong className="text-gray-900">All Account Variants:</strong>
                      <div className="mt-2 space-y-1">
                        {row.account_variants.map((v, i) => (
                          <div key={i} className="flex items-center gap-2">
                            <span
                              className={`px-2 py-0.5 rounded text-xs ${
                                v.source === "districts"
                                  ? "bg-blue-100 text-blue-700"
                                  : "bg-amber-100 text-amber-700"
                              }`}
                            >
                              {v.source}
                            </span>
                            <span>{v.name}</span>
                            <span className="text-gray-400">({v.count} records)</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
}
