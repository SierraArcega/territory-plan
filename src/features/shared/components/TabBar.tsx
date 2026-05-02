"use client";

import type { ReactNode } from "react";
import { cn } from "@/features/shared/lib/cn";

export interface TabBarItem<TId extends string = string> {
  id: TId;
  label: ReactNode;
  count?: number | null;
  icon?: ReactNode;
}

export interface TabBarProps<TId extends string = string> {
  tabs: TabBarItem<TId>[];
  active: TId;
  onChange: (id: TId) => void;
  ariaLabel?: string;
  className?: string;
}

/**
 * Tab strip with coral active underline (per token system) and optional count badges.
 * Renders as role="tablist" with role="tab" buttons; consumers render their own tabpanels.
 */
export default function TabBar<TId extends string = string>({
  tabs,
  active,
  onChange,
  ariaLabel,
  className,
}: TabBarProps<TId>) {
  return (
    <div
      role="tablist"
      aria-label={ariaLabel}
      className={cn("flex border-b border-[#E2DEEC] px-5", className)}
    >
      {tabs.map((t) => {
        const on = t.id === active;
        return (
          <button
            key={t.id}
            role="tab"
            type="button"
            aria-selected={on}
            tabIndex={on ? 0 : -1}
            onClick={() => onChange(t.id)}
            className={cn(
              "py-2.5 mr-[18px] text-xs font-semibold tracking-[0.02em] inline-flex items-center gap-1.5",
              "border-b-2 transition-[color,border-color] duration-[120ms]",
              on
                ? "text-[#403770] border-[#F37167]"
                : "text-[#8A80A8] border-transparent hover:text-[#403770]"
            )}
          >
            {t.icon}
            {t.label}
            {t.count != null && (
              <span
                className={cn(
                  "text-[10px] font-bold px-1.5 rounded-full min-w-4 text-center leading-4",
                  on ? "bg-[#403770] text-white" : "bg-[#EFEDF5] text-[#8A80A8]"
                )}
              >
                {t.count}
              </span>
            )}
          </button>
        );
      })}
    </div>
  );
}
