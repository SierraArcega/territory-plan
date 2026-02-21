"use client";

import { useState } from "react";

interface FocusCardProps {
  title: string;
  children: React.ReactNode;
  onDismiss: () => void;
  className?: string;
  defaultCollapsed?: boolean;
}

export default function FocusCard({
  title,
  children,
  onDismiss,
  className = "",
  defaultCollapsed = false,
}: FocusCardProps) {
  const [collapsed, setCollapsed] = useState(defaultCollapsed);

  return (
    <div
      className={`
        bg-white/85 backdrop-blur-xl shadow-lg border border-white/50 rounded-2xl
        overflow-hidden transition-all duration-200
        ${className}
      `}
    >
      {/* Header — always visible */}
      <div className="flex items-center justify-between px-3 py-2">
        <button
          onClick={() => setCollapsed(!collapsed)}
          className="flex items-center gap-1.5 text-[10px] font-semibold text-gray-400 uppercase tracking-wider hover:text-gray-600 transition-colors"
        >
          <svg
            width="8"
            height="8"
            viewBox="0 0 8 8"
            fill="none"
            className={`transition-transform duration-200 ${collapsed ? "-rotate-90" : ""}`}
          >
            <path d="M2 3L4 5L6 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          {title}
        </button>
        <button
          onClick={onDismiss}
          className="w-4 h-4 rounded-full hover:bg-gray-200/50 flex items-center justify-center transition-colors"
          aria-label="Dismiss"
        >
          <svg width="6" height="6" viewBox="0 0 8 8" fill="none">
            <path d="M1 1L7 7M7 1L1 7" stroke="#9CA3AF" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>

      {/* Content — collapsible */}
      {!collapsed && (
        <div className="px-3 pb-3">
          {children}
        </div>
      )}
    </div>
  );
}
