// SLA countdown badge — ok (steel) → due-soon (warn) → overdue (alert, with
// a coral-tinted border). Tabular numerals; AlertTriangle replaces the Clock
// when overdue. Pixels per LeadBits.jsx.

import { AlertTriangle, Clock } from "lucide-react";
import { slaState, type SlaUrgency } from "@/features/leads/lib/sla";

const SLA_PAL: Record<SlaUrgency, { bg: string; fg: string }> = {
  ok: { bg: "#E8F1F5", fg: "#4D7285" },
  "due-soon": { bg: "#FFF7EC", fg: "#9A7B3F" },
  overdue: { bg: "#FEF1F0", fg: "#C25A52" },
};

interface SlaBadgeProps {
  assignedAt: string | null | undefined;
  compact?: boolean;
  /** Injectable clock for tests/stories. */
  now?: Date;
}

export default function SlaBadge({ assignedAt, compact = false, now }: SlaBadgeProps) {
  const sla = slaState(assignedAt, now);
  if (!sla) return null;
  const p = SLA_PAL[sla.urgency];
  const Icon = sla.urgency === "overdue" ? AlertTriangle : Clock;
  return (
    <span
      title="Acceptance SLA · 2 business days"
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full text-[11px] font-semibold tabular-nums ${
        compact ? "px-[7px] py-0.5" : "px-[9px] py-[3px]"
      }`}
      style={{
        background: p.bg,
        color: p.fg,
        border:
          sla.urgency === "overdue"
            ? "1px solid #F7C9C5"
            : "1px solid transparent",
      }}
    >
      <Icon size={12} aria-hidden />
      {sla.label}
    </span>
  );
}
