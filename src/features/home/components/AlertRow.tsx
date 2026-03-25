"use client";

import Link from "next/link";

// ============================================================================
// AlertRow — three alert variants for the feed alerts section
// ============================================================================
//
// Variants:
// 1. "no-contacts" — district with no contacts
//    - Plan color dot + district name (bold)
//    - Subtitle: plan name + "No contacts"
//    - Right side: "Add Contacts" link button
//
// 2. "stale-plan" — plan with no activity in 30 days
//    - Plan color dot + plan name (bold)
//    - Subtitle: "No tasks or activities in 30 days" + "N districts"
//    - Right side: "View Plan" link button
//
// 3. "needs-outcome" — completed activity without outcome
//    - Coral dot (#F37167) + activity title (bold)
//    - Subtitle: "Completed [date] · No next steps"
//    - Right side: "Add Next Steps" button (with onClick handler)

interface AlertRowProps {
  variant: "no-contacts" | "stale-plan" | "needs-outcome";
  title: string;
  subtitle: string;
  dotColor: string;
  actionLabel: string;
  onAction?: () => void;
  href?: string;
}

export function AlertRow({
  title,
  subtitle,
  dotColor,
  actionLabel,
  onAction,
  href,
}: AlertRowProps) {
  const actionButton = href ? (
    <Link
      href={href}
      onClick={(e) => e.stopPropagation()}
      className="shrink-0 bg-[#F7F5FA] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#403770] hover:bg-[#EFEDF5] transition-colors"
    >
      {actionLabel}
    </Link>
  ) : (
    <button
      onClick={(e) => {
        e.stopPropagation();
        onAction?.();
      }}
      className="shrink-0 bg-[#F7F5FA] rounded-lg px-3 py-1.5 text-xs font-semibold text-[#403770] hover:bg-[#EFEDF5] transition-colors"
    >
      {actionLabel}
    </button>
  );

  return (
    <div className="flex items-center gap-3.5 px-5 py-4 hover:bg-[#F7F5FA]/50 transition-colors">
      <span
        className="w-2 h-2 rounded-full shrink-0"
        style={{ backgroundColor: dotColor }}
      />
      <div className="flex-1 min-w-0">
        <p className="text-sm font-medium text-[#403770] truncate">{title}</p>
        <p className="text-xs text-[#8A80A8] mt-0.5">{subtitle}</p>
      </div>
      {actionButton}
    </div>
  );
}
