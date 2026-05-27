"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  X,
  Check,
  Loader2,
  Ban,
  AlertTriangle,
} from "lucide-react";
import { useIsMobile } from "@/features/shared/hooks/useIsMobile";
import { useCopilotTurnStream } from "../hooks/useCopilotTurnStream";
import { useCopilotPageContext } from "../hooks/useCopilotPageContext";
import { useExecuteCopilotAction } from "../hooks/useExecuteCopilotAction";
import type {
  CopilotTurnResult,
  ProposedAction,
  TurnEvent,
} from "../lib/types";

const STORAGE_KEY = "copilot:open";

type ActionStatus = "idle" | "pending" | "confirmed" | "dismissed" | "error";

interface AnswerPayload {
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
}

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  proposedActions?: ProposedAction[];
  answer?: AnswerPayload;
  events?: TurnEvent[];
  streaming?: boolean;
  error?: boolean;
}

const uid = (): string =>
  typeof globalThis.crypto?.randomUUID === "function"
    ? globalThis.crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

function latestToolLabel(events: TurnEvent[] | undefined): string {
  if (!events || events.length === 0) return "Thinking…";
  for (let i = events.length - 1; i >= 0; i--) {
    const e = events[i];
    if (e.kind === "model_call" && e.toolUses.length > 0) {
      return `Running ${e.toolUses[e.toolUses.length - 1]!.name}…`;
    }
  }
  return "Thinking…";
}

export default function CopilotPanel() {
  const isMobile = useIsMobile();
  const [open, setOpen] = useState(false);
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const stream = useCopilotTurnStream();
  const execute = useExecuteCopilotAction();
  const getPageContext = useCopilotPageContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  // Persist open/closed like the sidebar (self-contained — no AppShell props).
  useEffect(() => {
    try {
      setOpen(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      // ignore
    }
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, open ? "1" : "0");
    } catch {
      // ignore
    }
  }, [open]);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  const applyResult = useCallback(
    (prev: ChatMessage, res: CopilotTurnResult): ChatMessage => {
      if (res.kind === "answer") {
        return {
          ...prev,
          streaming: false,
          text: res.assistantText,
          answer: {
            columns: res.result.columns,
            rows: res.result.rows.slice(0, 50),
            rowCount: res.result.rowCount,
          },
        };
      }
      if (res.kind === "actions") {
        return {
          ...prev,
          streaming: false,
          text: res.assistantText,
          proposedActions: res.proposedActions,
        };
      }
      return { ...prev, streaming: false, text: res.assistantText };
    },
    [],
  );

  const handleSend = useCallback(() => {
    const text = input.trim();
    if (!text || stream.isPending) return;
    const assistantId = uid();
    setMessages((m) => [
      ...m,
      { id: uid(), role: "user", text },
      { id: assistantId, role: "assistant", text: "", streaming: true, events: [] },
    ]);
    setInput("");
    stream.submit(
      { message: text, conversationId, pageContext: getPageContext() },
      {
        onEvent: (e) =>
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, events: [...(msg.events ?? []), e] }
                : msg,
            ),
          ),
        onComplete: (res) => {
          setConversationId(res.conversationId);
          setMessages((m) =>
            m.map((msg) => (msg.id === assistantId ? applyResult(msg, res) : msg)),
          );
        },
        onError: (err) =>
          setMessages((m) =>
            m.map((msg) =>
              msg.id === assistantId
                ? { ...msg, text: err.message, streaming: false, error: true }
                : msg,
            ),
          ),
      },
    );
  }, [input, stream, conversationId, getPageContext, applyResult]);

  const onConfirm = useCallback(
    async (action: ProposedAction) => {
      setActionStatus((s) => ({ ...s, [action.id]: "pending" }));
      try {
        await execute.mutateAsync({ action, conversationId });
        setActionStatus((s) => ({ ...s, [action.id]: "confirmed" }));
        setMessages((m) => [
          ...m,
          { id: uid(), role: "assistant", text: `✓ ${action.preview.title} — done.` },
        ]);
      } catch (e) {
        setActionStatus((s) => ({ ...s, [action.id]: "error" }));
        setActionError((s) => ({
          ...s,
          [action.id]: e instanceof Error ? e.message : "Failed",
        }));
      }
    },
    [execute, conversationId],
  );

  const onDismiss = useCallback((actionId: string) => {
    setActionStatus((s) => ({ ...s, [actionId]: "dismissed" }));
  }, []);

  const greeting = useMemo(
    () => "Ask about your data, or tell me what to create or update.",
    [],
  );

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Open Copilot"
        className="fixed bottom-5 right-5 z-40 flex items-center gap-2 rounded-full bg-[#5B4B8A] px-4 py-3 text-white shadow-lg transition-colors hover:bg-[#4A3D73]"
      >
        <Sparkles className="h-5 w-5" />
        <span className="text-sm font-medium whitespace-nowrap">Copilot</span>
      </button>
    );
  }

  return (
    <aside
      className={`fixed z-40 flex flex-col bg-white shadow-2xl ${
        isMobile ? "inset-0" : "right-0 top-0 h-dvh w-[380px] border-l border-[#EFEDF5]"
      }`}
      style={{ touchAction: "pan-y" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#EFEDF5] bg-[#F7F5FA] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#5B4B8A]" />
          <span className="text-sm font-semibold text-[#2E2A3A] whitespace-nowrap">
            Copilot
          </span>
        </div>
        <button
          type="button"
          onClick={() => setOpen(false)}
          aria-label="Close Copilot"
          className="rounded-md p-1 text-[#6E6390] transition-colors hover:bg-[#EFEDF5]"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <p className="text-sm text-[#6E6390]">{greeting}</p>
        )}
        {messages.map((msg) => (
          <MessageBlock
            key={msg.id}
            msg={msg}
            actionStatus={actionStatus}
            actionError={actionError}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
          />
        ))}
      </div>

      {/* Composer */}
      <div className="border-t border-[#EFEDF5] p-3">
        <div className="flex items-end gap-2">
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && !e.shiftKey) {
                e.preventDefault();
                handleSend();
              }
            }}
            rows={2}
            placeholder="Message Copilot…"
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-[#EFEDF5] bg-[#FFFCFA] px-3 py-2 text-sm text-[#2E2A3A] outline-none focus:border-[#5B4B8A]"
          />
          <button
            type="button"
            onClick={handleSend}
            disabled={!input.trim() || stream.isPending}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#5B4B8A] text-white transition-colors hover:bg-[#4A3D73] disabled:opacity-40"
          >
            {stream.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
    </aside>
  );
}

function MessageBlock({
  msg,
  actionStatus,
  actionError,
  onConfirm,
  onDismiss,
}: {
  msg: ChatMessage;
  actionStatus: Record<string, ActionStatus>;
  actionError: Record<string, string>;
  onConfirm: (a: ProposedAction) => void;
  onDismiss: (id: string) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#5B4B8A] px-3 py-2 text-sm text-white whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-2">
      {msg.streaming && !msg.text ? (
        <div className="flex items-center gap-2 text-sm text-[#6E6390]">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>{latestToolLabel(msg.events)}</span>
        </div>
      ) : (
        msg.text && (
          <div
            className={`max-w-[90%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm whitespace-pre-wrap ${
              msg.error
                ? "bg-[#FFE0DC] text-[#A8281C]"
                : "bg-[#EFEDF5] text-[#2E2A3A]"
            }`}
          >
            {msg.text}
          </div>
        )
      )}

      {msg.answer && <AnswerTable answer={msg.answer} />}

      {msg.proposedActions?.map((action) => (
        <ProposedActionCard
          key={action.id}
          action={action}
          status={actionStatus[action.id] ?? "idle"}
          error={actionError[action.id]}
          onConfirm={onConfirm}
          onDismiss={onDismiss}
        />
      ))}
    </div>
  );
}

function AnswerTable({ answer }: { answer: AnswerPayload }) {
  if (answer.columns.length === 0) {
    return (
      <p className="text-sm text-[#6E6390]">No rows.</p>
    );
  }
  return (
    <div className="overflow-x-auto rounded-lg border border-[#EFEDF5]">
      <table className="w-full border-collapse text-xs">
        <thead>
          <tr className="bg-[#F7F5FA]">
            {answer.columns.map((c) => (
              <th
                key={c}
                className="px-2 py-1 text-left font-semibold text-[#6E6390] whitespace-nowrap"
              >
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {answer.rows.map((row, i) => (
            <tr key={i} className="border-t border-[#EFEDF5]">
              {answer.columns.map((c) => (
                <td key={c} className="px-2 py-1 text-[#2E2A3A] whitespace-nowrap">
                  {row[c] == null ? "" : String(row[c])}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      {answer.rowCount > answer.rows.length && (
        <p className="px-2 py-1 text-[11px] text-[#6E6390]">
          Showing {answer.rows.length} of {answer.rowCount} rows.
        </p>
      )}
    </div>
  );
}

function ProposedActionCard({
  action,
  status,
  error,
  onConfirm,
  onDismiss,
}: {
  action: ProposedAction;
  status: ActionStatus;
  error?: string;
  onConfirm: (a: ProposedAction) => void;
  onDismiss: (id: string) => void;
}) {
  const settled = status === "confirmed" || status === "dismissed";
  return (
    <div className="rounded-lg border border-[#EFEDF5] bg-white p-3 shadow-sm">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold uppercase tracking-wide text-[#6E6390] whitespace-nowrap">
          {action.preview.title}
        </span>
        {status === "confirmed" && (
          <span className="flex items-center gap-1 text-xs text-[#1F7A3F] whitespace-nowrap">
            <Check className="h-3.5 w-3.5" /> Done
          </span>
        )}
        {status === "dismissed" && (
          <span className="flex items-center gap-1 text-xs text-[#6E6390] whitespace-nowrap">
            <Ban className="h-3.5 w-3.5" /> Dismissed
          </span>
        )}
      </div>

      <p className="mt-1 text-sm font-medium text-[#2E2A3A]">{action.preview.summary}</p>

      {action.preview.rows.length > 0 && (
        <dl className="mt-2 space-y-1">
          {action.preview.rows.map((r, i) => (
            <div key={i} className="flex gap-2 text-xs">
              <dt className="shrink-0 text-[#6E6390] whitespace-nowrap">{r.label}</dt>
              <dd className="text-[#2E2A3A] break-words">{r.value}</dd>
            </div>
          ))}
        </dl>
      )}

      {status === "error" && (
        <p className="mt-2 flex items-center gap-1 text-xs text-[#A8281C]">
          <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          {error ?? "Something went wrong."}
        </p>
      )}

      {!settled && (
        <div className="mt-3 flex gap-2">
          <button
            type="button"
            onClick={() => onConfirm(action)}
            disabled={status === "pending"}
            className="flex flex-1 items-center justify-center gap-1 rounded-md bg-[#5B4B8A] px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-[#4A3D73] disabled:opacity-50"
          >
            {status === "pending" ? (
              <Loader2 className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <Check className="h-3.5 w-3.5" />
            )}
            Confirm
          </button>
          <button
            type="button"
            onClick={() => onDismiss(action.id)}
            disabled={status === "pending"}
            className="flex-1 rounded-md border border-[#EFEDF5] px-3 py-1.5 text-xs font-medium text-[#6E6390] transition-colors hover:bg-[#F7F5FA] disabled:opacity-50"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
