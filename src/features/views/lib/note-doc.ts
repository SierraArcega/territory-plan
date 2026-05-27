/**
 * Build a minimal TipTap doc from plain text. District notes persist a TipTap
 * `bodyJson` (authored in the browser via the composer) plus a `bodyText`
 * mirror. The AI copilot only has plain text, so it uses this to produce a
 * `bodyJson` that `NoteBody` (the read-only TipTap renderer) displays
 * identically to a hand-typed note — one paragraph per line.
 */
export interface NoteDoc {
  bodyJson: {
    type: "doc";
    content: Array<
      { type: "paragraph"; content: [{ type: "text"; text: string }] } | { type: "paragraph" }
    >;
  };
  bodyText: string;
}

export function plainTextToNoteDoc(text: string): NoteDoc {
  const bodyText = text.trim();
  const lines = bodyText.split("\n");
  const content = lines.map((line) =>
    line.length > 0
      ? { type: "paragraph" as const, content: [{ type: "text" as const, text: line }] }
      : { type: "paragraph" as const },
  );
  return { bodyJson: { type: "doc", content }, bodyText };
}
