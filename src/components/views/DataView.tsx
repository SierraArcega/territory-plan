"use client";

/**
 * DataView is a placeholder for the upcoming Data Reconciliation feature.
 * This will eventually allow users to:
 * - View unmatched accounts from Fullmind data
 * - Manually match accounts to districts
 * - Track data quality metrics
 * - Manage data refresh schedules
 */
export default function DataView() {
  return (
    <div className="h-full overflow-auto bg-[#FFFCFA]">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="max-w-6xl mx-auto">
          <h1 className="text-2xl font-bold text-[#403770]">Data Reconciliation</h1>
          <p className="text-sm text-gray-500 mt-0.5">
            Manage unmatched accounts and data quality
          </p>
        </div>
      </header>

      {/* Placeholder Content */}
      <main className="max-w-6xl mx-auto px-6 py-8">
        <div className="flex flex-col items-center justify-center py-20">
          {/* Database icon */}
          <svg
            className="w-24 h-24 text-gray-300 mb-6"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M4 7v10c0 2.21 3.582 4 8 4s8-1.79 8-4V7M4 7c0 2.21 3.582 4 8 4s8-1.79 8-4M4 7c0-2.21 3.582-4 8-4s8 1.79 8 4m0 5c0 2.21-3.582 4-8 4s-8-1.79-8-4"
            />
          </svg>

          <h2 className="text-xl font-semibold text-[#403770] mb-3">
            Coming Soon
          </h2>

          <p className="text-gray-500 text-center max-w-md mb-8">
            This is where you&apos;ll manage unmatched accounts and data quality.
            The data reconciliation feature is currently in development.
          </p>

          {/* Feature preview cards */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 w-full max-w-2xl">
            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="w-10 h-10 bg-[#C4E7E6] rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[#403770]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                </svg>
              </div>
              <h3 className="font-medium text-[#403770] mb-1">Unmatched Accounts</h3>
              <p className="text-xs text-gray-500">Review and match Fullmind accounts to districts</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="w-10 h-10 bg-[#C4E7E6] rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[#403770]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
                </svg>
              </div>
              <h3 className="font-medium text-[#403770] mb-1">Data Quality</h3>
              <p className="text-xs text-gray-500">Track match rates and data completeness</p>
            </div>

            <div className="bg-white rounded-lg border border-gray-200 p-4 text-center">
              <div className="w-10 h-10 bg-[#C4E7E6] rounded-lg flex items-center justify-center mx-auto mb-3">
                <svg className="w-5 h-5 text-[#403770]" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                </svg>
              </div>
              <h3 className="font-medium text-[#403770] mb-1">Refresh History</h3>
              <p className="text-xs text-gray-500">View ETL runs and data update logs</p>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
