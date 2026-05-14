"use client";

import { useEffect, useRef, useState } from "react";
import { ExternalLink, Pencil } from "lucide-react";

interface CanvaDeckPageProps {
  title: string;
  canvaUrl: string;
  storageKey: string;
}

export default function CanvaDeckPage({
  title,
  canvaUrl,
  storageKey,
}: CanvaDeckPageProps) {
  const [description, setDescription] = useState("");
  const [isEditing, setIsEditing] = useState(false);
  const [draft, setDraft] = useState("");
  const [showSaved, setShowSaved] = useState(false);
  const savedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    const saved = localStorage.getItem(storageKey);
    if (saved) setDescription(saved);
  }, [storageKey]);

  function enterEdit() {
    setDraft(description);
    setIsEditing(true);
  }

  function saveEdit(value: string) {
    const trimmed = value.trim();
    localStorage.setItem(storageKey, trimmed);
    setDescription(trimmed);
    setIsEditing(false);
    setDraft("");
    if (trimmed) {
      setShowSaved(true);
      if (savedTimerRef.current) clearTimeout(savedTimerRef.current);
      savedTimerRef.current = setTimeout(() => setShowSaved(false), 1500);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if ((e.metaKey || e.ctrlKey) && e.key === "Enter") {
      e.preventDefault();
      saveEdit(draft);
    }
    if (e.key === "Escape") {
      setIsEditing(false);
      setDraft("");
    }
  }

  return (
    <div className="flex h-full flex-col">
      <header className="mb-4 flex-shrink-0">
        <h1 className="text-2xl font-bold text-[#403770] tracking-tight">
          {title}
        </h1>
      </header>

      {/* Editable description */}
      <div className="flex-shrink-0">
        {isEditing ? (
          <div>
            <textarea
              autoFocus
              rows={3}
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              onBlur={() => saveEdit(draft)}
              onKeyDown={handleKeyDown}
              placeholder="Add a description..."
              className="w-full resize-none rounded-lg border border-[#8A80A8] px-4 py-3 text-sm text-[#403770] outline-none focus:ring-2 focus:ring-[#F37167] focus:ring-offset-1"
            />
            <p className="mt-1 text-xs text-[#A69DC0]">
              Cmd/Ctrl+Enter to save · Esc to cancel
            </p>
          </div>
        ) : (
          <button
            onClick={enterEdit}
            className={`flex w-full items-start justify-between gap-3 rounded-lg px-4 py-3 text-left transition-colors duration-100 ${
              description
                ? "border border-[#E2DEEC] bg-[#F7F5FA] hover:border-[#D4CFE2]"
                : "border border-dashed border-[#D4CFE2] hover:border-[#8A80A8]"
            }`}
          >
            <span
              className={`text-sm leading-relaxed ${
                description ? "text-[#6E6390]" : "italic text-[#A69DC0]"
              }`}
            >
              {description || "Add a description..."}
            </span>
            <Pencil className="mt-0.5 h-3.5 w-3.5 flex-shrink-0 text-[#A69DC0]" />
          </button>
        )}

        {showSaved && (
          <p className="mt-1.5 text-xs text-[#69B34A]">Saved</p>
        )}
      </div>

      <div className="mt-6 flex-shrink-0">
        <a
          href={canvaUrl}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 rounded-lg bg-[#F37167] px-4 py-2 text-sm font-medium text-white transition-colors duration-100 hover:bg-[#E85D52] focus:outline-none focus-visible:ring-2 focus-visible:ring-[#F37167] focus-visible:ring-offset-2"
        >
          Open in Canva
          <ExternalLink className="h-4 w-4" />
        </a>
      </div>

      {!description && !isEditing && (
        <p className="mt-4 flex-shrink-0 text-xs text-[#A69DC0]">
          Click the description above to add notes about this deck.
        </p>
      )}
    </div>
  );
}
