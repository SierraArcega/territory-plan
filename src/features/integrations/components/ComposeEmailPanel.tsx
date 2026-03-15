"use client";

// ComposeEmailPanel — Slide-out panel for composing and sending emails via Gmail
// Pre-fills the To field with the contact's email. Creates an Activity on send.

import { useState, useEffect, useRef } from "react";
import { useSendEmail } from "../lib/queries";

interface ComposeEmailPanelProps {
  to: string;
  contactName: string | null;
  contactId: number;
  districtLeaid: string;
  onClose: () => void;
}

export default function ComposeEmailPanel({
  to,
  contactName,
  contactId,
  districtLeaid,
  onClose,
}: ComposeEmailPanelProps) {
  const [subject, setSubject] = useState("");
  const [body, setBody] = useState("");
  const subjectRef = useRef<HTMLInputElement>(null);
  const sendEmail = useSendEmail();

  // Focus subject on mount
  useEffect(() => {
    subjectRef.current?.focus();
  }, []);

  // Close on Escape
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!subject.trim() || !body.trim()) return;

    try {
      await sendEmail.mutateAsync({
        to,
        subject: subject.trim(),
        body: body.trim(),
        districtLeaid,
        contactId,
      });
      onClose();
    } catch {
      // Error captured by mutation state
    }
  };

  const canSend = subject.trim().length > 0 && body.trim().length > 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />

      {/* Panel */}
      <div className="relative bg-white rounded-xl shadow-2xl w-full max-w-lg mx-4 overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-gray-100 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div
              className="w-8 h-8 rounded-full flex items-center justify-center text-white text-xs font-bold"
              style={{ backgroundColor: "#EA4335" }}
            >
              G
            </div>
            <h2 className="text-lg font-semibold text-[#403770]">Send Email</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 rounded-full hover:bg-gray-100 text-gray-400 hover:text-gray-600 transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSend}>
          <div className="px-6 py-4 space-y-4">
            {/* To field (read-only) */}
            <div>
              <label className="block text-xs font-medium text-gray-500 mb-1">To</label>
              <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-700">
                {contactName ? `${contactName} <${to}>` : to}
              </div>
            </div>

            {/* Subject */}
            <div>
              <label htmlFor="email-subject" className="block text-xs font-medium text-gray-500 mb-1">
                Subject
              </label>
              <input
                ref={subjectRef}
                id="email-subject"
                type="text"
                value={subject}
                onChange={(e) => setSubject(e.target.value)}
                placeholder="Email subject"
                disabled={sendEmail.isPending}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
              />
            </div>

            {/* Body */}
            <div>
              <label htmlFor="email-body" className="block text-xs font-medium text-gray-500 mb-1">
                Message
              </label>
              <textarea
                id="email-body"
                value={body}
                onChange={(e) => setBody(e.target.value)}
                placeholder="Write your message..."
                rows={8}
                disabled={sendEmail.isPending}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
              />
            </div>

            {sendEmail.isError && (
              <p className="text-sm text-red-600">
                {(sendEmail.error as Error)?.message || "Failed to send email. Please try again."}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sendEmail.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSend || sendEmail.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {sendEmail.isPending && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              )}
              {sendEmail.isPending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
