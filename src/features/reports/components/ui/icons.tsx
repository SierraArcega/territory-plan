import type { ChipKind } from "../../lib/ui-types";

/**
 * 6×6 colored dot that prefixes a chip to signal its category. Colors match
 * the figma + tokens.md palette. Values:
 *   source → coral (orange-red)
 *   join   → steel-blue
 *   filter → plum
 *   columns / sort → muted plum
 */
export function DomainDot({ kind, className }: { kind: ChipKind; className?: string }) {
  const bg =
    kind === "source"
      ? "bg-coral"
      : kind === "join"
        ? "bg-steel-blue"
        : kind === "filter"
          ? "bg-plum"
          : "bg-[#8A80A8]";
  return (
    <span
      className={`inline-block size-[6px] rounded-full ${bg} ${className ?? ""}`}
      aria-hidden
    />
  );
}

/** Pulse-dot used by the chat panel header and the suggest-loading indicator. */
export function PulseDot({ className }: { className?: string }) {
  return (
    <span
      className={`inline-block size-[8px] rounded-full bg-coral ${className ?? ""}`}
      aria-hidden
      style={{
        animation: "reports-pulse 1.6s ease-in-out infinite",
      }}
    />
  );
}

/**
 * Static triangle-play icon used by Pre-Run state. Kept as a tiny inline SVG
 * instead of Lucide's `Play` because the figma wants a filled, heavy triangle.
 */
export function PlayTriangle({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 10 10"
      className={className ?? "size-[10px]"}
      fill="currentColor"
      aria-hidden
    >
      <path d="M2 1v8l7-4z" />
    </svg>
  );
}
