"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { QuerySummary, TurnEvent } from "../../lib/agent/types";
import { useChatTurnStream } from "../../hooks/useChatTurnStream";
import { useRunSavedReport } from "../../hooks/useSavedReports";
import {
  useCreateSavedReport,
  useDeleteReport,
  useUpdateReportDetails,
  useUpdateReportSql,
} from "../../lib/queries";
import { BuilderChat } from "./BuilderChat";
import { ResultsPane } from "./ResultsPane";
import type { SessionMode } from "./SaveButton";
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
  /** Called when a save creates a new SavedReport row — typically routes to
   *  ?report=<newId>&view=builder so the session continues with the saved
   *  context. */
  onAfterSaveNew?: (newReportId: number) => void;
  /** Called when the user deletes a loaded saved report; should navigate
   *  back to the library. */
  onAfterDelete?: () => void;
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
  onAfterSaveNew,
  onAfterDelete,
}: Props) {
  const [turns, setTurns] = useState<BuilderTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [savedReportTitle, setSavedReportTitle] = useState<string | null>(null);
  const [savedReportDescription, setSavedReportDescription] = useState<string>("");
  // True for the lifetime of a session that started from a saved report,
  // even after the user adds refining turns. Used by ResultsPane to show
  // "From saved report · refined".
  const fromSavedReportRef = useRef(false);

  const chatTurn = useChatTurnStream();
  const runSaved = useRunSavedReport();
  const createReport = useCreateSavedReport();
  const updateReportSql = useUpdateReportSql();
  const updateReportDetails = useUpdateReportDetails();
  const deleteReport = useDeleteReport();
  const saveBusy =
    createReport.isPending ||
    updateReportSql.isPending ||
    updateReportDetails.isPending ||
    deleteReport.isPending;

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
      const startedAt = Date.now();
      setTurns((prev) => [
        ...prev,
        {
          id: optimisticId,
          userMessage: message,
          assistantText: null,
          version: null,
          inFlight: true,
          error: null,
          events: [],
        },
      ]);

      chatTurn.submit(
        { message, conversationId },
        {
          onEvent: (event: TurnEvent) => {
            // Append to the in-flight turn's events array. We mutate via map
            // so React sees a fresh reference and the LiveTrace re-renders
            // each tick.
            setTurns((prev) =>
              prev.map((t) =>
                t.id === optimisticId
                  ? { ...t, events: [...(t.events ?? []), event] }
                  : t,
              ),
            );
          },
          onComplete: (data) => {
            setConversationId(data.conversationId);
            const durationMs = Date.now() - startedAt;
            setTurns((prev) => {
              // Pull the in-flight turn out and replace with the completed
              // one — preserve the events array for the collapsed-toggle
              // render on the assistant card.
              const inFlightTurn = prev.find((t) => t.id === optimisticId);
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
                events: inFlightTurn?.events ?? [],
                durationMs,
              };
              if (version) onSelectVersion(version.n);
              return [...filtered, next];
            });
          },
          onError: (err) => {
            setTurns((prev) =>
              prev.map((t) =>
                t.id === optimisticId
                  ? { ...t, inFlight: false, error: err.message }
                  : t,
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
          if (typeof j?.report?.description === "string")
            setSavedReportDescription(j.report.description);
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

  // Refined = loaded-from-saved AND user added at least one new (non-synthetic)
  // turn. Synthetic turns from the saved-report rerun have empty userMessage.
  const hasRefinements =
    fromSavedReportRef.current && turns.some((t) => t.userMessage.trim() !== "");

  const sessionMode: SessionMode = !fromSavedReportRef.current
    ? "fresh"
    : hasRefinements
      ? "loaded-refined"
      : "loaded-unmodified";

  const handleSaveNew = useCallback(
    (title: string, description: string) => {
      const v = selectedVersion;
      if (!v) return;
      const lastUserMessage = [...turns].reverse().find((t) => t.userMessage.trim())?.userMessage;
      createReport.mutate(
        {
          title,
          description: description || null,
          question: lastUserMessage ?? v.summary.source,
          sql: v.sql,
          summary: v.summary,
          conversationId,
        },
        {
          onSuccess: (data) => {
            if (data.report?.id != null) onAfterSaveNew?.(data.report.id);
          },
        },
      );
    },
    [selectedVersion, turns, conversationId, createReport, onAfterSaveNew],
  );

  const handleUpdateSavedReport = useCallback(() => {
    if (reportId == null) return;
    const v = selectedVersion;
    if (!v) return;
    const lastUserMessage = [...turns].reverse().find((t) => t.userMessage.trim())?.userMessage;
    updateReportSql.mutate({
      id: reportId,
      sql: v.sql,
      summary: v.summary,
      question: lastUserMessage ?? v.summary.source,
    });
  }, [reportId, selectedVersion, turns, updateReportSql]);

  const handleEditDetails = useCallback(
    (title: string, description: string) => {
      if (reportId == null) return;
      updateReportDetails.mutate(
        { id: reportId, title, description: description || null },
        {
          onSuccess: () => {
            setSavedReportTitle(title);
            setSavedReportDescription(description);
          },
        },
      );
    },
    [reportId, updateReportDetails],
  );

  const handleDelete = useCallback(() => {
    if (reportId == null) return;
    if (!window.confirm("Delete this saved report? This can't be undone.")) return;
    deleteReport.mutate(reportId, {
      onSuccess: () => onAfterDelete?.(),
    });
  }, [reportId, deleteReport, onAfterDelete]);

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
        sessionMode={sessionMode}
        savedReportTitle={savedReportTitle ?? ""}
        savedReportDescription={savedReportDescription}
        saveBusy={saveBusy}
        onSaveNew={handleSaveNew}
        onUpdateSavedReport={handleUpdateSavedReport}
        onEditDetails={handleEditDetails}
        onDelete={handleDelete}
      />
    </div>
  );
}
