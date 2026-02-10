"use client";

import { StateDetail, useTasks } from "@/lib/api";

interface StateStatsProps {
  state: StateDetail;
}

export default function StateStats({ state }: StateStatsProps) {
  const { aggregates } = state;

  // Fetch all user tasks — we count how many are NOT done for the summary
  const { data: tasksData } = useTasks();
  const openTaskCount = tasksData?.tasks.filter((t) => t.status !== "done").length ?? 0;

  // Format currency
  const formatCurrency = (n: number | null) => {
    if (n === null) return "N/A";
    return new Intl.NumberFormat("en-US", {
      style: "currency",
      currency: "USD",
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(n);
  };

  // Format percentage
  const formatPercent = (n: number | null) => {
    if (n === null) return "N/A";
    return `${n.toFixed(1)}%`;
  };

  // Format large numbers
  const formatNumber = (n: number | null) => {
    if (n === null) return "N/A";
    return new Intl.NumberFormat("en-US").format(n);
  };

  return (
    <div className="px-6 py-4">
      {/* Business Metrics */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#403770] mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          Business Metrics
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700">
              {formatCurrency(aggregates.totalPipelineValue)}
            </div>
            <div className="text-xs text-gray-500">Total Pipeline</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700">
              {formatNumber(aggregates.totalSchools)}
            </div>
            <div className="text-xs text-gray-500">Total Schools</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700">
              {openTaskCount}
            </div>
            <div className="text-xs text-gray-500">Open Tasks</div>
          </div>
        </div>
      </div>

      {/* Education Metrics */}
      <div className="mb-6">
        <h3 className="text-sm font-semibold text-[#403770] mb-3 flex items-center gap-2">
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6.253v13m0-13C10.832 5.477 9.246 5 7.5 5S4.168 5.477 3 6.253v13C4.168 18.477 5.754 18 7.5 18s3.332.477 4.5 1.253m0-13C13.168 5.477 14.754 5 16.5 5c1.747 0 3.332.477 4.5 1.253v13C19.832 18.477 18.247 18 16.5 18c-1.746 0-3.332.477-4.5 1.253" />
          </svg>
          Education Metrics
        </h3>
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700">
              {formatCurrency(aggregates.avgExpenditurePerPupil)}
            </div>
            <div className="text-xs text-gray-500">Avg $/Pupil</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700">
              {formatPercent(aggregates.avgGraduationRate)}
            </div>
            <div className="text-xs text-gray-500">Grad Rate</div>
          </div>
          <div className="bg-gray-50 rounded-lg p-3">
            <div className="text-sm font-medium text-gray-700">
              {formatPercent(aggregates.avgPovertyRate)}
            </div>
            <div className="text-xs text-gray-500">Poverty Rate</div>
          </div>
        </div>
      </div>
    </div>
  );
}
