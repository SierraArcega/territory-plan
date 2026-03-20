"use client";

import { useQuery } from "@tanstack/react-query";

interface VacancyScanStats {
  totalVacancies: number;
  verifiedVacancies: number;
  districtsWithVacancies: number;
  totalDistrictsWithUrl: number;
  districtsScanned: number;
  coveragePct: number;
  scansLast7d: number;
  failedLast24h: number;
  lastScanAt: string | null;
  byPlatform: { platform: string; count: number }[];
}

function relativeTime(date: string | null): string {
  if (!date) return "Never";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

export default function VacancyScanCard() {
  const { data, isLoading } = useQuery<VacancyScanStats>({
    queryKey: ["admin", "vacancy-scan-stats"],
    queryFn: async () => {
      const res = await fetch("/api/admin/vacancy-scan-stats");
      if (!res.ok) throw new Error("Failed to fetch");
      return res.json();
    },
    staleTime: 30 * 1000, // 30s
  });

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-xl border border-[#E2DEEC] p-5 space-y-3 animate-pulse">
        <div className="h-5 w-40 bg-[#E2DEEC]/60 rounded" />
        <div className="h-16 bg-[#E2DEEC]/40 rounded" />
      </div>
    );
  }

  const healthColor =
    data.failedLast24h > 5
      ? "#F37167"
      : data.coveragePct < 10
        ? "#E5A53D"
        : "#8AA891";

  return (
    <div className="bg-white rounded-xl border border-[#E2DEEC] p-5 space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: healthColor }}
          />
          <h3 className="text-sm font-semibold text-[#403770]">
            Vacancy Scanner
          </h3>
        </div>
        <span className="text-[11px] text-[#A69DC0]">
          Last scan {relativeTime(data.lastScanAt)}
        </span>
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-4 gap-4">
        <Stat label="Open Vacancies" value={data.verifiedVacancies.toLocaleString()} />
        <Stat label="Districts" value={data.districtsWithVacancies.toLocaleString()} />
        <Stat
          label="Coverage"
          value={`${data.coveragePct}%`}
          sub={`${data.districtsScanned.toLocaleString()} / ${data.totalDistrictsWithUrl.toLocaleString()}`}
        />
        <Stat
          label="Scans (7d)"
          value={data.scansLast7d.toLocaleString()}
          sub={data.failedLast24h > 0 ? `${data.failedLast24h} failed (24h)` : "0 failed"}
          alert={data.failedLast24h > 0}
        />
      </div>

      {/* Progress bar */}
      <div className="space-y-1.5">
        <div className="flex items-center justify-between text-[11px]">
          <span className="text-[#8A80A8]">Scan coverage</span>
          <span className="font-medium text-[#6E6390]">
            {data.districtsScanned.toLocaleString()} / {data.totalDistrictsWithUrl.toLocaleString()} districts
          </span>
        </div>
        <div className="h-2 bg-[#E2DEEC] rounded-full overflow-hidden">
          <div
            className="h-full rounded-full bg-[#403770] transition-all duration-500"
            style={{ width: `${Math.min(data.coveragePct, 100)}%` }}
          />
        </div>
      </div>

      {/* Platform breakdown */}
      {data.byPlatform.length > 0 && (
        <div className="flex items-center gap-3 text-[11px] text-[#8A80A8]">
          <span className="font-medium text-[#6E6390]">By platform:</span>
          {data.byPlatform
            .sort((a, b) => b.count - a.count)
            .slice(0, 4)
            .map((p) => (
              <span key={p.platform}>
                {p.platform} ({p.count})
              </span>
            ))}
        </div>
      )}
    </div>
  );
}

function Stat({
  label,
  value,
  sub,
  alert,
}: {
  label: string;
  value: string;
  sub?: string;
  alert?: boolean;
}) {
  return (
    <div>
      <div className="text-[11px] text-[#8A80A8] font-medium uppercase tracking-wider">
        {label}
      </div>
      <div className="text-lg font-bold text-[#403770] mt-0.5">{value}</div>
      {sub && (
        <div className={`text-[11px] mt-0.5 ${alert ? "text-[#F37167]" : "text-[#A69DC0]"}`}>
          {sub}
        </div>
      )}
    </div>
  );
}
