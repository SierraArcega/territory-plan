"use client";

import { useActiveReps } from "@/features/home/lib/queries";

interface Props {
  value: string; // rep id or "team"
  onChange: (next: string) => void;
}

// Scope picker for the dashboard: "Whole team" + every active rep (names only).
// Controlled by DashboardTab. Disabled while the roster loads (no layout shift).
// Brand-styled to match the FY pills.
export default function RepScopeSelect({ value, onChange }: Props) {
  const { data: reps, isLoading } = useActiveReps();

  return (
    <select
      aria-label="Rep"
      // "" while the caller's profile is still resolving — render a disabled
      // placeholder (no layout shift, no blank controlled-select warning).
      value={value === "" ? "__loading" : value}
      disabled={isLoading || value === ""}
      onChange={(e) => onChange(e.target.value)}
      className="rounded-full border border-[#D4CFE2] bg-white px-3 py-1 text-sm font-medium text-[#5C5378] whitespace-nowrap hover:bg-[#EFEDF5] disabled:opacity-60"
    >
      {value === "" && (
        <option value="__loading" disabled>
          Loading…
        </option>
      )}
      <option value="team">Whole team</option>
      {(reps ?? []).map((r) => (
        <option key={r.id} value={r.id}>
          {r.fullName ?? "Unnamed rep"}
        </option>
      ))}
    </select>
  );
}
