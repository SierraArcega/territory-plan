"use client";

import { useState } from "react";
import { useSavedReports, useDeleteReportMutation } from "../lib/queries";
import { ENTITY_LABELS } from "../lib/field-maps";

interface ReportsListProps {
  onNewReport: () => void;
  onOpenReport: (id: string) => void;
}

export default function ReportsList({
  onNewReport,
  onOpenReport,
}: ReportsListProps) {
  const { data: reports, isLoading, isError, refetch } = useSavedReports();
  const deleteMutation = useDeleteReportMutation();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = (id: string) => {
    if (deletingId === id) {
      // Confirmed — actually delete
      deleteMutation.mutate(id, {
        onSettled: () => setDeletingId(null),
      });
    } else {
      // First click — ask for confirmation
      setDeletingId(id);
    }
  };

  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };

  return (
    <div className="h-full overflow-y-auto bg-[#FFFCFA]">
      <div className="max-w-5xl mx-auto px-8 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-xl font-bold text-[#403770]">Reports</h1>
            <p className="text-sm text-[#6E6390] mt-1">
              Build custom reports from your territory data
            </p>
          </div>
          <button
            onClick={onNewReport}
            className="flex items-center gap-2 px-4 py-2 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#322a5a] transition-colors duration-100"
          >
            <svg
              className="w-4 h-4"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M12 4v16m8-8H4"
              />
            </svg>
            New Report
          </button>
        </div>

        {/* Loading */}
        {isLoading && (
          <div className="space-y-3">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="bg-white border border-[#D4CFE2] rounded-lg p-4 animate-pulse"
              >
                <div className="h-4 bg-[#EFEDF5] rounded w-1/3 mb-2" />
                <div className="h-3 bg-[#EFEDF5] rounded w-1/4" />
              </div>
            ))}
          </div>
        )}

        {/* Error */}
        {isError && (
          <div className="bg-[#fef1f0] border border-[#f58d85] rounded-lg p-4 text-center">
            <p className="text-sm text-[#F37167] font-medium">
              Failed to load reports
            </p>
            <button
              onClick={() => refetch()}
              className="mt-2 text-sm text-[#403770] font-medium hover:underline"
            >
              Try again
            </button>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !isError && reports && reports.length === 0 && (
          <div className="text-center py-16">
            <div className="inline-flex items-center justify-center w-16 h-16 bg-[#EFEDF5] rounded-full mb-4">
              <svg
                className="w-8 h-8 text-[#8A80A8]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={1.5}
                  d="M3 10h4v11H3zM10 3h4v18h-4zM17 7h4v14h-4z"
                />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-[#403770] mb-2">
              No reports yet
            </h2>
            <p className="text-sm text-[#6E6390] mb-6 max-w-sm mx-auto">
              Create your first report to explore your territory data with
              custom columns, filters, and exports.
            </p>
            <button
              onClick={onNewReport}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#403770] text-white text-sm font-medium rounded-lg hover:bg-[#322a5a] transition-colors duration-100"
            >
              <svg
                className="w-4 h-4"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 4v16m8-8H4"
                />
              </svg>
              Create your first report
            </button>
          </div>
        )}

        {/* Report cards */}
        {reports && reports.length > 0 && (
          <div className="space-y-3">
            {reports.map((report) => (
              <div
                key={report.id}
                className="bg-white border border-[#D4CFE2] rounded-lg p-4 hover:bg-[#EFEDF5] transition-colors duration-100 cursor-pointer group"
                onClick={() => onOpenReport(report.id)}
              >
                <div className="flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <h3 className="text-sm font-semibold text-[#403770] truncate">
                      {report.name}
                    </h3>
                    <div className="flex items-center gap-3 mt-1">
                      <span className="inline-flex items-center px-2 py-0.5 bg-[#F7F5FA] border border-[#E2DEEC] rounded-full text-xs font-medium text-[#544A78]">
                        {ENTITY_LABELS[report.source] ?? report.source}
                      </span>
                      <span className="text-xs text-[#8A80A8]">
                        Updated {formatDate(report.updatedAt)}
                      </span>
                      {report.creator?.fullName && (
                        <span className="text-xs text-[#8A80A8]">
                          by {report.creator.fullName}
                        </span>
                      )}
                      {report.sharedWith.length > 0 && (
                        <span className="text-xs text-[#8A80A8]">
                          Shared with {report.sharedWith.length}
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        handleDelete(report.id);
                      }}
                      className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors duration-100 ${
                        deletingId === report.id
                          ? "bg-[#F37167] text-white"
                          : "text-[#6E6390] hover:bg-[#fef1f0] hover:text-[#F37167]"
                      }`}
                    >
                      {deletingId === report.id ? "Confirm Delete" : "Delete"}
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
