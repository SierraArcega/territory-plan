"use client";

import { useState } from "react";
import {
  X,
  Mail,
  Phone,
  MessageSquare,
  Linkedin,
  FileText,
  PenLine,
} from "lucide-react";
import type { StepType, EngageTemplate } from "../types";
import { STEP_TYPE_LABELS } from "../types";
import { useEngageTemplates, useAddStep } from "../lib/queries";
import InlineStepEditor from "./InlineStepEditor";

const STEP_TYPE_ICONS: Record<StepType, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
};

const STEP_TYPES: StepType[] = ["email", "call", "text", "linkedin"];

interface AddStepModalProps {
  sequenceId: number;
  onClose: () => void;
  onAdded?: () => void;
}

type Mode = "choose" | "custom";

export default function AddStepModal({ sequenceId, onClose, onAdded }: AddStepModalProps) {
  const [typeFilter, setTypeFilter] = useState<StepType>("email");
  const [mode, setMode] = useState<Mode>("choose");

  const { data: templates, isLoading } = useEngageTemplates(typeFilter);
  const addStep = useAddStep();

  const handleSelectTemplate = async (template: EngageTemplate) => {
    try {
      await addStep.mutateAsync({
        sequenceId,
        templateId: template.id,
        type: template.type,
      });
      onAdded?.();
      onClose();
    } catch {
      // Error handled by TanStack Query
    }
  };

  const handleSaveInline = async (data: { type: StepType; subject?: string; body: string }) => {
    try {
      await addStep.mutateAsync({
        sequenceId,
        type: data.type,
        subject: data.subject ?? null,
        body: data.body,
      });
      onAdded?.();
      onClose();
    } catch {
      // Error handled by TanStack Query
    }
  };

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-[#403770]/30 backdrop-blur-sm" onClick={onClose} />

      {/* Modal */}
      <div className="relative w-full max-w-2xl max-h-[85vh] bg-white rounded-2xl shadow-xl overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
          <h2 className="text-lg font-semibold text-[#403770]">Add Step</h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#A69DC0] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Type filter */}
        <div className="px-6 pt-4 pb-3">
          <div className="flex gap-1.5">
            {STEP_TYPES.map((t) => {
              const Icon = STEP_TYPE_ICONS[t];
              const isActive = typeFilter === t;
              return (
                <button
                  key={t}
                  type="button"
                  onClick={() => setTypeFilter(t)}
                  className={`flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors cursor-pointer ${
                    isActive
                      ? "border-[#F37167] bg-[#fef1f0] text-[#F37167]"
                      : "border-[#D4CFE2] bg-white text-[#6B5F8A] hover:bg-[#EFEDF5]"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  {STEP_TYPE_LABELS[t]}
                </button>
              );
            })}
          </div>
        </div>

        {/* Mode tabs */}
        <div className="flex gap-1 px-6 border-b border-[#E2DEEC]">
          <button
            type="button"
            onClick={() => setMode("choose")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              mode === "choose"
                ? "border-[#F37167] text-[#403770]"
                : "border-transparent text-[#6B5F8A] hover:text-[#403770]"
            }`}
          >
            <FileText className="w-4 h-4" />
            Choose Template
          </button>
          <button
            type="button"
            onClick={() => setMode("custom")}
            className={`flex items-center gap-1.5 px-3 py-2 text-sm font-medium border-b-2 transition-colors cursor-pointer ${
              mode === "custom"
                ? "border-[#F37167] text-[#403770]"
                : "border-transparent text-[#6B5F8A] hover:text-[#403770]"
            }`}
          >
            <PenLine className="w-4 h-4" />
            Write Custom
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {mode === "choose" ? (
            <div>
              {isLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((i) => (
                    <div
                      key={i}
                      className="h-16 bg-[#F7F5FA] rounded-lg animate-pulse"
                    />
                  ))}
                </div>
              ) : !templates?.length ? (
                <div className="text-center py-12">
                  <FileText className="w-10 h-10 text-[#A69DC0] mx-auto mb-3" />
                  <p className="text-sm font-medium text-[#403770] mb-1">
                    No {STEP_TYPE_LABELS[typeFilter].toLowerCase()} templates
                  </p>
                  <p className="text-xs text-[#8A80A8]">
                    Create one in the Templates tab, or write custom content
                  </p>
                </div>
              ) : (
                <div className="space-y-2">
                  {templates.map((template) => (
                    <button
                      key={template.id}
                      type="button"
                      onClick={() => handleSelectTemplate(template)}
                      disabled={addStep.isPending}
                      className="w-full text-left p-3 bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#EFEDF5] hover:border-[#C2BBD4] transition-colors cursor-pointer disabled:opacity-50"
                    >
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-[#403770]">
                          {template.name}
                        </span>
                        {addStep.isPending && (
                          <span className="text-xs text-[#8A80A8]">Adding...</span>
                        )}
                      </div>
                      {template.subject && (
                        <p className="text-xs text-[#8A80A8] mt-0.5 truncate">
                          {template.subject}
                        </p>
                      )}
                      <p className="text-xs text-[#A69DC0] mt-1 line-clamp-2">
                        {template.body.slice(0, 120)}
                        {template.body.length > 120 ? "..." : ""}
                      </p>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <InlineStepEditor
              step={{ type: typeFilter }}
              onSave={handleSaveInline}
              onCancel={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
