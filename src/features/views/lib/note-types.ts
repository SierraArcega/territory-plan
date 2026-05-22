/**
 * Canonical district-note types. Single source of truth for the API validator,
 * composer picker, entry badge, cell tint, and filter labels. Colors reuse the
 * status palette from ChurnRiskCell (plum-derived, no Tailwind grays).
 */
export const NOTE_TYPES = [
  { value: "general_update", label: "General update", pill: "bg-[#EFEDF5] text-[#6E6390]" },
  { value: "good_news",      label: "Good news",      pill: "bg-[#E5F5EC] text-[#1F7A3F]" },
  { value: "risk_flag",      label: "Risk flag",      pill: "bg-[#FFE0DC] text-[#A8281C]" },
  { value: "next_step",      label: "Next step",      pill: "bg-[#FFF1D6] text-[#8A5C00]" },
  { value: "meeting_recap",  label: "Meeting recap",  pill: "bg-[#E2E8F7] text-[#3B5BA5]" },
] as const;

export type NoteType = (typeof NOTE_TYPES)[number]["value"];

export const DEFAULT_NOTE_TYPE: NoteType = "general_update";
export const NOTE_TYPE_VALUES: NoteType[] = NOTE_TYPES.map((t) => t.value);
export const NOTE_TYPE_LABELS: Record<string, string> = Object.fromEntries(
  NOTE_TYPES.map((t) => [t.value, t.label]),
);

const NOTE_TYPE_SET = new Set<string>(NOTE_TYPE_VALUES);
export function isNoteType(v: unknown): v is NoteType {
  return typeof v === "string" && NOTE_TYPE_SET.has(v);
}
export function noteTypeMeta(value: string): (typeof NOTE_TYPES)[number] {
  return NOTE_TYPES.find((t) => t.value === value) ?? NOTE_TYPES[0];
}
