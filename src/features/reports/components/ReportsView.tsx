"use client";

import { useCallback, useMemo, useState } from "react";
import { Code2, Download } from "lucide-react";
import { useChatTurn } from "../hooks/useChatTurn";
import { useCreateSavedReport, useRunSavedReport } from "../hooks/useSavedReports";
import { downloadCsv, rowsToCsv, slugifyForFilename } from "../lib/csv";
import type { QuerySummary } from "../lib/agent/types";
import { ChatPanel } from "./ChatPanel";
import { ResultsTable } from "./ResultsTable";
import { SavedReportsSidebar } from "./SavedReportsSidebar";
import { SqlPreviewModal } from "./SqlPreviewModal";

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
  const [sqlPreviewOpen, setSqlPreviewOpen] = useState(false);

  const chatTurn = useChatTurn();
  const createReport = useCreateSavedReport();
  const runSaved = useRunSavedReport();

  const isLoading = chatTurn.isPending || runSaved.isPending;

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

  const handleExportCsv = useCallback(() => {
    if (!current) return;
    const csv = rowsToCsv(current.columns, current.rows);
    const filename = slugifyForFilename(current.summary.source);
    downloadCsv(filename, csv);
  }, [current]);

  const handleLoadReport = useCallback(
    (id: number) => {
      runSaved.mutate(id, {
        onSuccess: (data) => {
          setCurrent({
            summary: data.summary,
            columns: data.columns,
            rows: data.rows,
            sql: data.sql,
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
    <div className="flex h-full min-h-0 gap-4 bg-[#FFFCFA] p-4">
      <div className="hidden h-full w-56 shrink-0 lg:block xl:w-64">
        <SavedReportsSidebar onLoad={handleLoadReport} />
      </div>
      <div className="flex h-full min-w-0 flex-1 gap-4">
        <div className="flex h-full w-72 shrink-0 flex-col xl:w-[380px]">
          <ChatPanel messages={chatMessages} onSend={handleSend} isLoading={isLoading} />
        </div>
        <div className="flex h-full min-w-0 flex-1 flex-col gap-4">
          {current && (
            <header className="flex shrink-0 flex-wrap items-start justify-between gap-4 rounded-lg border border-[#D4CFE2] bg-white p-5 shadow-sm">
              <h2 className="min-w-0 flex-1 text-base font-semibold text-[#403770]">
                {current.summary.source}
              </h2>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => setSqlPreviewOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-3 py-2 text-sm font-medium text-[#403770] transition-colors duration-100 hover:bg-[#F7F5FA]"
                >
                  <Code2 size={14} />
                  View SQL
                </button>
                <button
                  type="button"
                  onClick={handleExportCsv}
                  disabled={current.rows.length === 0}
                  className="inline-flex items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-3 py-2 text-sm font-medium text-[#403770] transition-colors duration-100 hover:bg-[#F7F5FA] disabled:cursor-not-allowed disabled:text-[#A69DC0]"
                >
                  <Download size={14} />
                  Export CSV
                </button>
                <button
                  type="button"
                  onClick={handleSave}
                  className="rounded-lg bg-[#403770] px-4 py-2 text-sm font-medium text-white transition-colors duration-100 hover:bg-[#322a5a]"
                >
                  Save as report
                </button>
              </div>
            </header>
          )}
          {current && (
            <div className="min-h-0 min-w-0 flex-1">
              <ResultsTable columns={current.columns} rows={current.rows} />
            </div>
          )}
          {!current && (
            <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-[#D4CFE2] text-sm text-[#8A80A8]">
              Ask a question to get started.
            </div>
          )}
        </div>
      </div>
      {sqlPreviewOpen && current?.sql && (
        <SqlPreviewModal
          sql={current.sql}
          source={current.summary.source}
          onClose={() => setSqlPreviewOpen(false)}
        />
      )}
    </div>
  );
}
