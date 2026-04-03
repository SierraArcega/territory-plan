"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mail,
  Phone,
  MessageSquare,
  Linkedin,
  MoreHorizontal,
  Archive,
} from "lucide-react";
import type { EngageTemplate, StepType } from "../types";

interface TemplateCardProps {
  template: EngageTemplate;
  onClick: () => void;
  onArchive: () => void;
}

const TYPE_ICONS: Record<StepType, React.ReactNode> = {
  email: <Mail className="w-5 h-5" />,
  call: <Phone className="w-5 h-5" />,
  text: <MessageSquare className="w-5 h-5" />,
  linkedin: <Linkedin className="w-5 h-5" />,
};

const TYPE_LABELS: Record<StepType, string> = {
  email: "Email",
  call: "Phone Call",
  text: "Text Message",
  linkedin: "LinkedIn",
};

function formatDate(dateStr: string): string {
  const date = new Date(dateStr);
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function truncate(text: string, maxLen: number): string {
  if (text.length <= maxLen) return text;
  return text.slice(0, maxLen).trimEnd() + "...";
}

export default function TemplateCard({
  template,
  onClick,
  onArchive,
}: TemplateCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  // Close menu on outside click
  useEffect(() => {
    if (!menuOpen) return;
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [menuOpen]);

  return (
    <div
      onClick={onClick}
      className="group relative bg-white border border-[#D4CFE2] rounded-xl p-4 shadow-sm hover:shadow-lg hover:border-[#C2BBD4] transition-all cursor-pointer"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="flex items-center gap-2.5 min-w-0">
          <div className="flex-shrink-0 p-2 rounded-lg bg-[#F7F5FA] text-[#544A78]">
            {TYPE_ICONS[template.type]}
          </div>
          <div className="min-w-0">
            <h3 className="text-sm font-semibold text-[#403770] truncate">
              {template.name}
            </h3>
            <p className="text-xs text-[#A69DC0]">
              {TYPE_LABELS[template.type]}
            </p>
          </div>
        </div>

        {/* Overflow menu */}
        <div ref={menuRef} className="relative flex-shrink-0">
          <button
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen((prev) => !prev);
            }}
            className="p-1.5 rounded-lg text-[#A69DC0] hover:text-[#6B5F8A] hover:bg-[#EFEDF5] opacity-0 group-hover:opacity-100 transition-all"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>

          {menuOpen && (
            <div className="absolute right-0 top-8 z-10 w-36 bg-white border border-[#D4CFE2] rounded-xl shadow-lg py-1">
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onArchive();
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-sm text-[#6B5F8A] hover:bg-[#EFEDF5] transition-colors"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Body preview */}
      <p className="text-sm text-[#6E6390] leading-relaxed mb-3">
        {truncate(template.body, 80)}
      </p>

      {/* Footer */}
      <p className="text-xs text-[#A69DC0]">
        Updated {formatDate(template.updatedAt)}
      </p>
    </div>
  );
}
