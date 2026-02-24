"use client";

import { useState, useEffect } from "react";

interface DonutChartProps {
  percent: number;       // 0-100, capped at 100 for display
  color: string;         // ring fill color (hex)
  size?: number;         // diameter in px (default 100)
  strokeWidth?: number;  // ring thickness in px (default 8)
  fontSize?: string;     // Tailwind text size class for center label (default "text-base")
  onClick?: () => void;  // optional tap handler
}

export default function DonutChart({
  percent,
  color,
  size = 100,
  strokeWidth = 8,
  fontSize = "text-base",
  onClick,
}: DonutChartProps) {
  const [animatedPercent, setAnimatedPercent] = useState(0);
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const cappedPercent = Math.min(percent, 100);
  const offset = circumference * (1 - Math.min(animatedPercent, 100) / 100);

  useEffect(() => {
    const timer = setTimeout(() => setAnimatedPercent(cappedPercent), 200);
    return () => clearTimeout(timer);
  }, [cappedPercent]);

  return (
    <div
      className={`relative${onClick ? " cursor-pointer" : ""}`}
      style={{ width: size, height: size }}
      onClick={onClick}
      role={onClick ? "button" : undefined}
    >
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke="#f0f0f0"
          strokeWidth={strokeWidth}
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeDasharray={circumference}
          strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: "stroke-dashoffset 1s ease-out" }}
          className={onClick ? "hover:opacity-80" : undefined}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className={`${fontSize} font-bold text-[#403770]`}>
          {Math.round(cappedPercent)}%
        </span>
      </div>
    </div>
  );
}
