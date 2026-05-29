// Tiny cumulative-trend sparkline for the topline cards — ported from the design
// prototype (Docs/Dashboard.zip · hifi-charts.jsx · Sparkline). Current FY solid,
// prior FY dashed/muted. Presentational only.

interface SparklineProps {
  data: number[];
  priorData?: number[];
  width?: number;
  height?: number;
  color?: string;
  priorColor?: string;
}

export default function Sparkline({
  data,
  priorData,
  width = 120,
  height = 32,
  color = "#403770",
  priorColor = "#A69DC0",
}: SparklineProps) {
  if (data.length < 2) return null;
  const all = priorData ? [...data, ...priorData] : data;
  const max = Math.max(...all);
  const min = Math.min(...all);
  const range = Math.max(0.0001, max - min);
  const pts = (arr: number[]) =>
    arr
      .map((v, i) => {
        const x = (i / (arr.length - 1)) * (width - 6) + 3;
        const y = height - 4 - ((v - min) / range) * (height - 8);
        return `${x.toFixed(1)},${y.toFixed(1)}`;
      })
      .join(" ");
  const lastX = width - 3;
  const lastY = height - 4 - ((data[data.length - 1] - min) / range) * (height - 8);

  return (
    <svg width={width} height={height} style={{ display: "block", overflow: "visible" }}>
      {priorData && priorData.length >= 2 && (
        <polyline points={pts(priorData)} fill="none" stroke={priorColor} strokeWidth="1.5" strokeDasharray="3 3" strokeLinejoin="round" strokeLinecap="round" />
      )}
      <polyline points={pts(data)} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      <circle cx={lastX} cy={lastY} r="3" fill={color} stroke="white" strokeWidth="1.5" />
    </svg>
  );
}
