"use client";

import { useState, Fragment } from "react";
import {
  useReconciliationUnmatched,
  useReconciliationFragmented,
  ReconciliationFilters,
  ReconciliationUnmatchedAccount,
  ReconciliationFragmentedDistrict,
} from "@/lib/api";

type TabType = "unmatched" | "fragmented";

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

  const isLoading = activeTab === "unmatched" ? unmatchedLoading : fragmentedLoading;
  const error = activeTab === "unmatched" ? unmatchedError : fragmentedError;

  const handleExport = () => {
    const data = activeTab === "unmatched" ? unmatchedData : fragmentedData;
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
    } else {
      csv = "NCES ID,District Name,State,Account Variants,Similarity Score\n";
      csv += (data as ReconciliationFragmentedDistrict[])
        .map(
          (row) =>
            `"${row.nces_id}","${row.district_name || ""}","${row.state || ""}","${row.account_variants.map((v) => v.name).join("; ")}",${row.similarity_score}`
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
            <button
              onClick={handleExport}
              disabled={!unmatchedData && !fragmentedData}
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
