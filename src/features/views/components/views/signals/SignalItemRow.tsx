"use client";

/**
 * SignalItemRow — one leaf signal in a district's expanded feed.
 *
 * Layout: type tag · title (truncates) · meta line · relative date (right).
 *
 * Read-only: rows are not interactive (no detail panel).
 */
import type { DistrictSignalItem } from "./queries";
import SignalTypeTag from "./SignalTypeTag";
import { relativeAge } from "./relative-date";

interface SignalItemRowProps {
  item: DistrictSignalItem;
}

export default function SignalItemRow({ item }: SignalItemRowProps) {
  const { type, title, meta, secondaryDate, date } = item;
  return (
    <div className="flex items-center gap-2.5 pl-9 pr-4 py-2 hover:bg-[#F7F5FA] transition-colors duration-100">
      <span className="flex-shrink-0">
        <SignalTypeTag type={type} withLabel />
      </span>
      <div className="min-w-0 flex-1">
        <div className="text-[13px] font-medium text-[#403770] truncate whitespace-nowrap">
          {title}
        </div>
        {(meta || secondaryDate) && (
          <div className="text-[12px] text-[#8A80A8] truncate whitespace-nowrap">
            {meta}
            {meta && secondaryDate ? " · " : ""}
            {secondaryDate ? `due ${relativeAge(secondaryDate)}` : ""}
          </div>
        )}
      </div>
      <span className="flex-shrink-0 text-[12px] text-[#A69DC0] whitespace-nowrap tabular-nums">
        {relativeAge(date)}
      </span>
    </div>
  );
}
