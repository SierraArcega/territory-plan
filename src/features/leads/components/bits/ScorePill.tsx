// Engagement score pill — neutral below the 100-pt MQL threshold, green once
// crossed, alert-red with a flame at 140+. Optional progress bar variant for
// panels. Pixels per LeadBits.jsx.

import { Flame } from "lucide-react";

interface ScorePillProps {
  score: number;
  threshold?: number;
  withBar?: boolean;
}

export default function ScorePill({ score, threshold = 100, withBar = false }: ScorePillProps) {
  const crossed = score >= threshold;
  const hot = score >= 140;
  const fg = hot ? "#C25A52" : crossed ? "#56792F" : "#8A80A8";
  const bg = hot ? "#FEF1F0" : crossed ? "#EAF8E0" : "#F2F0F6";
  return (
    <span className="inline-flex items-center gap-1.5">
      <span
        className="inline-flex items-center gap-1 whitespace-nowrap rounded-full px-2 py-0.5 text-xs font-bold tabular-nums"
        style={{ background: bg, color: fg }}
      >
        {hot && <Flame size={12} aria-hidden />}
        {score}
      </span>
      {withBar && (
        <span className="h-[5px] w-14 overflow-hidden rounded-full bg-[#EFEDF5]">
          <span
            className="block h-full rounded-full"
            style={{
              width: `${Math.min(100, (score / 160) * 100)}%`,
              background: fg,
            }}
          />
        </span>
      )}
    </span>
  );
}
