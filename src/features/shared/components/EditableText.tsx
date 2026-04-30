"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/features/shared/lib/cn";

export interface EditableTextProps {
  value: string | null | undefined;
  onChange?: (next: string) => void;
  placeholder?: string;
  readOnly?: boolean;
  multiline?: boolean;
  size?: "sm" | "md" | "lg";
  weight?: "normal" | "medium" | "semibold" | "bold";
  className?: string;
  ariaLabel?: string;
}

const SIZE_CLASS: Record<NonNullable<EditableTextProps["size"]>, string> = {
  sm: "text-xs",
  md: "text-sm",
  lg: "text-xl",
};

const WEIGHT_CLASS: Record<NonNullable<EditableTextProps["weight"]>, string> = {
  normal: "font-normal",
  medium: "font-medium",
  semibold: "font-semibold",
  bold: "font-bold",
};

/**
 * Click-to-edit text. Click to open input; Enter or blur commits, Esc cancels.
 * In multiline mode, Enter inserts a newline; commit happens on blur only.
 */
export default function EditableText({
  value,
  onChange,
  placeholder = "Empty",
  readOnly,
  multiline,
  size = "md",
  weight = "medium",
  className,
  ariaLabel,
}: EditableTextProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(value ?? "");
  const inputRef = useRef<HTMLInputElement | HTMLTextAreaElement | null>(null);

  useEffect(() => {
    setDraft(value ?? "");
  }, [value]);

  useEffect(() => {
    if (editing && inputRef.current) {
      inputRef.current.focus();
      if ("select" in inputRef.current) inputRef.current.select();
    }
  }, [editing]);

  const commit = () => {
    setEditing(false);
    if (draft !== (value ?? "")) onChange?.(draft);
  };

  const cancel = () => {
    setDraft(value ?? "");
    setEditing(false);
  };

  if (editing && !readOnly) {
    if (multiline) {
      return (
        <textarea
          ref={inputRef as React.RefObject<HTMLTextAreaElement>}
          value={draft}
          rows={3}
          aria-label={ariaLabel}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={commit}
          onKeyDown={(e) => {
            if (e.key === "Escape") cancel();
          }}
          placeholder={placeholder}
          className={cn(
            "w-full px-2.5 py-2 rounded-md border border-[#D4CFE2] bg-white",
            "outline-2 -outline-offset-1 outline outline-[#F37167]",
            "leading-relaxed resize-y text-[#403770]",
            SIZE_CLASS[size],
            WEIGHT_CLASS[weight],
            className
          )}
        />
      );
    }
    return (
      <input
        ref={inputRef as React.RefObject<HTMLInputElement>}
        type="text"
        value={draft}
        aria-label={ariaLabel}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={commit}
        onKeyDown={(e) => {
          if (e.key === "Enter") {
            e.preventDefault();
            commit();
          } else if (e.key === "Escape") {
            cancel();
          }
        }}
        placeholder={placeholder}
        className={cn(
          "w-full px-2 py-1.5 rounded-md border border-[#D4CFE2] bg-white",
          "outline-2 -outline-offset-1 outline outline-[#F37167]",
          "text-[#403770]",
          SIZE_CLASS[size],
          WEIGHT_CLASS[weight],
          className
        )}
      />
    );
  }

  const empty = !value;
  return (
    <div
      role={readOnly ? undefined : "button"}
      tabIndex={readOnly ? undefined : 0}
      aria-label={ariaLabel}
      onClick={() => !readOnly && setEditing(true)}
      onKeyDown={(e) => {
        if (readOnly) return;
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          setEditing(true);
        }
      }}
      className={cn(
        "px-2 py-1.5 -mx-2 -my-1.5 rounded-md transition-colors",
        readOnly ? "cursor-default" : "cursor-text hover:bg-[#EFEDF5]",
        empty ? "italic text-[#A69DC0]" : "text-[#403770]",
        multiline ? "whitespace-pre-wrap leading-relaxed" : "truncate",
        SIZE_CLASS[size],
        WEIGHT_CLASS[weight],
        className
      )}
    >
      {empty ? placeholder : value}
    </div>
  );
}
