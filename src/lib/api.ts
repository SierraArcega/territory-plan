// Barrel re-export — all hooks and types are now in feature modules.
// Consumers can import from here or directly from the feature module.

export { fetchJson, API_BASE } from "@/features/shared/lib/api-client";
export type * from "@/features/shared/types/api-types";

// Feature queries
export * from "@/features/districts/lib/queries";
export * from "@/features/plans/lib/queries";
export * from "@/features/tasks/lib/queries";
export * from "@/features/activities/lib/queries";
export * from "@/features/calendar/lib/queries";
export * from "@/features/goals/lib/queries";
export * from "@/features/progress/lib/queries";
export * from "@/features/map/lib/queries";
export * from "@/features/explore/lib/queries";
export * from "@/features/shared/lib/queries";
