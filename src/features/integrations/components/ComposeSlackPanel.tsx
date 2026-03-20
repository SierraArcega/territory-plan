"use client";

// ComposeSlackPanel — Modal for sending a Slack message to a channel
// Includes a channel picker (fetched from the user's Slack workspace)

import { useState, useEffect, useRef } from "react";
import { useSendSlackMessage, useSlackChannels } from "../lib/queries";

interface ComposeSlackPanelProps {
  contactName: string | null;
  districtLeaid: string;
  onClose: () => void;
}

export default function ComposeSlackPanel({
  contactName,
  districtLeaid,
  onClose,
}: ComposeSlackPanelProps) {
  const [channelId, setChannelId] = useState("");
  const [message, setMessage] = useState("");
  const messageRef = useRef<HTMLTextAreaElement>(null);
  const sendSlack = useSendSlackMessage();
  const { data: channelData, isLoading: channelsLoading } = useSlackChannels();

  const channels = channelData?.channels || [];

  // Focus message area after channel is selected or on mount
  useEffect(() => {
    if (channelId) {
      messageRef.current?.focus();
    }
  }, [channelId]);

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
    if (!channelId || !message.trim()) return;

    try {
      await sendSlack.mutateAsync({
        channelId,
        message: message.trim(),
        districtLeaid,
      });
      onClose();
    } catch {
      // Error captured by mutation state
    }
  };

  const canSend = channelId.length > 0 && message.trim().length > 0;

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
              style={{ backgroundColor: "#4A154B" }}
            >
              S
            </div>
            <h2 className="text-lg font-semibold text-[#403770]">Send Slack Message</h2>
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
            {/* Context */}
            {contactName && (
              <p className="text-xs text-gray-500">
                Sending about <span className="font-medium text-[#403770]">{contactName}</span>
              </p>
            )}

            {/* Channel picker */}
            <div>
              <label htmlFor="slack-channel" className="block text-xs font-medium text-gray-500 mb-1">
                Channel
              </label>
              {channelsLoading ? (
                <div className="px-3 py-2 rounded-lg bg-gray-50 border border-gray-200 text-sm text-gray-400">
                  Loading channels...
                </div>
              ) : (
                <select
                  id="slack-channel"
                  value={channelId}
                  onChange={(e) => setChannelId(e.target.value)}
                  disabled={sendSlack.isPending}
                  className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50"
                >
                  <option value="">Select a channel</option>
                  {channels.map((ch) => (
                    <option key={ch.id} value={ch.id}>
                      #{ch.name}
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Message */}
            <div>
              <label htmlFor="slack-message" className="block text-xs font-medium text-gray-500 mb-1">
                Message
              </label>
              <textarea
                ref={messageRef}
                id="slack-message"
                value={message}
                onChange={(e) => setMessage(e.target.value)}
                placeholder="Write your message..."
                rows={6}
                disabled={sendSlack.isPending}
                className="w-full px-3 py-2 rounded-lg border border-gray-300 text-sm text-gray-900 placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-[#403770] focus:border-transparent disabled:opacity-50 disabled:bg-gray-50 resize-none"
              />
            </div>

            {sendSlack.isError && (
              <p className="text-sm text-red-600">
                {(sendSlack.error as Error)?.message || "Failed to send message. Please try again."}
              </p>
            )}
          </div>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-100 flex justify-end gap-3">
            <button
              type="button"
              onClick={onClose}
              disabled={sendSlack.isPending}
              className="px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors disabled:opacity-50"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={!canSend || sendSlack.isPending}
              className="px-4 py-2 text-sm font-medium text-white bg-[#403770] hover:bg-[#322a5a] rounded-lg transition-colors disabled:opacity-50 flex items-center gap-2"
            >
              {sendSlack.isPending && (
                <div className="animate-spin rounded-full h-4 w-4 border-2 border-white border-t-transparent" />
              )}
              {sendSlack.isPending ? "Sending..." : "Send"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
