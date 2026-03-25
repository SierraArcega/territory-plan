"use client";

import { useState } from "react";
import { Star } from "lucide-react";

interface StarRatingProps {
  value: number;
  onChange: (rating: number) => void;
  disabled?: boolean;
}

export default function StarRating({ value, onChange, disabled = false }: StarRatingProps) {
  const [hoverIndex, setHoverIndex] = useState<number | null>(null);

  const displayValue = hoverIndex !== null ? hoverIndex : value;

  return (
    <div
      className="flex items-center gap-1"
      aria-label="Rate this activity"
      role="radiogroup"
    >
      {[1, 2, 3, 4, 5].map((n) => {
        const isFilled = n <= displayValue;
        return (
          <button
            key={n}
            type="button"
            aria-label={`Rate ${n} star${n !== 1 ? "s" : ""}`}
            role="radio"
            aria-checked={n === value}
            disabled={disabled}
            onClick={() => onChange(n)}
            onMouseEnter={() => !disabled && setHoverIndex(n)}
            onMouseLeave={() => setHoverIndex(null)}
            className="p-0 cursor-pointer disabled:cursor-not-allowed transition-transform duration-100 hover:scale-110"
          >
            <Star
              className="w-6 h-6"
              fill={isFilled ? "#F37167" : "none"}
              stroke={isFilled ? "#F37167" : "#C2BBD4"}
              strokeWidth={1.5}
            />
          </button>
        );
      })}
    </div>
  );
}
