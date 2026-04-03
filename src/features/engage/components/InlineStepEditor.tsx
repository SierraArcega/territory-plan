"use client";

import { useState, useRef, useCallback } from "react";
import { Mail, Phone, MessageSquare, Linkedin, Save, X } from "lucide-react";
import type { StepType } from "../types";
import { STEP_TYPE_LABELS } from "../types";
import { useCreateTemplate } from "../lib/queries";
import MergeFieldToolbar from "./MergeFieldToolbar";

const STEP_TYPE_ICONS: Record<StepType, React.ComponentType<{ className?: string }>> = {
  email: Mail,
  call: Phone,
  text: MessageSquare,
  linkedin: Linkedin,
};

const STEP_TYPES: StepType[] = ["email", "call", "text", "linkedin"];

interface InlineStepEditorProps {
  step?: { type: StepType; subject?: string; body?: string };
  onSave: (data: { type: StepType; subject?: string; body: string }) => void;
  onCancel: () => void;
}

export default function InlineStepEditor({ step, onSave, onCancel }: InlineStepEditorProps) {
  const [type, setType] = useState<StepType>(step?.type ?? "email");
  const [subject, setSubject] = useState(step?.subject ?? "");
  const [body, setBody] = useState(step?.body ?? "");
  const [showMergeFields, setShowMergeFields] = useState(false);
  const [saveAsTemplateMode, setSaveAsTemplateMode] = useState(false);
  const [templateName, setTemplateName] = useState("");

  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const createTemplate = useCreateTemplate();

  const handleInsertMergeField = useCallback((fieldKey: string) => {
    const textarea = bodyRef.current;
    if (!textarea) return;
    const tag = `{{${fieldKey}}}`;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newBody = body.slice(0, start) + tag + body.slice(end);
    setBody(newBody);
    // Restore cursor position after insertion
    requestAnimationFrame(() => {
      textarea.focus();
      const newPos = start + tag.length;
      textarea.setSelectionRange(newPos, newPos);
    });
  }, [body]);

  const handleSave = () => {
    if (!body.trim()) return;
    onSave({
      type,
      subject: type === "email" ? subject : undefined,
      body,
    });
  };

  const handleSaveAsTemplate = async () => {
    if (!templateName.trim() || !body.trim()) return;
    try {
      await createTemplate.mutateAsync({
        name: templateName,
        type,
        subject: type === "email" ? subject : null,
        body,
      });
      setSaveAsTemplateMode(false);
      setTemplateName("");
    } catch {
      // Error handled by TanStack Query
    }
  };

  return (
    <div className="space-y-4">
      {/* Type selector */}
      <div>
        <label className="text-xs font-medium text-[#6B5F8A] uppercase tracking-wider block mb-2">
          Step Type
        </label>
        <div className="flex gap-1.5">
          {STEP_TYPES.map((t) => {
            const Icon = STEP_TYPE_ICONS[t];
            const isActive = type === t;
            return (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
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

      {/* Subject (email only) */}
      {type === "email" && (
        <div>
          <label className="text-xs font-medium text-[#6B5F8A] uppercase tracking-wider block mb-1.5">
            Subject
          </label>
          <input
            type="text"
            value={subject}
            onChange={(e) => setSubject(e.target.value)}
            placeholder="Email subject line..."
            className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] placeholder:text-[#A69DC0]"
          />
        </div>
      )}

      {/* Body */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <label className="text-xs font-medium text-[#6B5F8A] uppercase tracking-wider">
            Body
          </label>
          <button
            type="button"
            onClick={() => setShowMergeFields(!showMergeFields)}
            className="text-xs font-medium text-[#6EA3BE] hover:text-[#403770] transition-colors cursor-pointer"
          >
            {showMergeFields ? "Hide" : "Insert"} Merge Fields
          </button>
        </div>
        <textarea
          ref={bodyRef}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Write your message..."
          rows={6}
          className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] placeholder:text-[#A69DC0] resize-y"
        />
      </div>

      {/* Merge field toolbar */}
      {showMergeFields && (
        <div className="p-3 bg-[#F7F5FA] rounded-lg border border-[#E2DEEC]">
          <MergeFieldToolbar onInsert={handleInsertMergeField} />
        </div>
      )}

      {/* Save as Template */}
      {!saveAsTemplateMode ? (
        <button
          type="button"
          onClick={() => setSaveAsTemplateMode(true)}
          className="text-xs font-medium text-[#6EA3BE] hover:text-[#403770] transition-colors cursor-pointer"
        >
          Save as Template
        </button>
      ) : (
        <div className="flex items-center gap-2 p-3 bg-[#F7F5FA] rounded-lg border border-[#E2DEEC]">
          <input
            type="text"
            value={templateName}
            onChange={(e) => setTemplateName(e.target.value)}
            placeholder="Template name..."
            className="flex-1 px-3 py-1.5 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] placeholder:text-[#A69DC0]"
          />
          <button
            type="button"
            onClick={handleSaveAsTemplate}
            disabled={createTemplate.isPending || !templateName.trim()}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-white bg-[#6EA3BE] rounded-lg hover:bg-[#5A8FA8] transition-colors disabled:opacity-50 cursor-pointer"
          >
            <Save className="w-3.5 h-3.5" />
            {createTemplate.isPending ? "Saving..." : "Save"}
          </button>
          <button
            type="button"
            onClick={() => {
              setSaveAsTemplateMode(false);
              setTemplateName("");
            }}
            className="p-1.5 text-[#A69DC0] hover:text-[#403770] transition-colors cursor-pointer"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center gap-2 pt-2 border-t border-[#E2DEEC]">
        <button
          type="button"
          onClick={handleSave}
          disabled={!body.trim()}
          className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0605a] transition-colors disabled:opacity-50 cursor-pointer"
        >
          Save Step
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="px-4 py-2 text-sm font-medium text-[#6B5F8A] hover:text-[#403770] transition-colors cursor-pointer"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
