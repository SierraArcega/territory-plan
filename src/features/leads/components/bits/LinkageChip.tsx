// Linkage chip — flags timeline items whose source is non-obvious for the
// record being viewed: a district/school-wide signal (School icon, steel tint)
// or another contact at the account (Users icon, purple tint). The record's
// own contact activity is left unlabeled (render nothing). Pixels per
// LeadActivity.jsx in the design handoff.

import { School, Users } from "lucide-react";
import type { TimelineAttribution } from "@/features/leads/lib/types";

interface LinkageChipProps {
  attribution: TimelineAttribution;
  /** Label override (contact name, "School-wide", …). */
  name: string | null;
}

export default function LinkageChip({ attribution, name }: LinkageChipProps) {
  if (attribution === "own_contact") return null;
  const districtWide = attribution === "district_wide";
  const Icon = districtWide ? School : Users;
  return (
    <span
      title={
        districtWide
          ? "Logged on the district record — shown here because this lead works at this district"
          : "Logged on another contact at this district"
      }
      className="ml-auto inline-flex shrink-0 items-center gap-1 whitespace-nowrap rounded-full px-[7px] py-px text-[9.5px] font-bold tracking-[0.02em]"
      style={
        districtWide
          ? { background: "#E8F1F5", color: "#4D7285" }
          : { background: "#EFECFB", color: "#5A4F9E" }
      }
    >
      <Icon size={10} aria-hidden />
      {districtWide ? (name ?? "District-wide") : (name ?? "Other contact")}
    </span>
  );
}
