"use client";

import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import type { ActivityCategory } from "@/features/activities/types";
import type { DealKind } from "@/features/activities/lib/filters-store";

const CATEGORY_DOT: Record<ActivityCategory, string> = {
  meetings: "#403770",
  events: "#6EA3BE",
  campaigns: "#FFCF70",
  gift_drop: "#F37167",
  sponsorships: "#8AA891",
  thought_leadership: "#A78BCA",
};

const DEAL_DOT: Record<DealKind, string> = {
  won: "#69B34A",
  lost: "#F37167",
  created: "#403770",
  progressed: "#FFCF70",
};

export interface WeekStripDay {
  date: Date;
  count: number;
  categories: ActivityCategory[];
  dealKinds: DealKind[];
  oppTotal?: number;
  dealCount?: number;
}

function formatMoney(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${n}`;
}

export default function WeekStrip({
  weekAnchor,
  daysData,
  selectedDate,
  onDayClick,
  showOpps = false,
}: {
  weekAnchor: Date;
  daysData: WeekStripDay[];
  selectedDate: Date;
  onDayClick?: (date: Date) => void;
  showOpps?: boolean;
}) {
  const weekStart = startOfWeek(weekAnchor, { weekStartsOn: 0 });
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-2">
      {Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(weekStart, i);
        const data = daysData.find((d) => isSameDay(d.date, date));
        const isToday = isSameDay(date, today);
        const isSelected = isSameDay(date, selectedDate);
        const cats = data?.categories ?? [];
        const deals = data?.dealKinds ?? [];
        const itemCount = data?.count ?? 0;
        const dealCount = data?.dealCount ?? 0;
        const oppTotal = data?.oppTotal ?? 0;

        return (
          <button
            key={i}
            type="button"
            onClick={() => onDayClick?.(date)}
            className={`flex flex-col gap-1.5 px-3 py-2.5 rounded-[10px] text-left transition-all duration-120 min-h-[82px] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F37167] focus-visible:ring-offset-2 ${
              isSelected
                ? "bg-white border-[1.5px] border-[#403770] shadow-[0_2px_6px_rgba(64,55,112,0.08)]"
                : isToday
                  ? "bg-[#FFFCFA] border border-[#E2DEEC] hover:border-[#C2BBD4]"
                  : "bg-white border border-[#E2DEEC] hover:border-[#C2BBD4]"
            }`}
          >
            <div className="flex items-baseline justify-between">
              <span
                className={`text-[10px] uppercase tracking-[0.06em] font-semibold ${
                  isToday ? "text-[#F37167]" : "text-[#8A80A8]"
                }`}
              >
                {format(date, "EEE")}
              </span>
              <span className="text-lg font-bold text-[#403770] tabular-nums leading-none">
                {format(date, "d")}
              </span>
            </div>

            {itemCount === 0 && dealCount === 0 ? (
              <span className="text-[10px] text-[#A69DC0] font-medium">No items</span>
            ) : (
              <>
                <div className="flex items-center gap-[3px]">
                  {cats.slice(0, 4).map((c) => (
                    <span
                      key={c}
                      className="w-1.5 h-1.5 rounded-full"
                      style={{ backgroundColor: CATEGORY_DOT[c] }}
                    />
                  ))}
                  {cats.length > 0 && deals.length > 0 && (
                    <span className="w-px h-2 bg-[#E2DEEC] mx-0.5" />
                  )}
                  {deals.slice(0, 4).map((k, idx) => (
                    <span
                      key={`${k}-${idx}`}
                      className="w-1.5 h-1.5 rounded-[2px]"
                      style={{ backgroundColor: DEAL_DOT[k] }}
                    />
                  ))}
                </div>
                <div className="text-[11px] font-semibold text-[#544A78] tabular-nums">
                  {itemCount > 0 && (
                    <span>
                      {itemCount} {itemCount === 1 ? "item" : "items"}
                    </span>
                  )}
                  {itemCount > 0 && dealCount > 0 && (
                    <span className="text-[#C2BBD4]"> · </span>
                  )}
                  {dealCount > 0 && (
                    <span className="text-[#403770]">
                      {dealCount} deal{dealCount === 1 ? "" : "s"}
                    </span>
                  )}
                </div>
              </>
            )}

            {showOpps && oppTotal > 0 && (
              <div className="mt-auto pt-1.5 border-t border-dashed border-[#E2DEEC] flex items-center gap-1 text-[10px] font-bold tabular-nums">
                <span className="ml-auto text-[#403770]">{formatMoney(oppTotal)}</span>
              </div>
            )}
          </button>
        );
      })}
    </div>
  );
}
