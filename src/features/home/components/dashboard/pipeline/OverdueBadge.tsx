// Small overlay pill marking an open opp whose close date has already passed.
// Orthogonal to the age tier — shown alongside the tier label/badge.
export default function OverdueBadge() {
  return (
    <span
      className="rounded-full px-2 py-0.5 text-[10px] font-bold text-[#F37167] whitespace-nowrap"
      style={{ background: "rgba(243,113,103,0.12)" }}
    >
      Overdue
    </span>
  );
}
