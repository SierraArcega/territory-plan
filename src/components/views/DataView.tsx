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

type TabType = "unmatched" | "fragmented" | "profiles";

export default function DataView() {
  const [activeTab, setActiveTab] = useState<TabType>("unmatched");
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

  // District profiles state — separate filters since this endpoint has different params
  const [profileFilters, setProfileFilters] = useState<DistrictProfileFilters>({});
  const [profileStatusFilter, setProfileStatusFilter] = useState<"all" | "orphaned" | "valid">("all");

  const {
    data: profilesData,
    isLoading: profilesLoading,
    error: profilesError,
  } = useDistrictProfiles(profileFilters);

  const isLoading =
    activeTab === "unmatched" ? unmatchedLoading :
    activeTab === "fragmented" ? fragmentedLoading :
    profilesLoading;

  const error =
    activeTab === "unmatched" ? unmatchedError :
    activeTab === "fragmented" ? fragmentedError :
    profilesError;

  const handleExport = () => {
    const data =
      activeTab === "unmatched" ? unmatchedData :
      activeTab === "fragmented" ? fragmentedData :
      profilesData;
    if (!data) return;

    let csv = "";
    if (activeTab === "unmatched") {
      csv = "Account Name,State,Sales Exec,Total Revenue,Opportunity Count\n";
      csv += (data as ReconciliationUnmatchedAccount[])
        .map(
          (row) =>
            `"${row.account_name}","${row.state || ""}","${row.sales_exec || ""}",${row.total_revenue},${row.opportunity_count}`
        )
        .join("\n");
    } else if (activeTab === "fragmented") {
      csv = "NCES ID,District Name,State,Account Variants,Similarity Score\n";
      csv += (data as ReconciliationFragmentedDistrict[])
        .map(
          (row) =>
            `"${row.nces_id}","${row.district_name || ""}","${row.state || ""}","${row.account_variants.map((v) => v.name).join("; ")}",${row.similarity_score}`
        )
        .join("\n");
    } else if (activeTab === "profiles") {
      const profileData = data as DistrictProfile[];
      csv = "District Name,District ID,State,NCES ID,Orphaned,Schools,Sessions,Opportunities,Courses,Entity Count\n";
      csv += profileData
        .map(
          (row) =>
            `"${row.district_name || ""}","${row.district_id}","${row.state || ""}","${row.nces_id || ""}",${row.data_quality.is_orphaned},${row.schools.count},${row.sessions.count},${row.opportunities.count},${row.courses.count},${row.totals.entity_count}`
        )
        .join("\n");
    }

    const blob = new Blob([csv], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${activeTab}-accounts-${new Date().toISOString().split("T")[0]}.csv`;
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
        {/* Tabs */}
        <div className="flex gap-2 mb-6">
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
          <button
            onClick={() => setActiveTab("profiles")}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === "profiles"
                ? "bg-[#403770] text-white"
                : "bg-white border border-gray-200 text-gray-600 hover:bg-gray-50"
            }`}
          >
            District Profiles
            {profilesData && (
              <span className="ml-2 px-2 py-0.5 text-xs rounded-full bg-white/20">
                {profilesData.length}
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
            <select
              value={activeTab === "profiles" ? (profileFilters.state || "") : (filters.state || "")}
              onChange={(e) => {
                if (activeTab === "profiles") {
                  setProfileFilters((f) => ({ ...f, state: e.target.value || undefined }));
                } else {
                  setFilters((f) => ({ ...f, state: e.target.value || undefined }));
                }
              }}
              className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
            >
              <option value="">All States</option>
              {activeTab === "profiles" && profilesData
                ? [...new Set(profilesData.map((d) => d.state).filter(Boolean))].sort().map((st) => (
                    <option key={st} value={st!}>{st}</option>
                  ))
                : <>
                    <option value="CA">California</option>
                    <option value="TX">Texas</option>
                    <option value="NY">New York</option>
                    <option value="FL">Florida</option>
                    <option value="IL">Illinois</option>
                  </>
              }
            </select>
            {activeTab === "profiles" && (
              <select
                value={profileStatusFilter}
                onChange={(e) => setProfileStatusFilter(e.target.value as "all" | "orphaned" | "valid")}
                className="px-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
              >
                <option value="all">All Status</option>
                <option value="orphaned">Orphaned Only</option>
                <option value="valid">Valid Only</option>
              </select>
            )}
            <button
              onClick={handleExport}
              disabled={!unmatchedData && !fragmentedData && !profilesData}
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
            Failed to load data. Make sure the FastAPI service is running.
          </div>
        )}

        {/* Unmatched Accounts Table */}
        {!isLoading && !error && activeTab === "unmatched" && unmatchedData && (
          <UnmatchedTable data={unmatchedData} searchTerm={searchTerm} />
        )}

        {/* Fragmented Accounts Table */}
        {!isLoading && !error && activeTab === "fragmented" && fragmentedData && (
          <FragmentedTable data={fragmentedData} searchTerm={searchTerm} />
        )}

        {/* District Profiles */}
        {!isLoading && !error && activeTab === "profiles" && profilesData && (
          <DistrictProfilesView
            data={profilesData}
            searchTerm={searchTerm}
            statusFilter={profileStatusFilter}
          />
        )}
      </main>
    </div>
  );
}

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
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              Account Name
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              State
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              Sales Exec
            </th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
              Total Revenue
            </th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
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
              <td className="px-4 py-3 text-sm text-[#403770] font-medium">
                {row.account_name}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.state || "—"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600">
                {row.sales_exec || "Unassigned"}
              </td>
              <td className="px-4 py-3 text-sm text-gray-900 text-right font-mono">
                ${row.total_revenue.toLocaleString()}
              </td>
              <td className="px-4 py-3 text-sm text-gray-600 text-right">
                {row.opportunity_count}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

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
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              NCES ID
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              District Name
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              State
            </th>
            <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
              Account Variants
            </th>
            <th className="text-right px-4 py-3 text-sm font-medium text-gray-600">
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
                <td className="px-4 py-3 text-sm text-gray-600 font-mono">
                  {row.nces_id}
                </td>
                <td className="px-4 py-3 text-sm text-[#403770] font-medium">
                  {row.district_name || "Unknown"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {row.state || "—"}
                </td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  <div className="flex gap-1 flex-wrap">
                    {row.account_variants.slice(0, 2).map((v, i) => (
                      <span
                        key={i}
                        className={`px-2 py-0.5 rounded text-xs ${
                          v.source === "districts"
                            ? "bg-blue-100 text-blue-700"
                            : "bg-amber-100 text-amber-700"
                        }`}
                      >
                        {v.name.length > 25 ? v.name.slice(0, 25) + "..." : v.name}
                      </span>
                    ))}
                    {row.account_variants.length > 2 && (
                      <span className="px-2 py-0.5 rounded text-xs bg-gray-100 text-gray-600">
                        +{row.account_variants.length - 2} more
                      </span>
                    )}
                  </div>
                </td>
                <td className="px-4 py-3 text-sm text-right">
                  <span
                    className={`px-2 py-0.5 rounded text-xs font-medium ${
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
                  <td colSpan={5} className="px-4 py-4">
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

// DistrictProfilesView — summary cards + sortable table with expandable detail rows
function DistrictProfilesView({
  data,
  searchTerm,
  statusFilter,
}: {
  data: DistrictProfile[];
  searchTerm: string;
  statusFilter: "all" | "orphaned" | "valid";
}) {
  const [expandedRow, setExpandedRow] = useState<string | null>(null);
  const [sortField, setSortField] = useState<"entities" | "schools" | "sessions" | "opps">("entities");
  const [sortDir, setSortDir] = useState<"asc" | "desc">("desc");

  // Filter by search term and status
  const filtered = useMemo(() => {
    let result = data;

    // Status filter
    if (statusFilter === "orphaned") {
      result = result.filter((d) => d.data_quality.is_orphaned);
    } else if (statusFilter === "valid") {
      result = result.filter((d) => !d.data_quality.is_orphaned);
    }

    // Search filter
    if (searchTerm) {
      const term = searchTerm.toLowerCase();
      result = result.filter(
        (d) =>
          d.district_name?.toLowerCase().includes(term) ||
          d.district_id.includes(term) ||
          d.nces_id?.includes(term) ||
          d.state?.toLowerCase().includes(term)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      let aVal: number, bVal: number;
      switch (sortField) {
        case "schools": aVal = a.schools.count; bVal = b.schools.count; break;
        case "sessions": aVal = a.sessions.count; bVal = b.sessions.count; break;
        case "opps": aVal = a.opportunities.count; bVal = b.opportunities.count; break;
        default: aVal = a.totals.entity_count; bVal = b.totals.entity_count;
      }
      return sortDir === "desc" ? bVal - aVal : aVal - bVal;
    });

    return result;
  }, [data, searchTerm, statusFilter, sortField, sortDir]);

  // Summary stats computed from the full (unfiltered) dataset
  const stats = useMemo(() => {
    const orphanedCount = data.filter((d) => d.data_quality.is_orphaned).length;
    const missingNcesCount = data.filter((d) => !d.data_quality.has_nces).length;
    const uniqueStates = new Set(data.map((d) => d.state).filter(Boolean)).size;
    return { orphanedCount, missingNcesCount, total: data.length, uniqueStates };
  }, [data]);

  // Toggle sort: if clicking the same field, flip direction; otherwise set new field desc
  const handleSort = (field: typeof sortField) => {
    if (sortField === field) {
      setSortDir((d) => (d === "desc" ? "asc" : "desc"));
    } else {
      setSortField(field);
      setSortDir("desc");
    }
  };

  // Small helper for the sort indicator arrow
  const sortIcon = (field: typeof sortField) =>
    sortField === field ? (sortDir === "desc" ? " \u2193" : " \u2191") : "";

  return (
    <div className="space-y-6">
      {/* Summary Cards */}
      <div className="grid grid-cols-3 gap-4">
        {/* Orphaned Districts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Orphaned Districts</p>
          <p className="text-3xl font-bold text-[#F37167] mt-1">
            {stats.orphanedCount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            IDs referenced but not in district index
          </p>
        </div>

        {/* Missing NCES */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Missing NCES ID</p>
          <p className="text-3xl font-bold text-amber-500 mt-1">
            {stats.missingNcesCount.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Districts without federal reporting ID
          </p>
        </div>

        {/* Total Districts */}
        <div className="bg-white rounded-xl border border-gray-200 p-5">
          <p className="text-sm font-medium text-gray-500">Total Districts</p>
          <p className="text-3xl font-bold text-[#6EA3BE] mt-1">
            {stats.total.toLocaleString()}
          </p>
          <p className="text-xs text-gray-400 mt-1">
            Across {stats.uniqueStates} states
          </p>
        </div>
      </div>

      {/* Results count */}
      <p className="text-sm text-gray-500">
        Showing {filtered.length} of {data.length} district profiles
      </p>

      {/* Table */}
      {filtered.length === 0 ? (
        <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
          No district profiles match the current filters.
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  District
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  District ID
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  NCES ID
                </th>
                <th
                  onClick={() => handleSort("schools")}
                  className="text-right px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-[#403770] select-none"
                >
                  Schools{sortIcon("schools")}
                </th>
                <th
                  onClick={() => handleSort("sessions")}
                  className="text-right px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-[#403770] select-none"
                >
                  Sessions{sortIcon("sessions")}
                </th>
                <th
                  onClick={() => handleSort("opps")}
                  className="text-right px-4 py-3 text-sm font-medium text-gray-600 cursor-pointer hover:text-[#403770] select-none"
                >
                  Opps{sortIcon("opps")}
                </th>
                <th className="text-left px-4 py-3 text-sm font-medium text-gray-600">
                  Data Sources
                </th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((row) => (
                <Fragment key={row.district_id}>
                  <tr
                    onClick={() =>
                      setExpandedRow(expandedRow === row.district_id ? null : row.district_id)
                    }
                    className="border-b border-gray-100 hover:bg-gray-50 cursor-pointer"
                  >
                    {/* District Name + State */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-[#403770] font-medium">
                        {row.district_name || "Unknown District"}
                      </div>
                      <div className="text-xs text-gray-400">{row.state || "\u2014"}</div>
                    </td>

                    {/* District ID + orphaned badge */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        <span className="text-sm text-gray-600 font-mono">
                          {row.district_id}
                        </span>
                        {row.data_quality.is_orphaned && (
                          <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-red-100 text-red-700">
                            Orphaned
                          </span>
                        )}
                      </div>
                    </td>

                    {/* NCES ID or Missing badge */}
                    <td className="px-4 py-3 text-sm">
                      {row.nces_id ? (
                        <span className="text-gray-600 font-mono">{row.nces_id}</span>
                      ) : (
                        <span className="px-2 py-0.5 text-xs font-medium rounded-full bg-amber-100 text-amber-700">
                          Missing
                        </span>
                      )}
                    </td>

                    {/* Counts */}
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {row.schools.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {row.sessions.count.toLocaleString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-600 text-right">
                      {row.opportunities.count.toLocaleString()}
                    </td>

                    {/* Data sources */}
                    <td className="px-4 py-3">
                      <div className="flex gap-1 flex-wrap">
                        {row.referenced_by.map((source) => (
                          <span
                            key={source}
                            className="px-2 py-0.5 rounded text-xs bg-[#C4E7E6] text-[#403770]"
                          >
                            {source}
                          </span>
                        ))}
                      </div>
                    </td>
                  </tr>

                  {/* Expanded detail row */}
                  {expandedRow === row.district_id && (
                    <tr className="bg-gray-50">
                      <td colSpan={7} className="px-6 py-5">
                        <div className="grid grid-cols-2 gap-6">
                          {/* Left: Entity breakdown */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                              Entity Breakdown
                            </h4>
                            <div className="grid grid-cols-2 gap-3">
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Opportunities</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.opportunities.count.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Schools</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.schools.count.toLocaleString()}
                                </p>
                                {row.schools.sample_names.length > 0 && (
                                  <p className="text-xs text-gray-400 mt-1 truncate">
                                    {row.schools.sample_names.slice(0, 3).join(", ")}
                                  </p>
                                )}
                              </div>
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Sessions</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.sessions.count.toLocaleString()}
                                </p>
                              </div>
                              <div className="bg-white rounded-lg border border-gray-200 p-3">
                                <p className="text-xs text-gray-500">Courses</p>
                                <p className="text-lg font-semibold text-[#403770]">
                                  {row.courses.count.toLocaleString()}
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Right: Data quality checklist */}
                          <div>
                            <h4 className="text-sm font-semibold text-gray-900 mb-3">
                              Data Quality
                            </h4>
                            <div className="space-y-2">
                              {[
                                { label: "Has NCES ID", ok: row.data_quality.has_nces },
                                { label: "Has State", ok: row.data_quality.has_state },
                                { label: "Has Opportunities", ok: row.data_quality.has_opps },
                                { label: "Has Schools", ok: row.data_quality.has_schools },
                                { label: "Has Sessions", ok: row.data_quality.has_sessions },
                                { label: "In District Index", ok: !row.data_quality.is_orphaned },
                              ].map(({ label, ok }) => (
                                <div key={label} className="flex items-center gap-2 text-sm">
                                  <span className={ok ? "text-green-600" : "text-red-500"}>
                                    {ok ? "\u2713" : "\u2717"}
                                  </span>
                                  <span className={ok ? "text-gray-700" : "text-gray-500"}>
                                    {label}
                                  </span>
                                </div>
                              ))}
                            </div>

                            {/* State sources */}
                            {row.state_sources && row.state_sources.length > 0 && (
                              <div className="mt-4 pt-3 border-t border-gray-200">
                                <p className="text-xs text-gray-500">
                                  State from:{" "}
                                  {row.state_sources.map(([source]) => source).join(", ")}
                                </p>
                              </div>
                            )}
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
      )}
    </div>
  );
}
