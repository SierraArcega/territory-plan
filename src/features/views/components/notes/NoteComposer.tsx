"use client";
import { useState } from "react";
import { useEditor, EditorContent, type Editor } from "@tiptap/react";
import { Bold, Italic, List, ListOrdered, Link2 } from "lucide-react";
import { noteExtensions } from "./tiptap-extensions";
import { NoteTypePicker } from "./NoteTypePicker";
import { DEFAULT_NOTE_TYPE } from "../../lib/note-types";

export interface NoteDraft {
  bodyJson: unknown;
  bodyText: string;
  noteType: string;
}

interface Props {
  onSubmit: (draft: NoteDraft) => void;
  pending: boolean;
  /** Optional initial doc when editing an existing entry. */
  initialContent?: unknown;
  submitLabel?: string;
}

function ToolbarButton({
  editor, label, active, onClick, children,
}: {
  editor: Editor | null; label: string; active: boolean;
  onClick: () => void; children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      disabled={!editor}
      onMouseDown={(e) => { e.preventDefault(); onClick(); }}
      className={`w-7 h-7 inline-flex items-center justify-center rounded-md text-[#544A78] hover:bg-[#F7F5FA] ${
        active ? "bg-[#EFEDF5] text-[#403770]" : ""
      }`}
    >
      {children}
    </button>
  );
}

export function NoteComposer({ onSubmit, pending, initialContent, submitLabel = "Add note" }: Props) {
  const [noteType, setNoteType] = useState<string>(DEFAULT_NOTE_TYPE);
  const editor = useEditor({
    extensions: noteExtensions,
    content: initialContent ?? "",
    editorProps: {
      attributes: {
        class: "min-h-[88px] px-3 py-2.5 text-sm leading-relaxed text-[#403770] focus:outline-none",
      },
    },
    immediatelyRender: false,
  });

  const isEmpty = !editor || editor.isEmpty;

  function submit() {
    if (!editor || editor.isEmpty) return;
    onSubmit({ bodyJson: editor.getJSON(), bodyText: editor.getText().trim(), noteType });
    editor.commands.clearContent();
    setNoteType(DEFAULT_NOTE_TYPE);
  }

  function setLink() {
    if (!editor) return;
    const url = window.prompt("Link URL");
    if (url) editor.chain().focus().setLink({ href: url }).run();
  }

  return (
    <div className="rounded-[10px] border border-[#D4CFE2] bg-white overflow-hidden focus-within:border-[#403770]">
      <div className="flex items-center gap-2 px-2 pt-2">
        <NoteTypePicker value={noteType} onChange={setNoteType} />
      </div>
      <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#E2DEEC] bg-[#FBFAFE]">
        <ToolbarButton editor={editor} label="Bold" active={!!editor?.isActive("bold")}
          onClick={() => editor?.chain().focus().toggleBold().run()}><Bold className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Italic" active={!!editor?.isActive("italic")}
          onClick={() => editor?.chain().focus().toggleItalic().run()}><Italic className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Bullet list" active={!!editor?.isActive("bulletList")}
          onClick={() => editor?.chain().focus().toggleBulletList().run()}><List className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Numbered list" active={!!editor?.isActive("orderedList")}
          onClick={() => editor?.chain().focus().toggleOrderedList().run()}><ListOrdered className="w-3.5 h-3.5" /></ToolbarButton>
        <ToolbarButton editor={editor} label="Link" active={!!editor?.isActive("link")}
          onClick={setLink}><Link2 className="w-3.5 h-3.5" /></ToolbarButton>
      </div>

      <div
        onKeyDown={(e) => {
          if (e.key === "Enter" && (e.metaKey || e.ctrlKey)) { e.preventDefault(); submit(); }
        }}
      >
        <EditorContent editor={editor} />
      </div>

      <div className="flex items-center justify-between px-2.5 py-2 border-t border-[#E2DEEC] bg-[#FFFCFA]">
        <span className="text-[10px] text-[#A69DC0] font-medium">⌘↵ to save</span>
        <button
          type="button"
          onClick={submit}
          disabled={isEmpty || pending}
          className="px-3 py-1 text-xs font-semibold text-white bg-[#403770] rounded-md hover:bg-[#322a5a] disabled:opacity-50"
        >
          {pending ? "Saving…" : submitLabel}
        </button>
      </div>
    </div>
  );
}
