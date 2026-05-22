import StarterKit from "@tiptap/starter-kit";
import Link from "@tiptap/extension-link";
import type { Extensions } from "@tiptap/react";

/**
 * Shared TipTap extension set for the note composer + read-only renderer.
 * Phase 1: bold / italic / lists / links. Link only accepts http(s)/mailto so
 * the read-only render is safe without a separate sanitizer. Mention extensions
 * arrive in Phase 2 (we'll also disable the `#`/`*` input rules then).
 */
export const noteExtensions: Extensions = [
  StarterKit.configure({
    heading: false,
    horizontalRule: false,
    codeBlock: false,
    blockquote: false,
  }),
  Link.configure({
    openOnClick: false,
    autolink: true,
    protocols: ["http", "https", "mailto"],
    HTMLAttributes: { rel: "noopener noreferrer nofollow", class: "text-[#403770] underline" },
  }),
];
