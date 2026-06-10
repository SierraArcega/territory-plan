// Lead type chip (source) — MQL / Inbound / Conference / Other. Outline
// variant is used on board cards; filled on table rows. Description copy is
// exposed via native title. Pixels per LeadBits.jsx.

import { leadTypeConfig } from "@/features/leads/lib/status-config";

interface LeadTypeBadgeProps {
  type: string | null | undefined;
  size?: "sm" | "md";
  outline?: boolean;
}

export default function LeadTypeBadge({ type, size = "md", outline = false }: LeadTypeBadgeProps) {
  const t = leadTypeConfig(type);
  const sm = size === "sm";
  return (
    <span
      title={t.desc}
      className={`inline-flex items-center gap-[5px] whitespace-nowrap rounded-full font-bold ${
        sm ? "px-[7px] py-px text-[10.5px]" : "px-[9px] py-0.5 text-[11.5px]"
      }`}
      style={{
        background: outline ? "transparent" : t.bg,
        color: t.fg,
        border: outline ? `1px solid ${t.dot}66` : "none",
      }}
    >
      <span
        className="h-[5px] w-[5px] shrink-0 rounded-full"
        style={{ background: t.dot }}
      />
      {t.label}
    </span>
  );
}
