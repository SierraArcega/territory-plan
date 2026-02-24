interface DonutSegment {
  value: number;
  color: string;
  label: string;
}

interface ProportionalDonutProps {
  segments: DonutSegment[];
  size?: number;
  strokeWidth?: number;
}

/**
 * Lightweight SVG donut chart that renders up to 4 colored arc segments
 * proportionally. No Recharts dependency — uses stroke-dasharray/offset.
 */
export default function ProportionalDonut({
  segments,
  size = 40,
  strokeWidth = 5,
}: ProportionalDonutProps) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const center = size / 2;

  const total = segments.reduce((sum, s) => sum + s.value, 0);

  // Build offset data for non-zero segments
  const visibleSegments: Array<{
    color: string;
    label: string;
    dashArray: number;
    dashOffset: number;
  }> = [];

  if (total > 0) {
    let cumulativeOffset = 0;

    for (const seg of segments) {
      if (seg.value <= 0) continue;

      const proportion = seg.value / total;
      const segmentLength = proportion * circumference;

      visibleSegments.push({
        color: seg.color,
        label: seg.label,
        dashArray: segmentLength,
        // dashoffset shifts the segment start; negative = clockwise from 12 o'clock
        dashOffset: -cumulativeOffset,
      });

      cumulativeOffset += segmentLength;
    }
  }

  return (
    <svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      aria-label="Target breakdown donut chart"
      role="img"
    >
      {/* Gray track circle (background) */}
      <circle
        cx={center}
        cy={center}
        r={radius}
        fill="none"
        stroke="#f0f0f0"
        strokeWidth={strokeWidth}
      />

      {/* Colored segments */}
      {visibleSegments.map((seg, i) => (
        <circle
          key={i}
          cx={center}
          cy={center}
          r={radius}
          fill="none"
          stroke={seg.color}
          strokeWidth={strokeWidth}
          strokeDasharray={`${seg.dashArray} ${circumference - seg.dashArray}`}
          strokeDashoffset={seg.dashOffset}
          strokeLinecap="butt"
          transform={`rotate(-90 ${center} ${center})`}
          aria-label={seg.label}
        />
      ))}
    </svg>
  );
}
