"use client";

interface Props {
  value: string | null;
}

/**
 * Renders the customer_rank string from the API.
 * - "#1", "#2", ... → numbered rank pill (plum)
 * - "Win Back" → amber pill
 * - "New" → mint pill
 * - null/empty → em-dash
 */
export function CustomerRankCell({ value }: Props) {
  if (!value) return <span className="text-[#A69DC0]">—</span>;

  let pillClass: string;
  if (value.startsWith("#")) {
    pillClass = "bg-[#EFEDF5] text-[#4B3A6B]"; // plum 50 / 700
  } else if (value === "Win Back") {
    pillClass = "bg-[#FFF1D6] text-[#8A5C00]"; // amber
  } else if (value === "New") {
    pillClass = "bg-[#E5F5EC] text-[#1F7A3F]"; // mint
  } else {
    pillClass = "bg-[#EFEDF5] text-[#4B3A6B]";
  }

  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap ${pillClass}`}>
      {value}
    </span>
  );
}
