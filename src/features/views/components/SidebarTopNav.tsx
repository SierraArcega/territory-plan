"use client";

/**
 * Top navigation block in the My Views sidebar.
 *
 * Renders the same nav items the legacy Sidebar.tsx surfaces — Home, Map,
 * Activities, Tasks, Leaderboard — minus the "Plans" tab, whose role is now
 * subsumed by the My Views section below. Clicking any item routes back to
 * the legacy `/?tab=<id>` URL so we don't have to rebuild every tab right now.
 *
 * Density: padding follows the persisted Zustand `density` slice — compact
 * by default (px-3 py-2), comfortable adds vertical breathing room.
 */
import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Home,
  Map as MapIcon,
  CalendarCheck2,
  ListChecks,
  type LucideIcon,
} from "lucide-react";
import { useViewsStore, selectDensity } from "../lib/store";
import LeaderboardNavWidget from "@/features/leaderboard/components/LeaderboardNavWidget";
import LeaderboardModal from "@/features/leaderboard/components/LeaderboardModal";

interface TopNavItem {
  id: string;
  label: string;
  icon: LucideIcon;
  /** Path to push when clicked; legacy items target `/?tab=<id>`. */
  href: string;
}

const TOP_NAV_ITEMS: readonly TopNavItem[] = [
  { id: "home", label: "Home", icon: Home, href: "/?tab=home" },
  { id: "map", label: "Map", icon: MapIcon, href: "/?tab=map" },
  {
    id: "activities",
    label: "Activities",
    icon: CalendarCheck2,
    href: "/?tab=activities",
  },
  { id: "tasks", label: "Tasks", icon: ListChecks, href: "/?tab=tasks" },
];

export default function SidebarTopNav() {
  const density = useViewsStore(selectDensity);
  const router = useRouter();
  const [showLeaderboard, setShowLeaderboard] = useState(false);

  // Density-driven row padding. Compact is the prototype default — matches
  // the 252px width.
  const rowPadY = density === "comfortable" ? "py-2.5" : "py-2";

  return (
    <>
      <nav className="pt-3 pb-2 flex flex-col" aria-label="Primary navigation">
        {TOP_NAV_ITEMS.map((item) => {
          const Icon = item.icon;
          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.href)}
              className={`relative w-full flex items-center gap-3 px-4 ${rowPadY} text-sm font-medium text-[#403770] hover:bg-[#EFEDF5] transition-colors duration-100 border-l-[3px] border-transparent`}
            >
              <Icon
                className="w-[18px] h-[18px] flex-shrink-0"
                aria-hidden
                strokeWidth={2}
              />
              <span className="whitespace-nowrap truncate">{item.label}</span>
            </button>
          );
        })}

        {/* Leaderboard mounts the existing widget verbatim per the plan. */}
        <div className="mt-1">
          <LeaderboardNavWidget
            collapsed={false}
            onOpenModal={() => setShowLeaderboard(true)}
          />
        </div>
      </nav>

      {/* Divider between top nav and the My Views section below. */}
      <div className="mx-3 border-t border-[#E2DEEC]" />

      <LeaderboardModal
        isOpen={showLeaderboard}
        onClose={() => setShowLeaderboard(false)}
        onNavigateToDetails={() => {
          router.push("/?tab=leaderboard");
          setShowLeaderboard(false);
        }}
      />
    </>
  );
}
