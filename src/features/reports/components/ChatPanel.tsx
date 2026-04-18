"use client";

import { useEffect, useRef } from "react";
import type { ChatMessage as ChatMessageData } from "../lib/ui-types";
import { PulseDot } from "./ui/icons";
import ChatMessage from "./ChatMessage";
import ChatInput from "./ChatInput";

interface Props {
  messages: ChatMessageData[];
  sending: boolean;
  onSend: (text: string) => void;
}

export default function ChatPanel({ messages, sending, onSend }: Props) {
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, sending]);

  return (
    <aside className="flex h-full w-[380px] shrink-0 flex-col bg-white border-l border-[#E2DEEC] shadow-sm">
      <header className="flex items-center justify-between border-b border-[#E2DEEC] px-5 py-4">
        <div className="flex items-center gap-2">
          <PulseDot />
          <p className="text-[13px] font-semibold text-[#544A78]">
            Ask about your territory
          </p>
        </div>
        <button
          type="button"
          className="text-[14px] font-medium text-[#A69DC0]"
          aria-label="Collapse chat panel"
        >
          ⌄
        </button>
      </header>

      <div
        ref={scrollRef}
        className="flex flex-1 flex-col gap-3.5 overflow-y-auto px-4 py-5"
      >
        {messages.length === 0 && (
          <div className="max-w-[300px] rounded-2xl bg-[#fdf4f2] px-4 py-3.5 text-[13px] text-[#544A78]">
            Hi — what do you want to know about your territory? Ask a question
            or describe what you&rsquo;re looking for.
          </div>
        )}
        {messages.map((m) => (
          <ChatMessage key={m.id} message={m} />
        ))}
        {sending && (
          <div className="flex w-full">
            <div className="inline-flex items-center gap-1.5 rounded-2xl bg-[#F7F5FA] px-3.5 py-3">
              <span className="size-[6px] rounded-full bg-[#A69DC0] animate-bounce [animation-delay:-0.3s]" />
              <span className="size-[6px] rounded-full bg-[#A69DC0] animate-bounce [animation-delay:-0.15s]" />
              <span className="size-[6px] rounded-full bg-[#A69DC0] animate-bounce" />
              <span className="ml-1 text-xs font-medium text-[#6E6390]">
                Updating chips…
              </span>
            </div>
          </div>
        )}
      </div>

      <ChatInput disabled={sending} onSend={onSend} />
    </aside>
  );
}
