"use client";

import { useState, useRef, useEffect } from "react";
import {
  Mail,
  Phone,
  MessageSquare,
  Linkedin,
  MoreHorizontal,
  Archive,
  Copy,
  Play,
} from "lucide-react";
import type { SequenceData, StepType } from "../types";

const STEP_TYPE_ICONS: Record<StepType, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
};

interface SequenceCardProps {
  sequence: SequenceData;
  onClick: () => void;
  onArchive: () => void;
}

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

export default function SequenceCard({ sequence, onClick, onArchive }: SequenceCardProps) {
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

  const stepTypes = sequence.steps.map((s) => s.type);
  const uniqueTypes = Array.from(new Set(stepTypes));
  const executionCount = sequence._count?.executions ?? 0;

  return (
    <div
      onClick={onClick}
      className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 hover:shadow-md hover:border-[#C2BBD4] transition-all cursor-pointer group"
    >
      {/* Header */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-sm font-semibold text-[#403770] truncate">
            {sequence.name}
          </h3>
          {sequence.description && (
            <p className="text-xs text-[#8A80A8] truncate mt-0.5">
              {sequence.description}
            </p>
          )}
        </div>

        {/* Overflow menu */}
        <div className="relative" ref={menuRef}>
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              setMenuOpen(!menuOpen);
            }}
            className="p-1.5 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors opacity-0 group-hover:opacity-100 focus:opacity-100 cursor-pointer"
          >
            <MoreHorizontal className="w-4 h-4" />
          </button>
          {menuOpen && (
            <div className="absolute right-0 top-full mt-1 w-40 bg-white border border-[#D4CFE2]/60 rounded-xl shadow-lg z-30 py-1">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  onArchive();
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#403770] hover:bg-[#EFEDF5] transition-colors cursor-pointer"
              >
                <Archive className="w-4 h-4" />
                Archive
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  setMenuOpen(false);
                  // Duplicate functionality - would call create with same data
                }}
                className="flex items-center gap-2 w-full px-3 py-2 text-sm text-[#403770] hover:bg-[#EFEDF5] transition-colors cursor-pointer"
              >
                <Copy className="w-4 h-4" />
                Duplicate
              </button>
            </div>
          )}
        </div>
      </div>

      {/* Step type icons */}
      <div className="flex items-center gap-3 mb-3">
        <div className="flex items-center gap-1.5">
          {uniqueTypes.map((type) => {
            const Icon = STEP_TYPE_ICONS[type];
            return (
              <div
                key={type}
                className="w-6 h-6 rounded flex items-center justify-center bg-[#F7F5FA]"
              >
                <Icon className="w-3.5 h-3.5 text-[#6B5F8A]" />
              </div>
            );
          })}
        </div>
        <span className="text-xs font-medium text-[#8A80A8]">
          {sequence.steps.length} step{sequence.steps.length !== 1 ? "s" : ""}
        </span>
      </div>

      {/* Footer */}
      <div className="flex items-center justify-between pt-3 border-t border-[#E2DEEC]">
        <div className="flex items-center gap-1.5 text-xs text-[#A69DC0]">
          <Play className="w-3.5 h-3.5" />
          <span>
            {executionCount} run{executionCount !== 1 ? "s" : ""}
          </span>
        </div>
        <span className="text-xs text-[#A69DC0]">
          Updated {formatDate(sequence.updatedAt)}
        </span>
      </div>
    </div>
  );
}
