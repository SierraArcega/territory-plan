"use client";

import { useState, useEffect } from "react";
import { Phone, MessageSquare, Linkedin, SkipForward, CheckCircle2 } from "lucide-react";
import type { StepExecutionData, StepType, STEP_TYPE_LABELS } from "../types";

const STEP_ICONS: Record<string, React.ElementType> = {
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
};

const STEP_LABELS: Record<string, string> = {
  call: "Phone Call",
  text: "Text Message",
  linkedin: "LinkedIn Message",
};

interface ManualStepViewProps {
  stepExecution: StepExecutionData;
  stepType: StepType;
  onComplete: (notes: string) => void;
  onSkip: () => void;
  isCompleting: boolean;
}

export default function ManualStepView({
  stepExecution,
  stepType,
  onComplete,
  onSkip,
  isCompleting,
}: ManualStepViewProps) {
  const [notes, setNotes] = useState(stepExecution.notes || "");

  // Reset when stepExecution changes
  useEffect(() => {
    setNotes(stepExecution.notes || "");
  }, [stepExecution.id, stepExecution.notes]);

  const Icon = STEP_ICONS[stepType] || Phone;
  const label = STEP_LABELS[stepType] || stepType;

  const handleComplete = () => {
    onComplete(notes);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* Step type header */}
      <div className="flex items-center gap-3 px-4 py-3 bg-[#F7F5FA] rounded-lg border border-[#E2DEEC]">
        <div className="w-9 h-9 rounded-lg bg-[#403770]/10 flex items-center justify-center">
          <Icon className="w-4.5 h-4.5 text-[#403770]" />
        </div>
        <div>
          <h3 className="text-sm font-semibold text-[#403770]">{label}</h3>
          <p className="text-xs text-[#8A80A8]">
            Complete this action and log your notes
          </p>
        </div>
      </div>

      {/* Contact info */}
      <div className="border border-[#D4CFE2] rounded-lg p-4">
        <h4 className="text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-3">
          Contact Information
        </h4>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <span className="text-xs text-[#8A80A8]">Name</span>
            <p className="text-sm font-medium text-[#403770]">
              {stepExecution.contact.name}
            </p>
          </div>
          {stepExecution.contact.title && (
            <div>
              <span className="text-xs text-[#8A80A8]">Title</span>
              <p className="text-sm font-medium text-[#403770]">
                {stepExecution.contact.title}
              </p>
            </div>
          )}
          {stepExecution.contact.email && (
            <div>
              <span className="text-xs text-[#8A80A8]">Email</span>
              <p className="text-sm text-[#6EA3BE]">
                {stepExecution.contact.email}
              </p>
            </div>
          )}
          {stepExecution.contact.leaid && (
            <div>
              <span className="text-xs text-[#8A80A8]">District</span>
              <p className="text-sm text-[#6B5F8A]">
                {stepExecution.contact.leaid}
              </p>
            </div>
          )}
        </div>
      </div>

      {/* Talking points */}
      {stepExecution.sentBody && (
        <div>
          <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1.5">
            Talking Points
          </label>
          <div className="px-4 py-3 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg">
            <p className="text-sm text-[#403770] whitespace-pre-wrap">
              {stepExecution.sentBody}
            </p>
          </div>
        </div>
      )}

      {/* Notes */}
      <div>
        <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1.5">
          Notes
        </label>
        <textarea
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder={`Add notes about this ${label.toLowerCase()}...`}
          rows={5}
          className="w-full px-3 py-2.5 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] resize-y"
        />
      </div>

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          disabled={isCompleting}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6B5F8A] hover:text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors disabled:opacity-50"
        >
          <SkipForward className="w-4 h-4" />
          Skip
        </button>
        <button
          onClick={handleComplete}
          disabled={isCompleting}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e05e54] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isCompleting ? (
            <>
              <svg
                className="animate-spin w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8v4a4 4 0 00-4 4H4z"
                />
              </svg>
              Completing...
            </>
          ) : (
            <>
              <CheckCircle2 className="w-4 h-4" />
              Complete &amp; Next
            </>
          )}
        </button>
      </div>
    </div>
  );
}
