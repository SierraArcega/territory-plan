"use client";
import { useEditor, EditorContent } from "@tiptap/react";
import { noteExtensions } from "./tiptap-extensions";

/**
 * Read-only render of a stored TipTap doc. Mounts a non-editable editor so the
 * exact same extension set (and future mention node-views) renders identically
 * to the composer, with no HTML injection. Bounded by popover pagination.
 */
export function NoteBody({ doc }: { doc: unknown }) {
  const editor = useEditor({
    extensions: noteExtensions,
    content: (doc as object) ?? "",
    editable: false,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: "text-sm text-[#544A78] leading-relaxed [&_a]:text-[#403770] [&_a]:underline" },
    },
  });
  return <EditorContent editor={editor} />;
}
