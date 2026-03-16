"use client";

import { ReactNode } from "react";

interface FeedSectionProps {
  title: string;
  dotColor: string;
  itemCount: number;
  children: ReactNode;
}

export default function FeedSection({
  title,
  dotColor,
  itemCount,
  children,
}: FeedSectionProps) {
  return (
    <div className="flex flex-col gap-3">
      {/* Section header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="w-2 h-2 rounded-full shrink-0"
            style={{ backgroundColor: dotColor }}
          />
          <span className="text-xs font-bold text-[#403770] uppercase tracking-[0.5px]">
            {title}
          </span>
        </div>
        <span className="text-xs font-medium text-[#8A80A8]">
          {itemCount} {itemCount === 1 ? "item" : "items"}
        </span>
      </div>

      {/* Content list */}
      <div className="bg-white rounded-lg border border-[#D4CFE2] overflow-hidden divide-y divide-[#E2DEEC]">
        {children}
      </div>
    </div>
  );
}
