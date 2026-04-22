"use client";

import { useCallback, useMemo, useState } from "react";
import { useChatTurn } from "../hooks/useChatTurn";
import { useChipEdit } from "../hooks/useChipEdit";
import { useCreateSavedReport, useRunSavedReport } from "../hooks/useSavedReports";
import type { ChipEditAction, QuerySummary } from "../lib/agent/types";
import { ChatPanel } from "./ChatPanel";
import { ChipSummaryPanel } from "./ChipSummaryPanel";
import { ResultsTable } from "./ResultsTable";
import { SavedReportsSidebar } from "./SavedReportsSidebar";

interface DisplayMessage { role: "user" | "assistant" | "error"; content: string }

interface Current {
  summary: QuerySummary;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  sql: string; // kept in state, never rendered to DOM
}

export function ReportsView() {
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [messages, setMessages] = useState<DisplayMessage[]>([]);
  const [current, setCurrent] = useState<Current | null>(null);
  const [pendingQuestion, setPendingQuestion] = useState<string>("");

  const chatTurn = useChatTurn();
  const chipEdit = useChipEdit();
  const createReport = useCreateSavedReport();
  const runSaved = useRunSavedReport();

  const isLoading = chatTurn.isPending || chipEdit.isPending || runSaved.isPending;

  const handleSend = useCallback(
    (message: string) => {
      setMessages((m) => [...m, { role: "user", content: message }]);
      setPendingQuestion(message);
      chatTurn.mutate(
        { message, conversationId },
        {
          onSuccess: (data) => {
            setConversationId(data.conversationId);
            if (data.assistantText) {
              setMessages((m) => [...m, { role: "assistant", content: data.assistantText }]);
            }
            if (data.result) {
              setCurrent({
                summary: data.result.summary,
                columns: data.result.columns,
                rows: data.result.rows,
                sql: data.result.sql,
              });
            }
          },
          onError: (err) => {
            setMessages((m) => [...m, { role: "error", content: err.message }]);
          },
        },
      );
    },
    [chatTurn, conversationId],
  );

  const handleEdit = useCallback(
    (action: ChipEditAction) => {
      if (!conversationId) return;
      chipEdit.mutate(
        { action, conversationId },
        {
          onSuccess: (data) => {
            if (data.assistantText) {
              setMessages((m) => [...m, { role: "assistant", content: data.assistantText }]);
            }
            if (data.result) {
              setCurrent({
                summary: data.result.summary,
                columns: data.result.columns,
                rows: data.result.rows,
                sql: data.result.sql,
              });
            }
          },
          onError: (err) => {
            setMessages((m) => [...m, { role: "error", content: err.message }]);
          },
        },
      );
    },
    [chipEdit, conversationId],
  );

  const handleSave = useCallback(() => {
    if (!current) return;
    const title = window.prompt("Name this report:", current.summary.source);
    if (!title) return;
    createReport.mutate({
      title,
      question: pendingQuestion || current.summary.source,
      sql: current.sql,
      summary: current.summary,
      conversationId,
    });
  }, [current, pendingQuestion, conversationId, createReport]);

  const handleLoadReport = useCallback(
    (id: number) => {
      runSaved.mutate(id, {
        onSuccess: (data) => {
          setCurrent({
            summary: data.summary,
            columns: data.columns,
            rows: data.rows,
            sql: "",
          });
          setMessages([]);
          setConversationId(undefined);
        },
      });
    },
    [runSaved],
  );

  const chatMessages = useMemo(() => messages, [messages]);

  return (
    <div className="flex h-full gap-4 p-4">
      <div className="w-64">
        <SavedReportsSidebar onLoad={handleLoadReport} />
      </div>
      <div className="flex flex-1 gap-4">
        <div className="w-[380px]">
          <ChatPanel messages={chatMessages} onSend={handleSend} isLoading={isLoading} />
        </div>
        <div className="flex flex-1 flex-col gap-4">
          {current && (
            <ChipSummaryPanel
              summary={current.summary}
              onEdit={handleEdit}
              onSave={handleSave}
            />
          )}
          {current && (
            <div className="flex-1 overflow-hidden">
              <ResultsTable columns={current.columns} rows={current.rows} />
            </div>
          )}
          {!current && (
            <div className="flex flex-1 items-center justify-center rounded-xl border border-dashed border-[#D4CFE2] text-[#8A80A8]">
              Ask a question to get started.
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
