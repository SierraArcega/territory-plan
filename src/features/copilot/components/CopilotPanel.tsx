"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Sparkles,
  Send,
  X,
  Loader2,
  SquarePen,
  History,
} from "lucide-react";
import { useIsMobile } from "@/features/shared/hooks/useIsMobile";
import { useMapStore } from "@/features/shared/lib/app-store";
import { useMapV2Store } from "@/features/map/lib/store";
import { boundsForLeaids } from "@/features/map/lib/views-plan-bounds";
import { STATE_BBOX } from "@/features/map/lib/state-bbox";
import { extractDistrictLeaids, statesForLeaids } from "@/features/copilot/lib/plot-districts";
import { COPILOT_PANEL_WIDTH } from "../lib/constants";
import { CopilotLauncher } from "./CopilotLauncher";
import { AnswerBlock, type AnswerPayload } from "./AnswerBlock";
import { CopilotActivityLog } from "./CopilotActivityLog";
import { CopilotHomeState } from "./CopilotHomeState";
import { CopilotProgress } from "./CopilotProgress";
import { ProposedActionCard, type ActionStatus } from "./ProposedActionCard";
import { BatchActionCard } from "./BatchActionCard";
import { useCopilotTurnStream } from "../hooks/useCopilotTurnStream";
import { useCopilotPageContext } from "../hooks/useCopilotPageContext";
import { useExecuteCopilotAction } from "../hooks/useExecuteCopilotAction";
import { useCopilotNudges } from "../hooks/useCopilotNudges";
import { useCopilotConversations } from "../hooks/useCopilotConversations";
import { useProfile } from "@/features/shared/lib/queries";
import type {
  CopilotTurnResult,
  CopilotHistoryMessage,
  ProposedAction,
  TurnEvent,
} from "../lib/types";

const CONV_KEY = "copilot:conversationId";

interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  /** Muted footnote for replayed history (e.g. "returned a table earlier"). */
  note?: string;
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

export default function CopilotPanel() {
  const isMobile = useIsMobile();
  // Open state lives in the shared store so AppShell can reserve space for the
  // rail (split view); persisted there like sidebarCollapsed.
  const open = useMapStore((s) => s.copilotOpen);
  const setOpen = useMapStore((s) => s.setCopilotOpen);
  const setActiveTab = useMapStore((s) => s.setActiveTab);
  const focusDistricts = useMapV2Store((s) => s.focusDistricts);
  const [view, setView] = useState<"chat" | "log">("chat");
  const [input, setInput] = useState("");
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>(undefined);
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({});
  const [actionError, setActionError] = useState<Record<string, string>>({});

  const { data: profile } = useProfile();
  const firstName = profile?.fullName?.trim().split(/\s+/)[0] ?? null;
  const nudges = useCopilotNudges(open).data ?? [];
  const recent = useCopilotConversations(open).data ?? [];

  const stream = useCopilotTurnStream();
  const execute = useExecuteCopilotAction();
  const getPageContext = useCopilotPageContext();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages]);

  // Restore the last conversation id and replay its turns (read-only) on mount.
  useEffect(() => {
    let stored: string | null = null;
    try {
      stored = localStorage.getItem(CONV_KEY);
    } catch {
      // ignore
    }
    if (!stored) return;
    setConversationId(stored);
    let cancelled = false;
    fetch(`/api/copilot/history?conversationId=${encodeURIComponent(stored)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messages?: CopilotHistoryMessage[] } | null) => {
        if (cancelled || !data?.messages?.length) return;
        setMessages(
          data.messages.map((m) => ({ id: uid(), role: m.role, text: m.text, note: m.note })),
        );
      })
      .catch(() => {
        // best-effort — a missing history just starts an empty thread
      });
    return () => {
      cancelled = true;
    };
  }, []);

  // Persist the conversation id so the next mount can replay it.
  useEffect(() => {
    try {
      if (conversationId) localStorage.setItem(CONV_KEY, conversationId);
    } catch {
      // ignore
    }
  }, [conversationId]);

  const plotLeaids = useCallback((columns: string[], rows: Array<Record<string, unknown>>) => {
    const { leaids, truncated } = extractDistrictLeaids(columns, rows);
    if (leaids.length === 0) return { plotted: 0, truncated: false };
    focusDistricts(leaids, statesForLeaids(leaids), boundsForLeaids(leaids, STATE_BBOX));
    setActiveTab("map");
    return { plotted: leaids.length, truncated };
  }, [focusDistricts, setActiveTab]);

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

  const handleSend = useCallback((textOverride?: string) => {
    const text = (textOverride ?? input).trim();
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
          // If the answer carries district leaids, show them on the map.
          if (res.kind === "answer") {
            const { plotted, truncated } = plotLeaids(res.result.columns, res.result.rows);
            if (plotted > 0 && truncated) {
              setMessages((m) => [
                ...m,
                {
                  id: uid(),
                  role: "assistant",
                  text: `Showing the first ${plotted} of ${res.result.rowCount} on the map.`,
                },
              ]);
            }
          }
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
  }, [input, stream, conversationId, getPageContext, applyResult, plotLeaids]);

  const handleSeed = useCallback((prompt: string, autoSend: boolean) => {
    if (autoSend) {
      handleSend(prompt);
    } else {
      setInput(prompt);
    }
  }, [handleSend]);

  const handleResume = useCallback((id: string) => {
    setConversationId(id);
    fetch(`/api/copilot/history?conversationId=${encodeURIComponent(id)}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data: { messages?: CopilotHistoryMessage[] } | null) => {
        if (!data?.messages) return;
        setMessages(data.messages.map((m) => ({ id: uid(), role: m.role, text: m.text, note: m.note })));
      })
      .catch(() => {});
  }, []);

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

  const onConfirmMany = useCallback(async (selected: ProposedAction[]) => {
    for (const a of selected) await onConfirm(a);
  }, [onConfirm]);

  const onNewChat = useCallback(() => {
    setMessages([]);
    setConversationId(undefined);
    setActionStatus({});
    setActionError({});
    // Return to the chat view — "new chat" from the activity log should land
    // the rep in a fresh chat, not leave them staring at the (unchanged) log.
    setView("chat");
    try {
      localStorage.removeItem(CONV_KEY);
    } catch {
      // ignore
    }
  }, []);

  if (!open) {
    return <CopilotLauncher onOpen={() => setOpen(true)} />;
  }

  return (
    <aside
      className={`panel-v2-enter fixed z-50 flex flex-col bg-white shadow-lg ${
        isMobile ? "inset-0" : "right-0 top-0 h-dvh border-l border-[#E2DEEC]"
      }`}
      style={{ touchAction: "pan-y", ...(isMobile ? {} : { width: COPILOT_PANEL_WIDTH }) }}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b border-[#E2DEEC] bg-[#F7F5FA] px-4 py-3">
        <div className="flex items-center gap-2">
          <Sparkles className="h-5 w-5 text-[#403770]" />
          <span className="text-sm font-semibold text-[#403770] whitespace-nowrap">
            Copilot
          </span>
        </div>
        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setView((v) => (v === "chat" ? "log" : "chat"))}
            aria-label={view === "log" ? "Back to chat" : "Activity log"}
            aria-pressed={view === "log"}
            className={`rounded-lg p-1 transition-colors hover:bg-[#EFEDF5] ${
              view === "log" ? "text-[#403770]" : "text-[#6E6390]"
            }`}
          >
            <History className="h-5 w-5" />
          </button>
          <button
            type="button"
            onClick={onNewChat}
            aria-label="New chat"
            className="flex items-center gap-1 rounded-lg px-2 py-1 text-xs font-medium text-[#403770] transition-colors hover:bg-[#EFEDF5]"
          >
            <SquarePen className="h-4 w-4" aria-hidden="true" />
            <span className="whitespace-nowrap">New chat</span>
          </button>
          <button
            type="button"
            onClick={() => setOpen(false)}
            aria-label="Close Copilot"
            className="rounded-lg p-1 text-[#6E6390] transition-colors hover:bg-[#EFEDF5]"
          >
            <X className="h-5 w-5" />
          </button>
        </div>
      </div>

      {view === "log" ? (
        <div className="flex-1 overflow-y-auto">
          <CopilotActivityLog />
        </div>
      ) : (
        <>
      {/* Messages */}
      <div
        ref={scrollRef}
        className="flex-1 space-y-3 overflow-y-auto px-4 py-4"
      >
        {messages.length === 0 && (
          <CopilotHomeState
            firstName={firstName}
            nudges={nudges}
            recent={recent}
            onSeed={handleSeed}
            onResume={handleResume}
          />
        )}
        {messages.map((msg) => (
          <MessageBlock
            key={msg.id}
            msg={msg}
            actionStatus={actionStatus}
            actionError={actionError}
            onConfirm={onConfirm}
            onDismiss={onDismiss}
            onConfirmMany={onConfirmMany}
            onViewOnMap={(a) => plotLeaids(a.columns, a.rows)}
          />
        ))}
      </div>

      {/* Composer */}
      <div
        className="border-t border-[#E2DEEC] p-3"
        style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
      >
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
            className="min-h-[44px] flex-1 resize-none rounded-lg border border-[#E2DEEC] bg-[#FFFCFA] px-3 py-2 text-sm text-[#403770] outline-none focus:border-[#403770]"
          />
          <button
            type="button"
            onClick={() => handleSend()}
            disabled={!input.trim() || stream.isPending}
            aria-label="Send"
            className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg bg-[#403770] text-white transition-colors hover:bg-[#322a5a] disabled:opacity-40"
          >
            {stream.isPending ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </button>
        </div>
      </div>
        </>
      )}
    </aside>
  );
}

function MessageBlock({
  msg,
  actionStatus,
  actionError,
  onConfirm,
  onDismiss,
  onConfirmMany,
  onViewOnMap,
}: {
  msg: ChatMessage;
  actionStatus: Record<string, ActionStatus>;
  actionError: Record<string, string>;
  onConfirm: (a: ProposedAction) => void;
  onDismiss: (id: string) => void;
  onConfirmMany: (selected: ProposedAction[]) => void;
  onViewOnMap?: (answer: AnswerPayload) => void;
}) {
  if (msg.role === "user") {
    return (
      <div className="panel-content-enter flex justify-end">
        <div className="max-w-[85%] rounded-2xl rounded-br-sm bg-[#403770] px-3 py-2 text-sm text-white whitespace-pre-wrap">
          {msg.text}
        </div>
      </div>
    );
  }

  return (
    <div className="panel-content-enter space-y-2">
      {msg.streaming && !msg.text ? (
        <CopilotProgress events={msg.events} />
      ) : (
        msg.text && (
          <div
            className={`max-w-[90%] rounded-2xl rounded-bl-sm px-3 py-2 text-sm whitespace-pre-wrap ${
              msg.error
                ? "bg-[#FFE0DC] text-[#A8281C]"
                : "bg-[#EFEDF5] text-[#403770]"
            }`}
          >
            {msg.text}
          </div>
        )
      )}

      {msg.note && <p className="text-xs italic text-[#8A80A8]">{msg.note}</p>}

      {msg.answer && (
        <AnswerBlock answer={msg.answer} onViewOnMap={() => onViewOnMap?.(msg.answer!)} />
      )}

      {msg.proposedActions && msg.proposedActions.length > 0 && (
        (() => {
          const groups = new Map<string, ProposedAction[]>();
          for (const a of msg.proposedActions) {
            const key = `${a.objectType}.${a.operation}`;
            groups.set(key, [...(groups.get(key) ?? []), a]);
          }
          return [...groups.values()].map((group, gi) =>
            group.length === 1 ? (
              <ProposedActionCard
                key={group[0]!.id}
                action={group[0]!}
                status={actionStatus[group[0]!.id] ?? "idle"}
                error={actionError[group[0]!.id]}
                onConfirm={onConfirm}
                onDismiss={onDismiss}
              />
            ) : (
              <BatchActionCard
                key={`batch-${gi}`}
                actions={group}
                statusById={actionStatus}
                onConfirmMany={onConfirmMany}
                onDismissAll={() => group.forEach((a) => onDismiss(a.id))}
              />
            ),
          );
        })()
      )}
    </div>
  );
}
