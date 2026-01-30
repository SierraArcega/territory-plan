"use client";

import { useState, useCallback } from "react";
import { useStateDistricts, StateDistrictListItem } from "@/lib/api";
import { useMapStore } from "@/lib/store";

interface StateDistrictsListProps {
  stateCode: string;
}

type StatusFilter = "all" | "customer" | "pipeline" | "customer_pipeline";

export default function StateDistrictsList({ stateCode }: StateDistrictsListProps) {
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const { openDistrictPanel, setHoveredLeaid } = useMapStore();

  const { data, isLoading, error } = useStateDistricts({
    stateCode,
    search: search || undefined,
    status: statusFilter,
    limit: 100,
  });

  const handleDistrictClick = useCallback(
    (leaid: string) => {
      openDistrictPanel(leaid);
    },
    [openDistrictPanel]
  );

  // Format currency
  const formatCurrency = (n: number) => {
    if (n === 0) return "-";
    if (n >= 1000000) return `$${(n / 1000000).toFixed(1)}M`;
    if (n >= 1000) return `$${(n / 1000).toFixed(0)}K`;
    return `$${n}`;
  };

  // Status badge component
  const StatusBadge = ({ isCustomer, hasOpenPipeline }: { isCustomer: boolean; hasOpenPipeline: boolean }) => {
    if (isCustomer && hasOpenPipeline) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#403770] text-white">
          Customer + Pipeline
        </span>
      );
    }
    if (isCustomer) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#F37167] text-white">
          Customer
        </span>
      );
    }
    if (hasOpenPipeline) {
      return (
        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-medium bg-[#6EA3BE] text-white">
          Pipeline
        </span>
      );
    }
    return null;
  };

  return (
    <div className="flex flex-col h-full">
      {/* Search and filter bar */}
      <div className="px-4 py-3 border-b border-gray-100 bg-gray-50/50 space-y-2">
        {/* Search input */}
        <div className="relative">
          <svg
            className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
            />
          </svg>
          <input
            type="text"
            placeholder="Search districts..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20 focus:border-[#403770]"
          />
        </div>

        {/* Filter buttons */}
        <div className="flex gap-1">
          {(
            [
              { value: "all", label: "All" },
              { value: "customer", label: "Customers" },
              { value: "pipeline", label: "Pipeline" },
            ] as const
          ).map(({ value, label }) => (
            <button
              key={value}
              onClick={() => setStatusFilter(value)}
              className={`px-3 py-1 text-xs font-medium rounded-full transition-colors ${
                statusFilter === value
                  ? "bg-[#403770] text-white"
                  : "bg-white text-gray-600 border border-gray-200 hover:bg-gray-50"
              }`}
            >
              {label}
            </button>
          ))}
        </div>
      </div>

      {/* District list */}
      <div className="flex-1 overflow-y-auto">
        {isLoading ? (
          <div className="flex items-center justify-center py-8">
            <div className="animate-spin rounded-full h-6 w-6 border-2 border-[#F37167] border-t-transparent" />
          </div>
        ) : error ? (
          <div className="text-center py-8 text-red-500 text-sm">
            Error loading districts
          </div>
        ) : data?.districts.length === 0 ? (
          <div className="text-center py-8 text-gray-400 text-sm">
            {search ? "No districts match your search" : "No districts found"}
          </div>
        ) : (
          <div className="divide-y divide-gray-100">
            {data?.districts.map((district: StateDistrictListItem) => (
              <button
                key={district.leaid}
                onClick={() => handleDistrictClick(district.leaid)}
                onMouseEnter={() => setHoveredLeaid(district.leaid)}
                onMouseLeave={() => setHoveredLeaid(null)}
                className="w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors"
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium text-sm text-gray-900 truncate">
                      {district.name}
                    </div>
                    <div className="flex items-center gap-2 mt-1">
                      <StatusBadge
                        isCustomer={district.isCustomer}
                        hasOpenPipeline={district.hasOpenPipeline}
                      />
                      {district.enrollment && (
                        <span className="text-xs text-gray-500">
                          {district.enrollment.toLocaleString()} students
                        </span>
                      )}
                    </div>
                    {/* Tags */}
                    {district.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 mt-1.5">
                        {district.tags.map((tag) => (
                          <span
                            key={tag.id}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium"
                            style={{
                              backgroundColor: `${tag.color}20`,
                              color: tag.color,
                            }}
                          >
                            {tag.name}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  <div className="text-right flex-shrink-0">
                    {district.isCustomer && district.fy26NetInvoicing > 0 && (
                      <div className="text-sm font-medium text-[#F37167]">
                        {formatCurrency(district.fy26NetInvoicing)}
                      </div>
                    )}
                    {district.hasOpenPipeline && district.fy26OpenPipeline > 0 && (
                      <div className="text-xs text-[#6EA3BE]">
                        {formatCurrency(district.fy26OpenPipeline)} pipeline
                      </div>
                    )}
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Results count */}
      {data && (
        <div className="px-4 py-2 text-xs text-gray-500 border-t border-gray-100 bg-gray-50/50">
          Showing {data.districts.length} of {data.total} districts
        </div>
      )}
    </div>
  );
}
