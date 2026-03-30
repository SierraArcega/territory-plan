"use client";

import { useState, useEffect } from "react";

interface TickerLine {
  text: string;
  highlight?: boolean;
}

interface RankTickerProps {
  lines: TickerLine[];
  intervalMs?: number;
}

export default function RankTicker({ lines, intervalMs = 3500 }: RankTickerProps) {
  const [activeIndex, setActiveIndex] = useState(0);

  useEffect(() => {
    if (lines.length <= 1) return;
    const timer = setInterval(() => {
      setActiveIndex((prev) => (prev + 1) % lines.length);
    }, intervalMs);
    return () => clearInterval(timer);
  }, [lines.length, intervalMs]);

  if (lines.length === 0) return null;

  return (
    <div className="relative h-4 overflow-hidden">
      {lines.map((line, i) => (
        <div
          key={i}
          className={`absolute inset-0 flex items-center transition-all duration-300 ${
            i === activeIndex
              ? "opacity-100 translate-y-0"
              : "opacity-0 translate-y-2"
          }`}
        >
          <span
            className={`text-[10px] font-medium truncate ${
              line.highlight ? "text-plum font-semibold" : "text-[#8A80A8]"
            }`}
          >
            {line.text}
          </span>
        </div>
      ))}
    </div>
  );
}
