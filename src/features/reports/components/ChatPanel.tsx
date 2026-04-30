"use client";

import { useState } from "react";
import { Send } from "lucide-react";

interface ChatMessage {
  role: "user" | "assistant" | "error";
  content: string;
}

interface Props {
  messages: ChatMessage[];
  onSend: (message: string) => void;
  isLoading: boolean;
}

export function ChatPanel({ messages, onSend, isLoading }: Props) {
  const [draft, setDraft] = useState("");

  return (
    <section className="flex h-full flex-col rounded-xl border border-[#D4CFE2] bg-white">
      <div className="flex-1 space-y-3 overflow-y-auto p-4">
        {messages.length === 0 && !isLoading && (
          <p className="text-sm text-[#8A80A8]">
            Ask a question about your pipeline, districts, or activities.
          </p>
        )}
        {messages.map((m, i) => (
          <MessageBubble key={i} message={m} />
        ))}
        {isLoading && (
          <div className="flex items-center gap-2 text-sm text-[#8A80A8]">
            <span className="inline-block h-2 w-2 animate-pulse rounded-full bg-[#403770]" />
            Thinking…
          </div>
        )}
      </div>

      <form
        onSubmit={(e) => {
          e.preventDefault();
          const v = draft.trim();
          if (!v || isLoading) return;
          onSend(v);
          setDraft("");
        }}
        className="flex items-center gap-2 border-t border-[#E2DEEC] p-3"
      >
        <input
          type="text"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Ask a question…"
          className="flex-1 rounded-lg border border-[#C2BBD4] bg-[#F7F5FA] px-3 py-2 text-sm text-[#403770] placeholder:text-[#A69DC0] focus:border-[#403770] focus:outline-none"
          disabled={isLoading}
        />
        <button
          type="submit"
          aria-label="Send"
          disabled={!draft.trim() || isLoading}
          className="rounded-lg bg-[#403770] p-2 text-white hover:bg-[#322a5a] disabled:bg-[#EFEDF5] disabled:text-[#A69DC0]"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  const base = "max-w-[80%] rounded-xl px-3 py-2 text-sm whitespace-pre-wrap";
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className={`${base} bg-[#403770] text-white`}>{message.content}</div>
      </div>
    );
  }
  if (message.role === "error") {
    return (
      <div className="flex justify-start">
        <div className={`${base} border border-[#f58d85] bg-[#fef1f0] text-[#b44339]`}>
          {message.content}
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className={`${base} bg-[#F7F5FA] text-[#403770]`}>{message.content}</div>
    </div>
  );
}
