"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { X, Mail, Phone, MessageSquare, Linkedin } from "lucide-react";
import MergeFieldToolbar from "./MergeFieldToolbar";
import {
  useCreateTemplate,
  useUpdateTemplate,
  useEngageTemplate,
} from "../lib/queries";
import { STEP_TYPE_LABELS, type StepType } from "../types";

interface TemplateEditorProps {
  templateId?: number;
  onClose: () => void;
  onSaved?: () => void;
}

const TYPE_OPTIONS: { value: StepType; label: string; icon: React.ReactNode }[] = [
  { value: "email", label: "Email", icon: <Mail className="w-4 h-4" /> },
  { value: "call", label: "Phone Call", icon: <Phone className="w-4 h-4" /> },
  { value: "text", label: "Text Message", icon: <MessageSquare className="w-4 h-4" /> },
  { value: "linkedin", label: "LinkedIn", icon: <Linkedin className="w-4 h-4" /> },
];

export default function TemplateEditor({
  templateId,
  onClose,
  onSaved,
}: TemplateEditorProps) {
  const isEdit = templateId != null;
  const { data: existing, isLoading: loadingExisting } = useEngageTemplate(
    isEdit ? templateId : null
  );
  const createTemplate = useCreateTemplate();
  const updateTemplate = useUpdateTemplate();

  const [name, setName] = useState("");
  const [type, setType] = useState<StepType>("email");
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");

  const subjectRef = useRef<HTMLInputElement>(null);
  const bodyRef = useRef<HTMLTextAreaElement>(null);
  const lastFocusedRef = useRef<"subject" | "body">("body");

  // Populate form when editing
  useEffect(() => {
    if (existing) {
      setName(existing.name);
      setType(existing.type);
      setSubject(existing.subject ?? "");
      setBody(existing.body);
    }
  }, [existing]);

  const handleInsertMergeField = useCallback((fieldKey: string) => {
    const tag = `{{${fieldKey}}}`;
    const target = lastFocusedRef.current;

    if (target === "subject" && subjectRef.current) {
      const el = subjectRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const newValue = el.value.slice(0, start) + tag + el.value.slice(end);
      setSubject(newValue);
      // Restore cursor after React re-render
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      });
    } else if (bodyRef.current) {
      const el = bodyRef.current;
      const start = el.selectionStart ?? el.value.length;
      const end = el.selectionEnd ?? start;
      const newValue = el.value.slice(0, start) + tag + el.value.slice(end);
      setBody(newValue);
      requestAnimationFrame(() => {
        el.focus();
        el.setSelectionRange(start + tag.length, start + tag.length);
      });
    }
  }, []);

  const isSaving = createTemplate.isPending || updateTemplate.isPending;

  const handleSave = async () => {
    if (!name.trim() || !body.trim()) return;

    const payload = {
      name: name.trim(),
      type,
      subject: type === "email" ? subject.trim() || null : null,
      body: body.trim(),
    };

    try {
      if (isEdit) {
        await updateTemplate.mutateAsync({ id: templateId, ...payload });
      } else {
        await createTemplate.mutateAsync(payload);
      }
      onSaved?.();
      onClose();
    } catch {
      // Error is surfaced via mutation state
    }
  };

  const canSave = name.trim().length > 0 && body.trim().length > 0;

  if (isEdit && loadingExisting) {
    return (
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
        <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl p-8">
          <div className="animate-pulse space-y-4">
            <div className="h-6 w-48 bg-[#EFEDF5] rounded-lg" />
            <div className="h-10 bg-[#F7F5FA] rounded-lg" />
            <div className="h-10 bg-[#F7F5FA] rounded-lg" />
            <div className="h-40 bg-[#F7F5FA] rounded-lg" />
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-2xl shadow-xl w-full max-w-2xl max-h-[90vh] flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
          <h2 className="text-lg font-semibold text-[#403770]">
            {isEdit ? "Edit Template" : "New Template"}
          </h2>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-[#6B5F8A] hover:bg-[#EFEDF5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-5">
          {/* Name */}
          <div>
            <label className="block text-xs font-medium text-[#6B5F8A] tracking-wide mb-1.5">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g., Initial Outreach Email"
              className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 focus:border-[#F37167] transition-colors"
            />
          </div>

          {/* Type selector */}
          <div>
            <label className="block text-xs font-medium text-[#6B5F8A] tracking-wide mb-1.5">
              Type
            </label>
            <div className="flex gap-2">
              {TYPE_OPTIONS.map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setType(opt.value)}
                  className={`flex items-center gap-2 px-3 py-2 text-sm font-medium rounded-lg border transition-colors ${
                    type === opt.value
                      ? "bg-[#F7F5FA] border-[#F37167] text-[#403770]"
                      : "bg-white border-[#D4CFE2] text-[#6B5F8A] hover:bg-[#F7F5FA] hover:border-[#C2BBD4]"
                  }`}
                >
                  {opt.icon}
                  {opt.label}
                </button>
              ))}
            </div>
          </div>

          {/* Subject (email only) */}
          {type === "email" && (
            <div>
              <label className="block text-xs font-medium text-[#6B5F8A] tracking-wide mb-1.5">
                Subject
              </label>
              <input
                ref={subjectRef}
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                onFocus={() => {
                  lastFocusedRef.current = "subject";
                }}
                placeholder="Email subject line with {{merge_fields}}"
                className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 focus:border-[#F37167] transition-colors"
              />
            </div>
          )}

          {/* Body */}
          <div>
            <label className="block text-xs font-medium text-[#6B5F8A] tracking-wide mb-1.5">
              {type === "email"
                ? "Body"
                : type === "call"
                  ? "Talking Points"
                  : "Message"}
            </label>
            <textarea
              ref={bodyRef}
              value={body}
              onChange={(e) => setBody(e.target.value)}
              onFocus={() => {
                lastFocusedRef.current = "body";
              }}
              rows={8}
              placeholder={
                type === "email"
                  ? "Write your email content here. Use merge fields like {{contact.first_name}} to personalize."
                  : type === "call"
                    ? "Add talking points and notes for the call..."
                    : "Write your message content here..."
              }
              className="w-full px-3 py-2 text-sm text-[#403770] bg-white border border-[#C2BBD4] rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/40 focus:border-[#F37167] transition-colors resize-y"
            />
          </div>

          {/* Merge Field Toolbar */}
          <div className="pt-2 border-t border-[#E2DEEC]">
            <MergeFieldToolbar onInsert={handleInsertMergeField} />
          </div>

          {/* Error display */}
          {(createTemplate.isError || updateTemplate.isError) && (
            <div className="px-3 py-2 text-sm text-[#F37167] bg-[#fef1f0] border border-[#f58d85] rounded-lg">
              Failed to save template. Please try again.
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-3 px-6 py-4 border-t border-[#E2DEEC]">
          <button
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-[#6B5F8A] bg-white border border-[#D4CFE2] rounded-lg hover:bg-[#F7F5FA] transition-colors"
          >
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={!canSave || isSaving}
            className="px-4 py-2 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e0625a] disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {isSaving ? "Saving..." : isEdit ? "Update Template" : "Create Template"}
          </button>
        </div>
      </div>
    </div>
  );
}
