"use client";

import { useAdminNewsStats } from "../hooks/useAdminNewsStats";

const HEALTH_COLORS: Record<"green" | "amber" | "red", string> = {
  green: "#8AA891",
  amber: "#E5A53D",
  red: "#F37167",
};

function relativeTime(iso: string | null): string {
  if (!iso) return "never";
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60_000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
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
      <div className="text-[11px] font-medium uppercase tracking-wider text-[#8A80A8]">
        {label}
      </div>
      <div className="text-xl font-semibold text-[#403770]">{value}</div>
      {sub && (
        <div
          className={`text-[11px] ${
            alert ? "text-[#c25a52]" : "text-[#A69DC0]"
          }`}
        >
          {sub}
        </div>
      )}
    </div>
  );
}

export default function NewsIngestCard() {
  const { data, isLoading } = useAdminNewsStats();

  if (isLoading || !data) {
    return (
      <div className="bg-white rounded-xl border border-[#E2DEEC] p-5 space-y-3 animate-pulse">
        <div className="h-5 w-40 bg-[#E2DEEC]/60 rounded" />
        <div className="h-16 bg-[#E2DEEC]/40 rounded" />
      </div>
    );
  }

  const noRuns = data.lastRun.finishedAt === null;
  const nothingToCover = data.coverage.targetDistrictCount === 0;

  const coverageValue = nothingToCover ? "—" : `${data.coverage.percentGreen}%`;
  const districtsCoveredValue = nothingToCover
    ? "0"
    : data.coverage.green.toLocaleString();
  const articleDelta = data.articles.last7d - data.articles.prior7d;
  const articleSub =
    articleDelta === 0
      ? "flat vs prior 7d"
      : articleDelta > 0
        ? `+${articleDelta} vs prior 7d`
        : `${articleDelta} vs prior 7d`;

  const greenPct = nothingToCover
    ? 0
    : (data.coverage.green / data.coverage.targetDistrictCount) * 100;
  const amberPct = nothingToCover
    ? 0
    : (data.coverage.amber / data.coverage.targetDistrictCount) * 100;
  const redPct = nothingToCover
    ? 0
    : (data.coverage.red / data.coverage.targetDistrictCount) * 100;

  return (
    <div className="bg-white rounded-xl border border-[#E2DEEC] p-5 space-y-4">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div
            className="w-2 h-2 rounded-full"
            style={{ backgroundColor: HEALTH_COLORS[data.health] }}
          />
          <h3 className="text-sm font-semibold text-[#403770]">News Ingest</h3>
        </div>
        <span className="text-[11px] text-[#A69DC0]">
          {noRuns ? "No runs yet" : `Last run ${relativeTime(data.lastRun.finishedAt)}`}
        </span>
      </div>

      <div className="grid grid-cols-4 gap-4">
        <Stat
          label="Articles (7d)"
          value={data.articles.last7d.toLocaleString()}
          sub={articleSub}
        />
        <Stat
          label="Districts Covered"
          value={districtsCoveredValue}
          sub={
            nothingToCover
              ? "no target districts"
              : `of ${data.coverage.targetDistrictCount.toLocaleString()}`
          }
        />
        <Stat label="Coverage" value={coverageValue} />
        <Stat
          label="Failures (24h)"
          value={data.failures24h.toLocaleString()}
          alert={data.failures24h > 0}
        />
      </div>

      {!nothingToCover && (
        <div>
          <div className="h-2 w-full rounded-full overflow-hidden bg-[#E2DEEC] flex">
            <div
              style={{
                width: `${greenPct}%`,
                backgroundColor: HEALTH_COLORS.green,
              }}
            />
            <div
              style={{
                width: `${amberPct}%`,
                backgroundColor: HEALTH_COLORS.amber,
              }}
            />
            <div
              style={{
                width: `${redPct}%`,
                backgroundColor: HEALTH_COLORS.red,
              }}
            />
          </div>
          <div className="flex justify-between mt-1 text-[11px] text-[#A69DC0]">
            <span>{data.coverage.green} green</span>
            <span>{data.coverage.amber} amber</span>
            <span>{data.coverage.red} red</span>
          </div>
        </div>
      )}

      {data.layerBreakdown.length > 0 && (
        <div className="flex gap-2 flex-wrap">
          {data.layerBreakdown.slice(0, 5).map((chip) => (
            <div
              key={chip.layer}
              className="flex items-center gap-1.5 rounded-full border border-[#E2DEEC] bg-[#F7F5FA] px-2.5 py-1 text-[11px] text-[#6E6390]"
            >
              <div
                className="w-1.5 h-1.5 rounded-full"
                style={{
                  backgroundColor:
                    chip.lastStatus === "success"
                      ? HEALTH_COLORS.green
                      : chip.lastStatus === "failed"
                        ? HEALTH_COLORS.red
                        : HEALTH_COLORS.amber,
                }}
              />
              <span className="font-medium">{chip.layer}</span>
              <span className="text-[#A69DC0]">({chip.runsLast24h})</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
