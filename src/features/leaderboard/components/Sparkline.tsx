import type { IncreaseTarget } from "../lib/types";

interface Props {
  trend: IncreaseTarget["revenueTrend"];
  width?: number;
  height?: number;
}

export default function Sparkline({ trend, width = 64, height = 22 }: Props) {
  const pts: (number | null)[] = [trend.fy24, trend.fy25, trend.fy26];
  const valid = pts.filter((v): v is number => v != null);
  if (valid.length < 2) {
    return <span className="text-[#A69DC0] text-xs">—</span>;
  }

  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const range = max - min || 1;
  const stepX = width / (pts.length - 1);

  type Point = [number, number];
  const points: (Point | null)[] = pts.map((v, i) => {
    if (v == null) return null;
    const x = i * stepX;
    const y = height - 2 - ((v - min) / range) * (height - 4);
    return [x, y];
  });

  const drawn = points.filter((p): p is Point => p !== null);
  const path = drawn
    .map((p, i) => (i === 0 ? `M ${p[0]} ${p[1]}` : `L ${p[0]} ${p[1]}`))
    .join(" ");

  const last = pts[pts.length - 1];
  const prev = pts[pts.length - 2];
  const dir = last != null && prev != null ? (last >= prev ? "up" : "down") : "flat";
  const stroke = dir === "up" ? "#69B34A" : dir === "down" ? "#F37167" : "#8A80A8";

  return (
    <svg width={width} height={height} className="block" aria-hidden="true">
      <path d={path} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
      {drawn.map((p, i) => (
        <circle key={i} cx={p[0]} cy={p[1]} r={1.5} fill={stroke} />
      ))}
    </svg>
  );
}
