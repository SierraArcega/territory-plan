// Single source of truth for the dashboard's source segments: the DOA `category`,
// its design-facing key, brand color, and labels. Everything that classifies or
// colors a segment (topline segment bars, the rank-trajectory payload, the modal
// filter) imports from here so adding/renaming a segment is a one-place change.

export type SegmentKey = "return" | "new" | "winback" | "expansion";

export interface SegmentDef {
  key: SegmentKey;
  category: string; // DOA `category` value (closed-won-history derived)
  color: string;
  label: string; // short, for legends/bars ("New biz")
  longLabel: string; // for filter chips ("New business")
}

export const SEGMENT_DEFS: SegmentDef[] = [
  { key: "return", category: "renewal", color: "#403770", label: "Return", longLabel: "Return business" },
  { key: "new", category: "new_business", color: "#F37167", label: "New biz", longLabel: "New business" },
  { key: "winback", category: "winback", color: "#6EA3BE", label: "Win-back", longLabel: "Win-back" },
  { key: "expansion", category: "expansion", color: "#FFCF70", label: "Expansion", longLabel: "Expansion" },
];

export const SEGMENT_COLORS: Record<SegmentKey, string> = Object.fromEntries(
  SEGMENT_DEFS.map((d) => [d.key, d.color]),
) as Record<SegmentKey, string>;

// DOA category → design segment key.
export const CATEGORY_TO_SEGMENT: Record<string, SegmentKey> = Object.fromEntries(
  SEGMENT_DEFS.map((d) => [d.category, d.key]),
);
