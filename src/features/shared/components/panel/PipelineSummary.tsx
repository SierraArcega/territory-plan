"use client";

import type { FullmindData } from "@/lib/api";

interface PipelineSummaryProps {
  fullmindData: FullmindData;
}

function formatCurrency(value: number): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export default function PipelineSummary({
  fullmindData,
}: PipelineSummaryProps) {
  const hasFy26Pipeline = fullmindData.fy26OpenPipeline > 0;
  const hasFy27Pipeline = fullmindData.fy27OpenPipeline > 0;

  if (!hasFy26Pipeline && !hasFy27Pipeline) {
    return (
      <div>
        <h3 className="text-sm font-bold text-[#403770] mb-3">
          Open Pipeline
        </h3>
        <p className="text-sm text-gray-500">No open pipeline</p>
      </div>
    );
  }

  return (
    <div>
      <h3 className="text-sm font-bold text-[#403770] mb-3">Open Pipeline</h3>

      <div className="space-y-3">
        {/* FY26 Pipeline */}
        {hasFy26Pipeline && (
          <div className="p-3 bg-[#C4E7E6]/30 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-medium text-[#403770]">FY26</span>
                <p className="text-lg font-bold text-[#403770]">
                  {formatCurrency(fullmindData.fy26OpenPipeline)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">Weighted</span>
                <p className="text-sm font-medium text-gray-700">
                  {formatCurrency(fullmindData.fy26OpenPipelineWeighted)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              {fullmindData.fy26OpenPipelineOppCount} opportunity
              {fullmindData.fy26OpenPipelineOppCount !== 1 ? "ies" : "y"}
            </div>
          </div>
        )}

        {/* FY27 Pipeline */}
        {hasFy27Pipeline && (
          <div className="p-3 bg-[#EDFFE3]/50 rounded-lg">
            <div className="flex justify-between items-start">
              <div>
                <span className="text-xs font-medium text-[#403770]">FY27</span>
                <p className="text-lg font-bold text-[#403770]">
                  {formatCurrency(fullmindData.fy27OpenPipeline)}
                </p>
              </div>
              <div className="text-right">
                <span className="text-xs text-gray-500">Weighted</span>
                <p className="text-sm font-medium text-gray-700">
                  {formatCurrency(fullmindData.fy27OpenPipelineWeighted)}
                </p>
              </div>
            </div>
            <div className="mt-2 flex items-center gap-2 text-xs text-gray-600">
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
                  d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
                />
              </svg>
              {fullmindData.fy27OpenPipelineOppCount} opportunity
              {fullmindData.fy27OpenPipelineOppCount !== 1 ? "ies" : "y"}
            </div>
          </div>
        )}

        {/* Total */}
        {hasFy26Pipeline && hasFy27Pipeline && (
          <div className="pt-2 border-t border-gray-200">
            <div className="flex justify-between items-center text-sm">
              <span className="text-gray-600">Total Pipeline</span>
              <span className="font-bold text-[#403770]">
                {formatCurrency(
                  fullmindData.fy26OpenPipeline + fullmindData.fy27OpenPipeline
                )}
              </span>
            </div>
            <div className="flex justify-between items-center text-xs mt-1">
              <span className="text-gray-500">Total Weighted</span>
              <span className="text-gray-700">
                {formatCurrency(
                  fullmindData.fy26OpenPipelineWeighted +
                    fullmindData.fy27OpenPipelineWeighted
                )}
              </span>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
