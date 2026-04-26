"use client";

import { useMemo, useState } from "react";
import {
  useRunReportMutation,
  useSavedReportsQuery,
  type ReportsSort,
  type ReportsTab,
} from "../lib/queries";
import LibraryTabs from "./LibraryTabs";
import ReportCard from "./ReportCard";
import SkeletonRow from "./ui/SkeletonRow";
import ErrorBanner from "./ErrorBanner";

interface Props {
  currentUserId: string;
  onNewReport: () => void;
  onOpenReport: (id: number) => void;
}

const SORT_OPTIONS: { value: ReportsSort; label: string }[] = [
  { value: "recent", label: "Recently run" },
  { value: "name", label: "Name" },
];

export default function Library({
  currentUserId,
  onNewReport,
  onOpenReport,
}: Props) {
  const [tab, setTab] = useState<ReportsTab>("all");
  const [sort, setSort] = useState<ReportsSort>("recent");
  const [search, setSearch] = useState("");

  const { data, isLoading, error, refetch } = useSavedReportsQuery({
    tab,
    search,
    sort,
  });

  const runReport = useRunReportMutation();

  const counts = useMemo(() => {
    const reports = data?.reports ?? [];
    return {
      all: reports.length,
      mine: reports.filter((r) => r.userId === currentUserId).length,
      team: reports.filter((r) => r.isTeamPinned).length,
      pinned: reports.filter((r) => r.isTeamPinned).length,
    };
  }, [data?.reports, currentUserId]);

  return (
    <div className="flex flex-col w-full">
      <header className="flex items-center justify-between px-10 pb-6 pt-8">
        <div className="flex flex-col gap-1">
          <h1 className="text-2xl font-bold text-[#544A78]">Reports</h1>
          <p className="text-[13px] text-[#6E6390]">
            Saved queries from your team. Reruns are free — no Claude tokens used.
          </p>
        </div>
        <div className="flex items-center gap-2.5">
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search reports…"
            className="w-[260px] rounded-lg border border-[#D4CFE2] bg-white px-3 py-2.5 text-[13px] text-[#544A78] placeholder:text-[#A69DC0]"
          />
          <button
            type="button"
            onClick={onNewReport}
            className="inline-flex items-center gap-1.5 rounded-lg bg-plum px-4 py-2.5 text-[13px] font-semibold text-white hover:bg-[#322a5a] transition-colors"
          >
            <span className="text-sm">+</span>
            New report
          </button>
        </div>
      </header>

      <div className="flex items-center justify-between">
        <LibraryTabs
          tabs={[
            { id: "all", label: "All", count: counts.all },
            { id: "mine", label: "My reports", count: counts.mine },
            { id: "team", label: "Team", count: counts.team },
            { id: "pinned", label: "Pinned", count: counts.pinned },
          ]}
          active={tab}
          onChange={setTab}
        />
        <div className="pr-10">
          <select
            value={sort}
            onChange={(e) => setSort(e.target.value as ReportsSort)}
            className="rounded-lg border border-[#D4CFE2] bg-white px-2.5 py-1.5 text-xs font-medium text-[#544A78]"
          >
            {SORT_OPTIONS.map((o) => (
              <option key={o.value} value={o.value}>
                Sort: {o.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="flex flex-col gap-3 px-10 pb-10 pt-5">
        {isLoading && (
          <div className="flex flex-col gap-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div
                key={i}
                className="h-[90px] rounded-xl border border-[#E2DEEC] bg-white"
              >
                <SkeletonRow columns={4} />
              </div>
            ))}
          </div>
        )}
        {error && (
          <ErrorBanner
            title="Couldn't load reports"
            detail={error.message}
            onRetry={() => refetch()}
          />
        )}
        {!isLoading && !error && (data?.reports ?? []).length === 0 && (
          <div className="flex flex-col items-center gap-3 rounded-xl border border-[#E2DEEC] bg-white px-6 py-16 text-center">
            <p className="text-sm font-semibold text-[#544A78]">No reports yet</p>
            <p className="max-w-sm text-xs text-[#6E6390]">
              Save your first query to build your library. Team members will see it here.
            </p>
          </div>
        )}
        {(data?.reports ?? []).map((r) => (
          <ReportCard
            key={r.id}
            report={r}
            currentUserId={currentUserId}
            onRun={(id) => runReport.mutate({ id })}
            onOpen={onOpenReport}
            running={runReport.isPending && runReport.variables?.id === r.id}
          />
        ))}
      </div>
    </div>
  );
}
