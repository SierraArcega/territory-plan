export type EnumSourceId =
  | "states"
  | "users"
  | "stages"
  | "personas"
  | "seniorities"
  | "feed_sources";

export const STATIC_ENUM_SOURCES: Record<EnumSourceId, boolean> = {
  states: false,        // dynamic — fetched from /api/views/enum-values
  users: false,
  stages: false,
  personas: false,
  seniorities: false,
  feed_sources: false,
};
