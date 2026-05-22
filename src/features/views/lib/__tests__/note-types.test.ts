import { describe, it, expect } from "vitest";
import { NOTE_TYPES, NOTE_TYPE_VALUES, NOTE_TYPE_LABELS, DEFAULT_NOTE_TYPE, isNoteType, noteTypeMeta } from "../note-types";

describe("note-types", () => {
  it("has the five types in order", () => {
    expect(NOTE_TYPE_VALUES).toEqual(["general_update","good_news","risk_flag","next_step","meeting_recap"]);
  });
  it("defaults to general_update", () => {
    expect(DEFAULT_NOTE_TYPE).toBe("general_update");
  });
  it("maps values to human labels", () => {
    expect(NOTE_TYPE_LABELS.general_update).toBe("General update");
    expect(NOTE_TYPE_LABELS.risk_flag).toBe("Risk flag");
  });
  it("guards membership", () => {
    expect(isNoteType("good_news")).toBe(true);
    expect(isNoteType("bogus")).toBe(false);
    expect(isNoteType(null)).toBe(false);
  });
  it("noteTypeMeta falls back to the first type for unknown values", () => {
    expect(noteTypeMeta("bogus").value).toBe("general_update");
    expect(noteTypeMeta("good_news").label).toBe("Good news");
  });
  it("every type has a pill class", () => {
    expect(NOTE_TYPES.every((t) => t.pill.includes("bg-[#"))).toBe(true);
  });
});
