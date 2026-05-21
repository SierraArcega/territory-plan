"use client";

/**
 * SignalItemRow — one leaf signal in a district's expanded feed.
 *
 * Layout: type tag · title (truncates) · meta line · relative date (right).
 *
 * The root carries `data-row-kind` + `data-row-id` so GroupCanvas's central
 * click delegation opens the existing detail panel — NO onClick wiring here.
 * Type codes map to the existing DetailKind union:
 *   vac → "vacancy"  ·  news → "news"  ·  rfp → "rfp"
 * RFP ids are numeric server-side; the wire shape already stringifies them and
 * we coerce again defensively (`String(id)`) so the attribute is always a
 * string the rfp detail route can `parseInt`.
 */
import type { DetailKind } from "@/features/views/lib/view-types";
import type { SignalType } from "@/lib/signals/sql";
import type { DistrictSignalItem } from "./queries";
import SignalTypeTag from "./SignalTypeTag";
import { relativeAge } from "./relative-date";

/** Map a signal type code to the DetailKind the row click should open. */
export function detailKindForType(type: SignalType): DetailKind {
  switch (type) {
    case "vac":
      return "vacancy";
    case "news":
      return "news";
    case "rfp":
      return "rfp";
  }
}

interface SignalItemRowProps {
  item: DistrictSignalItem;
}

export default function SignalItemRow({ item }: SignalItemRowProps) {
  const { type, id, title, meta, secondaryDate, date } = item;
  return (
    <div
      data-row-kind={detailKindForType(type)}
      data-row-id={String(id)}
      className="flex items-center gap-2.5 pl-9 pr-4 py-2 cursor-pointer hover:bg-[#F7F5FA] transition-colors duration-100"
    >
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
