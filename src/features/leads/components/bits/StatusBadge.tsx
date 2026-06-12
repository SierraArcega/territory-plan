// Status pill — stage-tinted background, dot, and label. The stage definition
// is exposed via native title (per handoff §Interactions: "Status badges …
// expose the same definitions via native title"). Pixels per LeadBits.jsx.

import { STATUS_CONFIG } from "@/features/leads/lib/status-config";
import type { LeadStatus } from "@/features/leads/lib/types";

interface StatusBadgeProps {
  status: LeadStatus;
  dot?: boolean;
  size?: "sm" | "md";
}

export default function StatusBadge({ status, dot = true, size = "md" }: StatusBadgeProps) {
  const c = STATUS_CONFIG[status];
  if (!c) return null;
  const sm = size === "sm";
  return (
    <span
      title={c.definition}
      className={`inline-flex items-center gap-1.5 whitespace-nowrap rounded-full font-semibold ${
        sm ? "px-2 py-0.5 text-[11px]" : "px-2.5 py-[3px] text-xs"
      }`}
      style={{ background: c.bg, color: c.fg }}
    >
      {dot && (
        <span
          className="h-1.5 w-1.5 shrink-0 rounded-full"
          style={{ background: c.dot }}
        />
      )}
      {c.label}
    </span>
  );
}
