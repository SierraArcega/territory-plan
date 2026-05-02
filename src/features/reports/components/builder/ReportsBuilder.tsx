"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuerySummary } from "../../lib/agent/types";
import { useChatTurn } from "../../hooks/useChatTurn";
import { useRunSavedReport } from "../../hooks/useSavedReports";
import { BuilderChat } from "./BuilderChat";
import { ResultsPane } from "./ResultsPane";
import type { BuilderTurn, BuilderVersion } from "./types";

interface Props {
  /** When set, on mount the builder reruns the saved report's stored SQL and
   *  seeds the rail with v1 (zero Claude tokens). */
  reportId: number | null;
  /** When set, the builder auto-submits this prompt as the first turn. */
  initialPrompt: string | null;
  /** Selected version index from URL ?v=. Falls back to the latest version. */
  selectedVersionN: number | null;
  onSelectVersion: (n: number) => void;
  onNewReport: () => void;
  onCollapseChat: () => void;
}

interface Result {
  sql: string;
  summary: QuerySummary;
  columns: string[];
  rows: Array<Record<string, unknown>>;
  rowCount: number;
  executionTimeMs: number;
}

export function ReportsBuilder({
  reportId,
  initialPrompt,
  selectedVersionN,
  onSelectVersion,
  onNewReport,
  onCollapseChat,
}: Props) {
  const [turns, setTurns] = useState<BuilderTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [savedReportTitle, setSavedReportTitle] = useState<string | null>(null);
  // True for the lifetime of a session that started from a saved report,
  // even after the user adds refining turns. Used by ResultsPane to show
  // "From saved report · refined".
  const fromSavedReportRef = useRef(false);

  const chatTurn = useChatTurn();
  const runSaved = useRunSavedReport();

  const versions = useMemo<BuilderVersion[]>(
    () => turns.flatMap((t) => (t.version ? [t.version] : [])),
    [turns],
  );

  const inFlight = chatTurn.isPending || runSaved.isPending;

  // Resolve the selected version. Falls back to the latest if the URL ?v= is
  // out of range or missing.
  const selectedVersion = useMemo<BuilderVersion | null>(() => {
    if (versions.length === 0) return null;
    if (selectedVersionN != null) {
      const v = versions.find((x) => x.n === selectedVersionN);
      if (v) return v;
    }
    return versions[versions.length - 1];
  }, [versions, selectedVersionN]);

  const appendTurnFromResult = useCallback(
    (userMessage: string, assistantText: string | null, result: Result | null) => {
      setTurns((prev) => {
        const versionN = prev.filter((t) => t.version != null).length + 1;
        const version: BuilderVersion | null = result
          ? {
              n: versionN,
              summary: result.summary,
              columns: result.columns,
              rows: result.rows,
              rowCount: result.rowCount,
              sql: result.sql,
              executionTimeMs: result.executionTimeMs,
              createdAt: Date.now(),
            }
          : null;
        return [
          ...prev,
          {
            id: `turn-${prev.length + 1}`,
            userMessage,
            assistantText,
            version,
            inFlight: false,
            error: null,
          },
        ];
      });
    },
    [],
  );

  const submit = useCallback(
    (message: string) => {
      // Optimistically add an in-flight turn. Replaced on completion.
      const optimisticId = `turn-pending-${Date.now()}`;
      setTurns((prev) => [
        ...prev,
        {
          id: optimisticId,
          userMessage: message,
          assistantText: null,
          version: null,
          inFlight: true,
          error: null,
        },
      ]);

      chatTurn.mutate(
        { message, conversationId },
        {
          onSuccess: (data) => {
            setConversationId(data.conversationId);
            setTurns((prev) => {
              const filtered = prev.filter((t) => t.id !== optimisticId);
              const versionN = filtered.filter((t) => t.version != null).length + 1;
              const version: BuilderVersion | null = data.result
                ? {
                    n: versionN,
                    summary: data.result.summary,
                    columns: data.result.columns,
                    rows: data.result.rows,
                    rowCount: data.result.rowCount,
                    sql: data.result.sql,
                    executionTimeMs: data.result.executionTimeMs,
                    createdAt: Date.now(),
                  }
                : null;
              const next: BuilderTurn = {
                id: optimisticId,
                userMessage: message,
                assistantText: data.assistantText,
                version,
                inFlight: false,
                error: null,
              };
              if (version) onSelectVersion(version.n);
              return [...filtered, next];
            });
          },
          onError: (err) => {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === optimisticId ? { ...t, inFlight: false, error: err.message } : t,
              ),
            );
          },
        },
      );
    },
    [chatTurn, conversationId, onSelectVersion],
  );

  // Mount: load saved report (if requested) or auto-submit initial prompt.
  // The autoSubmittedRef gate prevents double-firing in StrictMode and across
  // re-renders triggered by URL state changes.
  const autoSubmittedRef = useRef(false);
  useEffect(() => {
    if (autoSubmittedRef.current) return;
    if (reportId != null) {
      autoSubmittedRef.current = true;
      fromSavedReportRef.current = true;
      runSaved.mutate(reportId, {
        onSuccess: (data) => {
          // Saved report rerun bypasses the agent loop, so there's no
          // assistant text and no conversationId — empty chat with a v1.
          appendTurnFromResult("", null, data);
          // Selected version is the new v1.
          onSelectVersion(1);
        },
      });
      // Try to fetch the saved report's title for the chat header.
      fetch(`/api/reports/${reportId}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((j) => {
          if (j?.report?.title) setSavedReportTitle(j.report.title);
        })
        .catch(() => {});
      return;
    }
    if (initialPrompt) {
      autoSubmittedRef.current = true;
      submit(initialPrompt);
    }
  }, [reportId, initialPrompt, runSaved, appendTurnFromResult, submit, onSelectVersion]);

  const headerTitle = useMemo(() => {
    if (savedReportTitle) return savedReportTitle;
    const last = versions.at(-1);
    if (last) return last.summary.source;
    return "New report";
  }, [savedReportTitle, versions]);

  const hasRefinements = fromSavedReportRef.current && versions.length > 1;

  return (
    <div className="flex h-full min-h-0 bg-[#FFFCFA]">
      <BuilderChat
        title={headerTitle}
        turns={turns}
        versions={versions}
        selectedN={selectedVersion?.n ?? null}
        inFlight={inFlight}
        onSelectVersion={onSelectVersion}
        onSubmit={submit}
        onNewReport={onNewReport}
        onCollapseChat={onCollapseChat}
      />
      <ResultsPane
        version={selectedVersion}
        isFromSavedReport={fromSavedReportRef.current}
        hasRefinements={hasRefinements}
      />
    </div>
  );
}
