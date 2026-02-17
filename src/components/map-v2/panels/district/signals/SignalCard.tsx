"use client";

import { useState, type ReactNode } from "react";

interface SignalCardProps {
  icon: ReactNode;
  title: string;
  badge: ReactNode;
  children: ReactNode;
  detail?: ReactNode;
  defaultExpanded?: boolean;
}

export default function SignalCard({
  icon,
  title,
  badge,
  children,
  detail,
  defaultExpanded = false,
}: SignalCardProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  return (
    <div className="border border-gray-100 rounded-xl bg-white">
      {/* Header row */}
      <div className="flex items-center justify-between px-3 pt-3 pb-1">
        <div className="flex items-center gap-2">
          <span className="text-gray-400">{icon}</span>
          <h3 className="text-sm font-semibold text-[#403770]">{title}</h3>
        </div>
        {badge}
      </div>

      {/* Primary metric + context */}
      <div className="px-3 pb-3">{children}</div>

      {/* Expandable detail */}
      {detail && (
        <>
          <button
            onClick={() => setExpanded(!expanded)}
            className="w-full flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-gray-400 hover:text-[#403770] border-t border-gray-50 transition-colors"
          >
            <svg
              className={`w-3 h-3 transition-transform ${expanded ? "rotate-90" : ""}`}
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
            {expanded ? "Hide details" : "View details"}
          </button>
          {expanded && (
            <div className="px-3 pb-3 border-t border-gray-50">
              {detail}
            </div>
          )}
        </>
      )}
    </div>
  );
}
