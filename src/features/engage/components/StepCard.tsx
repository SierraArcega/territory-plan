"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mail,
  Phone,
  MessageSquare,
  Linkedin,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Trash2,
} from "lucide-react";
import type { SequenceStepData, StepType } from "../types";

const STEP_TYPE_ICONS: Record<StepType, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
};

const STEP_TYPE_COLORS: Record<StepType, { border: string; bg: string; text: string }> = {
  email: { border: "#F37167", bg: "bg-[#F37167]/10", text: "text-[#F37167]" },
  call: { border: "#6EA3BE", bg: "bg-[#6EA3BE]/10", text: "text-[#6EA3BE]" },
  text: { border: "#FFCF70", bg: "bg-[#FFCF70]/20", text: "text-[#b8922e]" },
  linkedin: { border: "#403770", bg: "bg-[#403770]/10", text: "text-[#403770]" },
};

interface StepCardProps {
  step: SequenceStepData;
  index: number;
  onEdit: () => void;
  onRemove: () => void;
}

export default function StepCard({ step, index, onEdit, onRemove }: StepCardProps) {
  const [menuOpen, setMenuOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!menuOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenuOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [menuOpen]);

  const Icon = STEP_TYPE_ICONS[step.type];
  const colors = STEP_TYPE_COLORS[step.type];
  const templateName = step.template?.name ?? null;
  const isInline = !step.templateId;
  const subject = step.template?.subject ?? step.subject;

  return (
    <div
      className="flex items-center gap-3 bg-white rounded-lg border border-[#D4CFE2] shadow-sm group border-l-4"
      style={{ borderLeftColor: colors.border }}
    >
      {/* Drag handle */}
      <div className="pl-2 py-3 cursor-grab text-[#A69DC0] hover:text-[#6B5F8A] transition-colors">
        <GripVertical className="w-5 h-5" />
      </div>

      {/* Step number */}
      <span className="text-xs font-semibold text-[#8A80A8] w-5 text-center shrink-0">
        {index + 1}
      </span>

      {/* Type icon */}
      <div
        className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${colors.bg}`}
      >
        <Icon className={`w-4 h-4 ${colors.text}`} />
      </div>

      {/* Content */}
      <div className="flex-1 min-w-0 py-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-[#403770] truncate">
            {templateName ?? "Custom"}
          </span>
          {isInline && (
            <span className="text-[10px] font-medium text-[#8A80A8] bg-[#F7F5FA] px-1.5 py-0.5 rounded-full">
              Inline
            </span>
          )}
        </div>
        {subject && (
          <p className="text-xs text-[#8A80A8] truncate mt-0.5">{subject}</p>
        )}
      </div>

      {/* Overflow menu */}
      <div className="relative pr-3" ref={menuRef}>
        <button
          type="button"
          onClick={() => setMenuOpen(!menuOpen)}
          className="p-1.5 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
        >
          <MoreHorizontal className="w-4 h-4" />
        </button>
        {menuOpen && (
          <div className="absolute right-0 top-full mt-1 w-36 bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg z-30 py-1">
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onEdit();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#403770] hover:bg-[#EFEDF5] transition-colors cursor-pointer"
            >
              <Pencil className="w-4 h-4" />
              Edit
            </button>
            <button
              type="button"
              onClick={() => {
                setMenuOpen(false);
                onRemove();
              }}
              className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#F37167] hover:bg-[#fef1f0] transition-colors cursor-pointer"
            >
              <Trash2 className="w-4 h-4" />
              Remove
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
