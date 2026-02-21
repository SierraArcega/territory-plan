"use client";

type Quartile = "well_above" | "above" | "below" | "well_below";

interface QuartileContextProps {
  quartile: string | null;
  /** true for metrics where higher = worse */
  invertLabel?: boolean;
}

const QUARTILE_DISPLAY: Record<
  Quartile,
  { label: string; goodColor: string; badColor: string }
> = {
  well_above: {
    label: "Well above state avg",
    goodColor: "text-[#5f665b]",
    badColor: "text-[#c25a52]",
  },
  above: {
    label: "Above state avg",
    goodColor: "text-[#4d7285]",
    badColor: "text-[#997c43]",
  },
  below: {
    label: "Below state avg",
    goodColor: "text-[#997c43]",
    badColor: "text-[#4d7285]",
  },
  well_below: {
    label: "Well below state avg",
    goodColor: "text-[#c25a52]",
    badColor: "text-[#5f665b]",
  },
};

function isValidQuartile(v: string | null): v is Quartile {
  return v != null && v in QUARTILE_DISPLAY;
}

export default function QuartileContext({
  quartile,
  invertLabel = false,
}: QuartileContextProps) {
  if (!isValidQuartile(quartile)) return null;

  const config = QUARTILE_DISPLAY[quartile];
  const colorClass = invertLabel ? config.badColor : config.goodColor;

  return (
    <span className={`text-xs font-medium ${colorClass}`}>
      {config.label}
    </span>
  );
}
