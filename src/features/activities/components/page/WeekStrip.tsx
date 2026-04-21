"use client";

import { addDays, format, isSameDay, startOfWeek } from "date-fns";
import { useActivitiesChrome } from "@/features/activities/lib/filters-store";

export interface WeekStripDay {
  date: Date;
  count: number;
  dealKinds: ("won" | "lost" | "created" | "progressed")[];
}

const DEAL_DOT_COLOR: Record<string, string> = {
  won: "#69B34A",
  lost: "#F37167",
  created: "#403770",
  progressed: "#FFCF70",
};

export default function WeekStrip({
  daysData,
  onDayClick,
}: {
  daysData: WeekStripDay[];
  onDayClick?: (date: Date) => void;
}) {
  const anchorIso = useActivitiesChrome((s) => s.anchorIso);
  const weekStart = startOfWeek(new Date(anchorIso), { weekStartsOn: 0 });
  const today = new Date();

  return (
    <div className="grid grid-cols-7 gap-1.5 px-6 py-3 bg-[#FFFCFA] border-b border-[#E2DEEC]">
      {Array.from({ length: 7 }).map((_, i) => {
        const date = addDays(weekStart, i);
        const data = daysData.find((d) => isSameDay(d.date, date));
        const isToday = isSameDay(date, today);
        return (
          <button
            key={i}
            type="button"
            onClick={() => onDayClick?.(date)}
            className={`flex flex-col items-center gap-1 px-2 py-2 rounded-lg border transition-colors text-left ${
              isToday
                ? "bg-white border-[#F37167]"
                : "bg-white border-[#E2DEEC] hover:border-[#C2BBD4]"
            }`}
          >
            <span className="text-[10px] uppercase tracking-wider font-bold text-[#8A80A8]">
              {format(date, "EEE")}
            </span>
            <span className="text-base font-bold text-[#403770]">{format(date, "d")}</span>
            <div className="flex items-center gap-1 mt-0.5 min-h-[8px]">
              {(data?.dealKinds ?? []).slice(0, 4).map((k, idx) => (
                <span
                  key={`${k}-${idx}`}
                  className="w-1.5 h-1.5 rounded-full"
                  style={{ backgroundColor: DEAL_DOT_COLOR[k] }}
                />
              ))}
            </div>
            <span className="text-[10px] text-[#8A80A8]">
              {data?.count ?? 0} item{(data?.count ?? 0) === 1 ? "" : "s"}
            </span>
          </button>
        );
      })}
    </div>
  );
}
