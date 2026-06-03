"use client";

import MetricLabel from "../MetricLabel";

// Key for the topline card sparklines: a solid swatch = current FY (the plum line),
// a dashed swatch = prior FY (the muted line), plus an (i) that explains the trend.
// Two bare lines are meaningless without this. Colors mirror Sparkline.tsx's defaults.
// The prior swatch is omitted when there's no prior-year data to show.
export default function SparklineLegend({
  currentFyLabel,
  priorFyLabel,
  tip,
}: {
  currentFyLabel: string;
  priorFyLabel?: string;
  tip: string;
}) {
  return (
    <MetricLabel tip={tip}>
      <span className="flex items-center gap-2 text-[9px] font-medium text-[#8A80A8] whitespace-nowrap">
        <span className="flex items-center gap-1">
          <span className="inline-block h-[2px] w-3 rounded-full bg-[#403770]" />
          {currentFyLabel}
        </span>
        {priorFyLabel && (
          <span className="flex items-center gap-1">
            <span className="inline-block h-0 w-3 border-t border-dashed border-[#A69DC0]" />
            {priorFyLabel}
          </span>
        )}
      </span>
    </MetricLabel>
  );
}
