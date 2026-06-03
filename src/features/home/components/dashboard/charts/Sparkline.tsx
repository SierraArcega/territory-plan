// Tiny cumulative-trend sparkline for the topline cards — ported from the design
// prototype (Docs/Dashboard.zip · hifi-charts.jsx · Sparkline). Current FY solid,
// prior FY dashed/muted and drawn ON TOP so its full-year arc never hides under the
// current line where the two plateau at the same value. A filled dot marks "today"
// on the current line; a hollow dot marks where the prior year finished. Fluid width
// (scales to its container, fixed height) so it never overflows a narrow card.

interface SparklineProps {
  data: number[];
  priorData?: number[];
  todayIndex?: number; // column the "today" dot sits on (defaults to the last point)
  width?: number;
  height?: number;
  color?: string;
  priorColor?: string;
}

export default function Sparkline({
  data,
  priorData,
  todayIndex,
  width = 160,
  height = 32,
  color = "#403770",
  priorColor = "#A69DC0",
}: SparklineProps) {
  if (data.length < 2) return null;
  // Only show the prior year when there's actually history to compare against —
  // an all-zero prior (no prior-FY data loaded) would just be flat noise.
  const hasPrior = !!priorData && priorData.length >= 2 && priorData.some((v) => v !== 0);
  const cols = Math.max(data.length, hasPrior ? priorData!.length : 0);
  const all = hasPrior ? [...data, ...priorData!] : data;
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = Math.max(0.0001, max - min);
  // Shared x-scale by absolute column so the two years line up month-for-month.
  const x = (i: number) => (i / (cols - 1)) * (width - 6) + 3;
  const y = (v: number) => height - 4 - ((v - min) / range) * (height - 8);
  const pts = (arr: number[]) => arr.map((v, i) => `${x(i).toFixed(1)},${y(v).toFixed(1)}`).join(" ");
  const dotIdx = Math.min(Math.max(todayIndex ?? data.length - 1, 0), data.length - 1);

  return (
    <svg
      width="100%"
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      preserveAspectRatio="xMinYMid meet"
      style={{ display: "block", maxWidth: width }}
    >
      {/* current FY (solid) — drawn first so the prior-year arc stays visible on top */}
      <polyline points={pts(data)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {/* prior FY (dashed, muted) — full year, on top, with a hollow marker at its finish */}
      {hasPrior && (
        <>
          <polyline points={pts(priorData!)} fill="none" stroke={priorColor} strokeWidth="1.5" strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" />
          <circle cx={x(priorData!.length - 1)} cy={y(priorData![priorData!.length - 1])} r="2" fill="white" stroke={priorColor} strokeWidth="1.5" />
        </>
      )}
      {/* today marker on the current line */}
      <circle cx={x(dotIdx)} cy={y(data[dotIdx])} r="3" fill={color} stroke="white" strokeWidth="1.5" />
    </svg>
  );
}
