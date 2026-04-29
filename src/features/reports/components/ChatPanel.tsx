"use client";

import { useState } from "react";
import { Send } from "lucide-react";
import ReactMarkdown, { type Components } from "react-markdown";
import remarkGfm from "remark-gfm";

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
    <section className="flex h-full flex-col rounded-lg border border-[#D4CFE2] bg-white shadow-sm">
      <div className="min-h-0 flex-1 space-y-3 overflow-y-auto p-4">
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
        className="flex shrink-0 items-center gap-2 border-t border-[#E2DEEC] p-3"
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
          className="rounded-lg bg-[#403770] p-2 text-white transition-colors duration-100 hover:bg-[#322a5a] disabled:bg-[#EFEDF5] disabled:text-[#A69DC0]"
        >
          <Send size={16} />
        </button>
      </form>
    </section>
  );
}

function MessageBubble({ message }: { message: ChatMessage }) {
  if (message.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] whitespace-pre-wrap rounded-xl bg-[#403770] px-3 py-2 text-sm text-white">
          {message.content}
        </div>
      </div>
    );
  }
  if (message.role === "error") {
    return (
      <div className="flex justify-start">
        <div className="max-w-[85%] rounded-xl border border-[#f58d85] bg-[#fef1f0] px-3 py-2 text-sm text-[#b44339]">
          <Markdown content={message.content} />
        </div>
      </div>
    );
  }
  return (
    <div className="flex justify-start">
      <div className="max-w-[85%] rounded-xl bg-[#F7F5FA] px-3 py-2 text-sm text-[#403770]">
        <Markdown content={message.content} />
      </div>
    </div>
  );
}

const markdownComponents: Components = {
  p: ({ children }) => <p className="my-1.5 first:mt-0 last:mb-0">{children}</p>,
  strong: ({ children }) => (
    <strong className="font-semibold text-[#322a5a]">{children}</strong>
  ),
  em: ({ children }) => <em className="italic">{children}</em>,
  ul: ({ children }) => (
    <ul className="my-1.5 list-disc space-y-1 pl-5 marker:text-[#8A80A8]">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="my-1.5 list-decimal space-y-1 pl-5 marker:text-[#8A80A8]">
      {children}
    </ol>
  ),
  li: ({ children }) => <li className="leading-snug">{children}</li>,
  code: ({ children }) => (
    <code className="rounded bg-[#EFEDF5] px-1 py-0.5 font-mono text-xs text-[#322a5a]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="my-2 overflow-x-auto rounded-lg bg-[#EFEDF5] p-2 font-mono text-xs text-[#322a5a]">
      {children}
    </pre>
  ),
  a: ({ children, href }) => (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-[#6EA3BE] underline transition-colors duration-100 hover:text-[#403770]"
    >
      {children}
    </a>
  ),
  h1: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-[#322a5a] first:mt-0">{children}</h3>
  ),
  h2: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-[#322a5a] first:mt-0">{children}</h3>
  ),
  h3: ({ children }) => (
    <h3 className="mb-1 mt-2 text-sm font-semibold text-[#322a5a] first:mt-0">{children}</h3>
  ),
  blockquote: ({ children }) => (
    <blockquote className="my-1.5 border-l-2 border-[#D4CFE2] pl-3 text-[#6E6390]">
      {children}
    </blockquote>
  ),
  hr: () => <hr className="my-3 border-[#E2DEEC]" />,
  table: ({ children }) => (
    <div className="my-2 overflow-x-auto">
      <table className="min-w-full text-xs">{children}</table>
    </div>
  ),
  thead: ({ children }) => <thead className="bg-[#F7F5FA]">{children}</thead>,
  th: ({ children }) => (
    <th className="border-b border-[#D4CFE2] px-2 py-1 text-left font-semibold text-[#544A78]">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b border-[#E2DEEC] px-2 py-1">{children}</td>
  ),
};

function Markdown({ content }: { content: string }) {
  return (
    <ReactMarkdown remarkPlugins={[remarkGfm]} components={markdownComponents}>
      {content}
    </ReactMarkdown>
  );
}
