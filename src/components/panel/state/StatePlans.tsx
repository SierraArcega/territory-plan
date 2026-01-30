"use client";

import Link from "next/link";
import { StateTerritoryPlan } from "@/lib/api";

interface StatePlansProps {
  plans: StateTerritoryPlan[];
}

export default function StatePlans({ plans }: StatePlansProps) {
  if (plans.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-12 px-4 text-center">
        <svg
          className="w-12 h-12 text-gray-300 mb-3"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2"
          />
        </svg>
        <p className="text-gray-500 text-sm">No territory plans for this state</p>
        <Link
          href="/plans"
          className="mt-3 text-sm text-[#403770] hover:text-[#F37167] font-medium"
        >
          Create a plan
        </Link>
      </div>
    );
  }

  // Status badge colors
  const statusColors: Record<string, { bg: string; text: string }> = {
    active: { bg: "bg-green-100", text: "text-green-700" },
    draft: { bg: "bg-yellow-100", text: "text-yellow-700" },
    archived: { bg: "bg-gray-100", text: "text-gray-500" },
  };

  return (
    <div className="divide-y divide-gray-100">
      {plans.map((plan) => (
        <Link
          key={plan.id}
          href={`/plans/${plan.id}`}
          className="block px-4 py-3 hover:bg-gray-50 transition-colors"
        >
          <div className="flex items-start gap-3">
            {/* Color indicator */}
            <div
              className="w-3 h-3 rounded-full flex-shrink-0 mt-1"
              style={{ backgroundColor: plan.color }}
            />

            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2">
                <span className="font-medium text-sm text-gray-900 truncate">
                  {plan.name}
                </span>
                <span
                  className={`inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium ${
                    statusColors[plan.status]?.bg || "bg-gray-100"
                  } ${statusColors[plan.status]?.text || "text-gray-500"}`}
                >
                  {plan.status}
                </span>
              </div>

              <div className="flex items-center gap-3 mt-1 text-xs text-gray-500">
                <span>{plan.districtCount} districts</span>
                {plan.owner && (
                  <>
                    <span className="text-gray-300">|</span>
                    <span>{plan.owner}</span>
                  </>
                )}
              </div>
            </div>

            {/* Arrow icon */}
            <svg
              className="w-4 h-4 text-gray-400 flex-shrink-0"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M9 5l7 7-7 7"
              />
            </svg>
          </div>
        </Link>
      ))}

      {/* Link to all plans */}
      <div className="px-4 py-3 bg-gray-50/50">
        <Link
          href="/plans"
          className="text-sm text-[#403770] hover:text-[#F37167] font-medium flex items-center gap-1"
        >
          View all plans
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
              d="M14 5l7 7m0 0l-7 7m7-7H3"
            />
          </svg>
        </Link>
      </div>
    </div>
  );
}
