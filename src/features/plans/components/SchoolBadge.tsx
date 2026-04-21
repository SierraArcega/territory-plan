"use client";

// SchoolBadge - compact badge showing which school a contact belongs to.
// Renders "<School Name> · <Level Label>" plus a "Transfer" pill when the
// school is a transfer school (schoolLevel=3 High AND schoolType=4 Alternative).

import type { ContactSchoolLink } from "@/features/shared/types/api-types";
import {
  SCHOOL_LEVEL_LABELS,
  SCHOOL_TYPE_LABELS,
} from "@/features/shared/lib/schoolLabels";

/** Transfer schools are identified as High School (level=3) + Alternative type (type=4). */
export function isTransferSchool(link: ContactSchoolLink): boolean {
  return link.schoolLevel === 3 && link.schoolType === 4;
}

interface SchoolBadgeProps {
  link: ContactSchoolLink | undefined;
  /** "inline" = single line for table cells; "block" = multi-line banner for edit forms. */
  variant?: "inline" | "block";
}

export default function SchoolBadge({ link, variant = "inline" }: SchoolBadgeProps) {
  if (!link) return null;

  const levelLabel =
    link.schoolLevel != null ? SCHOOL_LEVEL_LABELS[link.schoolLevel] : undefined;
  const typeLabel =
    link.schoolType != null ? SCHOOL_TYPE_LABELS[link.schoolType] : undefined;
  const isTransfer = isTransferSchool(link);

  if (variant === "block") {
    return (
      <div className="flex items-start gap-2 px-2.5 py-2 rounded-lg bg-[#F7F5FA] border border-[#EFEDF5]">
        <svg
          className="w-4 h-4 text-[#6EA3BE] mt-px flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={1.5}
            d="M12 14l9-5-9-5-9 5 9 5zm0 0l6.16-3.422a12.083 12.083 0 01.665 6.479A11.952 11.952 0 0012 20.055a11.952 11.952 0 00-6.824-2.998 12.078 12.078 0 01.665-6.479L12 14z"
          />
        </svg>
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#403770]/60 mb-0.5">
            School
          </div>
          <div className="flex items-center gap-1.5 flex-wrap">
            <span className="text-[13px] font-medium text-[#403770] truncate">
              {link.name}
            </span>
            {isTransfer && <TransferPill />}
          </div>
          <div className="text-[11px] text-[#403770]/60 mt-0.5">
            {levelLabel ?? "—"}
            {typeLabel ? ` · ${typeLabel}` : ""}
          </div>
        </div>
      </div>
    );
  }

  // inline variant
  return (
    <span className="inline-flex items-center gap-1.5 max-w-full">
      <span className="text-[12px] text-[#403770]/70 truncate">
        {link.name}
        {levelLabel ? (
          <span className="text-[#403770]/40">{` · ${levelLabel}`}</span>
        ) : null}
      </span>
      {isTransfer && <TransferPill />}
    </span>
  );
}

function TransferPill() {
  return (
    <span
      className="flex-shrink-0 inline-flex items-center px-1.5 py-px text-[9px] font-bold uppercase tracking-wide bg-[#FFB347] text-white rounded"
      title="Transfer school (High School · Alternative)"
    >
      Transfer
    </span>
  );
}
