"use client";

import { useSavedReports } from "../hooks/useSavedReports";

interface Props {
  onLoad: (id: number) => void;
}

export function SavedReportsSidebar({ onLoad }: Props) {
  const { data, isLoading, error } = useSavedReports();

  if (isLoading) {
    return <aside className="p-4 text-sm text-[#8A80A8]">Loading…</aside>;
  }
  if (error) {
    return <aside className="p-4 text-sm text-[#b44339]">Failed to load reports.</aside>;
  }

  const reports = data?.reports ?? [];

  return (
    <aside className="flex h-full flex-col border-r border-[#E2DEEC] bg-[#F7F5FA] p-4">
      <h3 className="text-xs font-semibold uppercase tracking-wide text-[#8A80A8]">
        Saved reports
      </h3>
      <ul className="mt-3 flex-1 space-y-1 overflow-y-auto">
        {reports.length === 0 && (
          <li className="text-sm text-[#8A80A8]">No saved reports yet.</li>
        )}
        {reports.map((r) => (
          <li key={r.id}>
            <button
              type="button"
              onClick={() => onLoad(r.id)}
              className="w-full rounded-lg px-2 py-1.5 text-left text-sm text-[#403770] hover:bg-white"
            >
              <div className="font-medium">{r.title}</div>
              <div className="truncate text-xs text-[#8A80A8]">{r.question}</div>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  );
}
