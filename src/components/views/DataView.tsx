"use client";

import { useState } from "react";
import {
  useReconciliationUnmatched,
  useReconciliationFragmented,
  ReconciliationFilters,
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

        {/* Content placeholder */}
        {!isLoading && !error && (
          <div className="bg-white rounded-lg border border-gray-200 p-8 text-center text-gray-500">
            {activeTab === "unmatched"
              ? `${unmatchedData?.length || 0} unmatched accounts`
              : `${fragmentedData?.length || 0} fragmented districts`}
          </div>
        )}
      </main>
    </div>
  );
}
