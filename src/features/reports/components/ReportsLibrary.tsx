"use client";

import { useState } from "react";
import {
  useDeleteReport,
  useReportsLibrary,
  useToggleStar,
  type LibraryResponse,
} from "../lib/queries";
import { useProfile } from "@/features/shared/lib/queries";
import { WelcomeStrip } from "./library/WelcomeStrip";
import { LibraryTabs, type LibraryTab } from "./library/LibraryTabs";
import { LibraryList } from "./library/LibraryList";
import { LibrarySkeleton } from "./library/LibrarySkeleton";

interface Props {
  initialTab: LibraryTab;
  onTabChange: (next: LibraryTab) => void;
  onOpenReport: (id: number) => void;
  onNewReport: (prompt?: string) => void;
}

const EMPTY: LibraryResponse = { mine: [], starred: [], team: [] };

export function ReportsLibrary({ initialTab, onTabChange, onOpenReport, onNewReport }: Props) {
  const [tab, setTab] = useState<LibraryTab>(initialTab);
  const [searchQuery, setSearchQuery] = useState("");

  const { data: library, isLoading, isError } = useReportsLibrary();
  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin";

  const toggleStar = useToggleStar();
  const deleteReport = useDeleteReport();

  const handleTabChange = (next: LibraryTab) => {
    setTab(next);
    setSearchQuery("");
    onTabChange(next);
  };

  const handleToggleStar = (id: number, next: boolean) => {
    toggleStar.mutate({ id, isTeamPinned: next });
  };

  const handleDelete = (id: number, title: string) => {
    if (!window.confirm(`Delete "${title}"? This can't be undone.`)) return;
    deleteReport.mutate(id);
  };

  const data = library ?? EMPTY;
  const counts = { mine: data.mine.length, starred: data.starred.length, team: data.team.length };
  const rows = data[tab];

  return (
    <div className="h-full overflow-y-auto bg-[#FFFCFA]">
      <div className="mx-auto max-w-[1080px] px-7 py-7 pb-10">
        <WelcomeStrip
          onNewReport={() => onNewReport()}
          onTryExample={(prompt) => onNewReport(prompt)}
        />
        <div className="mt-6">
          <LibraryTabs
            tab={tab}
            counts={counts}
            searchQuery={searchQuery}
            onTabChange={handleTabChange}
            onSearchChange={setSearchQuery}
          />
          {isLoading ? (
            <LibrarySkeleton />
          ) : isError ? (
            <div className="rounded-xl border border-[#f58d85] bg-[#fef1f0] px-4 py-3 text-[12.5px] text-[#c25a52]">
              Couldn&apos;t load saved reports. Refresh and try again.
            </div>
          ) : (
            <LibraryList
              rows={rows}
              kind={tab}
              searchQuery={searchQuery}
              isAdmin={isAdmin}
              currentUserId={profile?.id ?? null}
              onOpen={onOpenReport}
              onToggleStar={handleToggleStar}
              onDelete={handleDelete}
              onNewReport={() => onNewReport()}
            />
          )}
        </div>
      </div>
    </div>
  );
}
