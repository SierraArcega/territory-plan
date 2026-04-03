"use client";

import { useState, useEffect } from "react";
import { Mail, Send, SkipForward } from "lucide-react";
import type { StepExecutionData } from "../types";

/**
 * Highlight unresolved {{...}} merge fields with a yellow background.
 * Returns an array of React nodes with highlighted spans.
 */
function highlightUnresolved(text: string): React.ReactNode[] {
  const parts: React.ReactNode[] = [];
  const regex = /\{\{(\w+(?:\.\w+)*)\}\}/g;
  let lastIndex = 0;
  let match;

  while ((match = regex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(
      <span
        key={match.index}
        className="bg-[#fffaf1] text-[#403770] px-1 rounded border border-[#ffd98d]"
      >
        {match[0]}
      </span>
    );
    lastIndex = regex.lastIndex;
  }

  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }

  return parts;
}

function hasUnresolved(text: string): boolean {
  return /\{\{\w+(?:\.\w+)*\}\}/.test(text);
}

interface EmailStepViewProps {
  stepExecution: StepExecutionData;
  onSend: (subject: string, body: string) => void;
  onSkip: () => void;
  isSending: boolean;
}

export default function EmailStepView({
  stepExecution,
  onSend,
  onSkip,
  isSending,
}: EmailStepViewProps) {
  const [subject, setSubject] = useState(stepExecution.sentSubject || "");
  const [body, setBody] = useState(stepExecution.sentBody || "");

  // Reset when stepExecution changes
  useEffect(() => {
    setSubject(stepExecution.sentSubject || "");
    setBody(stepExecution.sentBody || "");
  }, [stepExecution.id, stepExecution.sentSubject, stepExecution.sentBody]);

  const hasUnresolvedSubject = hasUnresolved(subject);
  const hasUnresolvedBody = hasUnresolved(body);
  const hasWarning = hasUnresolvedSubject || hasUnresolvedBody;

  const handleSend = () => {
    onSend(subject, body);
  };

  return (
    <div className="flex flex-col gap-5">
      {/* To field */}
      <div>
        <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1.5">
          To
        </label>
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#F7F5FA] border border-[#E2DEEC] rounded-lg">
          <Mail className="w-4 h-4 text-[#A69DC0]" />
          <span className="text-sm text-[#403770]">
            {stepExecution.contact.name}
          </span>
          {stepExecution.contact.email ? (
            <span className="text-sm text-[#8A80A8]">
              &lt;{stepExecution.contact.email}&gt;
            </span>
          ) : (
            <span className="text-sm text-[#F37167]">No email address</span>
          )}
        </div>
      </div>

      {/* Subject field */}
      <div>
        <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1.5">
          Subject
        </label>
        <input
          type="text"
          value={subject}
          onChange={(e) => setSubject(e.target.value)}
          placeholder="Email subject..."
          className={`w-full px-3 py-2.5 text-sm text-[#403770] border rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] ${
            hasUnresolvedSubject
              ? "border-[#ffd98d] bg-[#fffaf1]"
              : "border-[#C2BBD4] bg-white"
          }`}
        />
        {hasUnresolvedSubject && (
          <p className="mt-1 text-xs text-[#8A80A8]">
            Subject contains unresolved merge fields
          </p>
        )}
      </div>

      {/* Body field */}
      <div className="flex-1">
        <label className="block text-xs font-semibold text-[#6B5F8A] uppercase tracking-wider mb-1.5">
          Body
        </label>
        <textarea
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Email body..."
          rows={12}
          className={`w-full px-3 py-2.5 text-sm text-[#403770] border rounded-lg placeholder:text-[#A69DC0] focus:outline-none focus:ring-2 focus:ring-[#F37167]/30 focus:border-[#F37167] resize-y ${
            hasUnresolvedBody
              ? "border-[#ffd98d] bg-[#fffaf1]"
              : "border-[#C2BBD4] bg-white"
          }`}
        />
        {hasUnresolvedBody && (
          <p className="mt-1 text-xs text-[#8A80A8]">
            Body contains unresolved merge fields —{" "}
            {highlightUnresolved(body).filter(
              (n) => typeof n !== "string"
            ).length}{" "}
            remaining
          </p>
        )}
      </div>

      {/* Warning banner */}
      {hasWarning && (
        <div className="flex items-center gap-2 px-3 py-2.5 bg-[#fffaf1] border border-[#ffd98d] rounded-lg">
          <span className="text-xs text-[#6B5F8A]">
            Unresolved merge fields will be sent as-is. You can edit them above
            or skip this contact.
          </span>
        </div>
      )}

      {/* Actions */}
      <div className="flex items-center justify-between pt-2">
        <button
          onClick={onSkip}
          disabled={isSending}
          className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-[#6B5F8A] hover:text-[#403770] hover:bg-[#EFEDF5] rounded-lg transition-colors disabled:opacity-50"
        >
          <SkipForward className="w-4 h-4" />
          Skip
        </button>
        <button
          onClick={handleSend}
          disabled={isSending || !stepExecution.contact.email}
          className="flex items-center gap-2 px-5 py-2.5 text-sm font-medium text-white bg-[#F37167] rounded-lg hover:bg-[#e05e54] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {isSending ? (
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
              Sending...
            </>
          ) : (
            <>
              <Send className="w-4 h-4" />
              Send &amp; Next
            </>
          )}
        </button>
      </div>
    </div>
  );
}
