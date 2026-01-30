"use client";

import { StateDetail } from "@/lib/api";

interface StateHeaderProps {
  state: StateDetail;
}

export default function StateHeader({ state }: StateHeaderProps) {
  const { aggregates } = state;

  // Format large numbers
  const formatNumber = (n: number | null) => {
    if (n === null) return "N/A";
    return new Intl.NumberFormat("en-US").format(n);
  };

  return (
    <div className="px-6 pt-6 pb-4 border-b border-gray-100 bg-gradient-to-b from-gray-50 to-white">
      {/* State name and code */}
      <div className="flex items-start justify-between mb-4">
        <div>
          <h2 className="text-xl font-bold text-[#403770]">{state.name}</h2>
          <span className="text-sm text-gray-500">{state.code}</span>
        </div>
        {state.territoryOwner && (
          <div className="text-right">
            <span className="text-xs text-gray-500 block">Territory Owner</span>
            <span className="text-sm font-medium text-[#403770]">
              {state.territoryOwner}
            </span>
          </div>
        )}
      </div>

      {/* Quick stats row */}
      <div className="grid grid-cols-4 gap-3">
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-[#403770]">
            {formatNumber(aggregates.totalDistricts)}
          </div>
          <div className="text-xs text-gray-500">Districts</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-[#F37167]">
            {formatNumber(aggregates.totalCustomers)}
          </div>
          <div className="text-xs text-gray-500">Customers</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-[#6EA3BE]">
            {formatNumber(aggregates.totalWithPipeline)}
          </div>
          <div className="text-xs text-gray-500">Pipeline</div>
        </div>
        <div className="bg-white rounded-lg p-3 shadow-sm border border-gray-100">
          <div className="text-lg font-bold text-gray-700">
            {aggregates.totalEnrollment
              ? `${(aggregates.totalEnrollment / 1000000).toFixed(1)}M`
              : "N/A"}
          </div>
          <div className="text-xs text-gray-500">Students</div>
        </div>
      </div>
    </div>
  );
}
