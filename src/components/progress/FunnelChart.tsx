// FunnelChart — Horizontal sales funnel visualization
// Displays stages left-to-right: Discovery → Demo → Proposal → Won
// Each bar width is proportional to the count. Colors progress from
// steel-blue (top of funnel) through plum to coral (won).

interface FunnelStage {
  label: string;
  count: number;
  color: string;
}

interface FunnelChartProps {
  stages: FunnelStage[];
}

export default function FunnelChart({ stages }: FunnelChartProps) {
  const maxCount = Math.max(...stages.map((s) => s.count), 1);

  return (
    <div className="space-y-2">
      {stages.map((stage, idx) => {
        // Width: at least 20% so labels are always visible, max 100%
        const widthPercent = Math.max(20, (stage.count / maxCount) * 100);

        return (
          <div key={stage.label} className="flex items-center gap-2">
            {/* Stage bar */}
            <div className="flex-1 relative">
              <div
                className="h-7 rounded-md flex items-center px-2.5 transition-all duration-500"
                style={{
                  width: `${widthPercent}%`,
                  backgroundColor: `${stage.color}18`,
                  borderLeft: `3px solid ${stage.color}`,
                }}
              >
                <span
                  className="text-[11px] font-medium truncate"
                  style={{ color: stage.color }}
                >
                  {stage.label}
                </span>
              </div>
            </div>
            {/* Count */}
            <span className="text-sm font-bold text-[#403770] w-8 text-right tabular-nums">
              {stage.count}
            </span>
          </div>
        );
      })}
    </div>
  );
}
