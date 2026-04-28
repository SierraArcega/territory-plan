"use client";

import ActivitiesPageShell from "@/features/activities/components/page/ActivitiesPageShell";

// SPA mounts this via `?tab=activities` — no separate `src/app/activities/page.tsx`.
export default function ActivitiesView() {
  return <ActivitiesPageShell />;
}
