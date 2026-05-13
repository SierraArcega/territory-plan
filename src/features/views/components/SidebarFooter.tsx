"use client";

/**
 * Sidebar footer — "+ New list" dashed CTA + 28px profile avatar.
 *
 * The dashed button mirrors the prototype's primary creation entry from the
 * sidebar bottom strip. The avatar shows the current user's initials in
 * plum on a robin's-egg background (per the design handoff §Footer).
 */
import { Plus } from "lucide-react";
import { useViewsStore } from "../lib/store";
import { useProfile } from "@/features/shared/lib/queries";

/** Build initials from a name: "Sierra Arcega" -> "SA"; fallback to first two letters. */
function initialsOf(name: string | null | undefined): string {
  if (!name) return "?";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

export default function SidebarFooter() {
  const openBuilder = useViewsStore((s) => s.openBuilder);
  const { data: profile, isLoading } = useProfile();

  return (
    <footer className="border-t border-[#E2DEEC] px-3 pt-3 pb-3 flex flex-col gap-3">
      {/* + New list dashed button — opens the list builder with no seed */}
      <button
        type="button"
        onClick={() => openBuilder()}
        className="w-full flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border border-dashed border-[#C2BBD4] text-xs font-medium text-[#544A78] hover:text-[#403770] hover:border-[#403770] hover:bg-[#FEF2F1] transition-colors duration-100"
      >
        <Plus className="w-3.5 h-3.5" aria-hidden strokeWidth={2.25} />
        <span className="whitespace-nowrap">New list</span>
      </button>

      {/* Profile card — 28px avatar + name + pod label */}
      <div className="flex items-center gap-2.5 px-1 min-w-0">
        <div
          className="flex-shrink-0 w-7 h-7 rounded-full bg-[#C4E7E6] flex items-center justify-center"
          aria-hidden
        >
          <span className="text-[11px] font-semibold text-[#403770] tabular-nums">
            {isLoading ? "…" : initialsOf(profile?.fullName)}
          </span>
        </div>
        <div className="flex-1 min-w-0 flex flex-col">
          <span className="text-xs font-semibold text-[#403770] whitespace-nowrap truncate">
            {isLoading ? " " : profile?.fullName ?? profile?.email ?? "—"}
          </span>
          <span className="text-[10px] text-[#8A80A8] whitespace-nowrap truncate">
            {profile?.jobTitle ?? "Fullmind"}
          </span>
        </div>
      </div>
    </footer>
  );
}
