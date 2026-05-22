"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import type { QuerySummary, TurnEvent } from "../../lib/agent/types";
import { useChatTurnStream } from "../../hooks/useChatTurnStream";
import {
  useCreateSavedReport,
  useDeleteReport,
  useUpdateReportDetails,
  useUpdateReportSql,
  useUpsertReportDraft,
  useDeleteReportDraft,
  useReportDraft,
} from "../../lib/queries";
import { useChatCollapsed } from "../../lib/use-chat-collapsed";
import { useIsMobile } from "@/features/shared/hooks/useIsMobile";
import { BuilderChat } from "./BuilderChat";
import { CollapsedChatRail } from "./CollapsedChatRail";
import { ResultsPane } from "./ResultsPane";
import type { SessionMode } from "./SaveButton";
import type { BuilderTurn, BuilderVersion } from "./types";

function relativeAge(iso: string): string {
  if (!iso) return "recently";
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 60) return "just now";
  if (diffSec < 3600) return `${Math.round(diffSec / 60)} minutes ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)} hours ago`;
  return `${Math.round(diffSec / 86400)} days ago`;
}

interface Props {
  /** When set, on mount the builder reruns the saved report's stored SQL and
   *  seeds the rail with v1 (zero Claude tokens). */
  reportId: number | null;
  /** When set, the builder auto-submits this prompt as the first turn. */
  initialPrompt: string | null;
  /** Initial selected version (read from ?v= on mount). After mount the
   *  builder owns selection locally and mirrors back to the URL silently —
   *  prop changes after mount are ignored on purpose, to keep pill toggles
   *  free of router.push churn. */
  selectedVersionN: number | null;
  onNewReport: () => void;
  onCollapseChat: () => void;
  /** Navigate back to the library (clears ?view, ?report, ?prompt, ?v). */
  onBackToLibrary: () => void;
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
  onNewReport,
  onCollapseChat,
  onBackToLibrary,
  onAfterSaveNew,
  onAfterDelete,
}: Props) {
  const [turns, setTurns] = useState<BuilderTurn[]>([]);
  const [conversationId, setConversationId] = useState<string | undefined>();
  const [savedReportTitle, setSavedReportTitle] = useState<string | null>(null);
  const [savedReportDescription, setSavedReportDescription] = useState<string>("");
  const [chatCollapsed, setChatCollapsed] = useChatCollapsed();
  // Surface saved-report load failures (bad SQL, missing summary, server error)
  // so the user sees an actionable message instead of an empty results pane.
  const [loadError, setLoadError] = useState<string | null>(null);
  // Recovery states:
  //   'idle'       — draft query still loading
  //   'none'       — no draft found
  //   'restored'   — auto-restored silently (< 8h); show brief chip
  //   'banner'     — stale draft (≥ 8h); show in-builder banner
  //   'dismissed'  — user dismissed the banner
  const [recoveryState, setRecoveryState] = useState<
    "idle" | "none" | "restored" | "banner" | "dismissed"
  >("idle");

  const draftQuery = useReportDraft(reportId ?? 0);
  const alreadyRecoveredRef = useRef(false);
  // True while the mount-time POST /api/reports/{id}/run is in flight. Used to
  // lock the composer until the saved report's v1 lands.
  const [loadingSaved, setLoadingSaved] = useState(false);
  // Transient confirmation toast — set to a string to show, auto-clears after
  // ~2.5s. Used after save/update/edit-details so the user gets feedback even
  // when no other UI changes (e.g. updating a report that's already loaded).
  const [toast, setToast] = useState<string | null>(null);
  useEffect(() => {
    if (!toast) return;
    const t = window.setTimeout(() => setToast(null), 2500);
    return () => window.clearTimeout(t);
  }, [toast]);
  // Autosave: upsert draft after each completed turn that produced a version.
  // Skip when the only turns are the synthetic saved-report load (empty userMessage)
  // — those represent zero user work and would create misleading draft rows.
  // Turns take seconds to complete, so this never fires back-to-back.
  useEffect(() => {
    const lastTurn = turns[turns.length - 1];
    if (!lastTurn || lastTurn.inFlight || !lastTurn.version) return;
    if (fromSavedReportRef.current && !turns.some((t) => t.userMessage.trim())) return;
    upsertDraft.mutate({
      reportId: reportId ?? 0,
      params: lastTurn.version as unknown as object,
      conversationId: conversationId ?? null,
      chatHistory: turns as unknown as object[],
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [turns]);
  // Last-chance flush when the tab closes. sendBeacon fires after unload and
  // doesn't need a response — safe to fire-and-forget.
  useEffect(() => {
    const handleUnload = () => {
      const lastTurn = turns[turns.length - 1];
      if (!lastTurn || lastTurn.inFlight || !lastTurn.version) return;
      const payload = JSON.stringify({
        reportId: reportId ?? 0,
        params: lastTurn.version,
        conversationId: conversationId ?? null,
        chatHistory: turns,
      });
      navigator.sendBeacon(
        "/api/reports/draft",
        new Blob([payload], { type: "application/json" }),
      );
    };
    window.addEventListener("beforeunload", handleUnload);
    return () => window.removeEventListener("beforeunload", handleUnload);
  }, [turns, reportId, conversationId]);
  // Selected version is owned locally so flipping pills doesn't trigger a
  // Next.js soft navigation (router.push) — that re-renders the entire page
  // tree (sidebar, builder, 100+ row results table) and adds noticeable lag.
  // We seed from the URL prop on mount and silently mirror back via
  // history.replaceState so deep-linking still works.
  const [localSelectedN, setLocalSelectedN] = useState<number | null>(selectedVersionN);
  // True for the lifetime of a session that started from a saved report,
  // even after the user adds refining turns. Used by ResultsPane to show
  // "From saved report · refined".
  const fromSavedReportRef = useRef(false);

  const isMobile = useIsMobile();
  const isMobileRef = useRef(isMobile);
  isMobileRef.current = isMobile;

  const chatTurn = useChatTurnStream();
  const createReport = useCreateSavedReport();
  const updateReportSql = useUpdateReportSql();
  const updateReportDetails = useUpdateReportDetails();
  const deleteReport = useDeleteReport();
  const upsertDraft = useUpsertReportDraft();
  const deleteDraft = useDeleteReportDraft();
  const saveBusy =
    createReport.isPending ||
    updateReportSql.isPending ||
    updateReportDetails.isPending ||
    deleteReport.isPending;

  const versions = useMemo<BuilderVersion[]>(
    () => turns.flatMap((t) => (t.version ? [t.version] : [])),
    [turns],
  );

  const inFlight = chatTurn.isPending || loadingSaved;

  // Resolve the selected version. Falls back to the latest if the URL ?v= is
  // out of range or missing.
  const selectedVersion = useMemo<BuilderVersion | null>(() => {
    if (versions.length === 0) return null;
    if (localSelectedN != null) {
      const v = versions.find((x) => x.n === localSelectedN);
      if (v) return v;
    }
    return versions[versions.length - 1];
  }, [versions, localSelectedN]);

  const handleSelectVersion = useCallback(
    (n: number) => {
      setLocalSelectedN(n);
      // Mirror to URL silently — a real router.push would re-render the page
      // tree on every pill click. history.replaceState updates the bar without
      // triggering React/Next routing.
      try {
        const params = new URLSearchParams(window.location.search);
        if (n <= 1) params.delete("v");
        else params.set("v", String(n));
        const qs = params.toString();
        window.history.replaceState(
          window.history.state,
          "",
          qs ? `?${qs}` : window.location.pathname,
        );
      } catch {
        // SSR or restricted env — ignore; selection still updates locally.
      }
    },
    [],
  );

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
              if (version) {
                handleSelectVersion(version.n);
                if (isMobileRef.current) setChatCollapsed(true);
              }
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
    [chatTurn, conversationId, handleSelectVersion, setChatCollapsed],
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
      setLoadingSaved(true);
      // Direct fetch instead of useRunSavedReport.mutate — the TanStack mutate
      // path was eating onSuccess in dev. We do NOT abort on cleanup: in
      // StrictMode dev the synthetic unmount would cancel the in-flight fetch
      // and `autoSubmittedRef` (preserved across the re-mount) prevents a
      // second one from firing, so onSuccess would never run.
      (async () => {
        try {
          const res = await fetch(`/api/reports/${reportId}/run`, { method: "POST" });
          if (!res.ok) {
            const j = (await res.json().catch(() => ({}))) as { error?: string };
            throw new Error(j.error ?? `Run failed (${res.status})`);
          }
          const data = (await res.json()) as Result;
          const safeData: Result = {
            ...data,
            summary: data.summary ?? { source: savedReportTitle ?? "Saved report" },
          };
          appendTurnFromResult("", null, safeData);
          handleSelectVersion(1);
          if (isMobileRef.current) setChatCollapsed(true);
        } catch (err) {
          console.error("[ReportsBuilder] /run failed", err);
          setLoadError(err instanceof Error ? err.message : String(err));
        } finally {
          setLoadingSaved(false);
        }
      })();
      // Title fetch — independent of /run so a slow run doesn't delay the header.
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
    // savedReportTitle is intentionally left out of deps — autoSubmittedRef
    // gates re-runs anyway and we don't want the title fetch landing to
    // re-fire the run fetch.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, initialPrompt, appendTurnFromResult, submit, handleSelectVersion]);

  // Recovery: once draft loads, decide auto-restore vs. banner.
  // Guard with alreadyRecoveredRef so StrictMode double-invoke is safe.
  // Wait for the saved-report /run to complete (loadingSaved) before deciding
  // — otherwise the draft restore and the /run result race to set turns.
  useEffect(() => {
    if (alreadyRecoveredRef.current) return;
    if (draftQuery.isLoading) return;
    if (loadingSaved) return;
    if (!draftQuery.data) {
      setRecoveryState("none");
      return;
    }

    const draft = draftQuery.data;
    const ageMs = Date.now() - new Date(draft.lastTouchedAt).getTime();
    const EIGHT_HOURS = 8 * 60 * 60 * 1000;

    alreadyRecoveredRef.current = true;

    // Auto-restore only for a fresh session (no turns yet) that is recent.
    // For saved-report contexts (turns already loaded from /run), always use
    // the banner so the user consciously chooses to restore refinements.
    if (ageMs < EIGHT_HOURS && turns.length === 0) {
      const history = (draft.chatHistory as BuilderTurn[] | null) ?? [];
      if (history.length > 0) {
        setTurns(history);
        const lastVersion = history.findLast((t) => t.version != null)?.version;
        if (lastVersion) setLocalSelectedN(lastVersion.n);
      }
      deleteDraft.mutate(reportId ?? 0);
      setRecoveryState("restored");
    } else {
      setRecoveryState("banner");
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [draftQuery.isLoading, draftQuery.data, loadingSaved, turns.length]);
  // Auto-hide the "Draft restored" chip — mirrors the toast effect pattern.
  useEffect(() => {
    if (recoveryState !== "restored") return;
    const t = window.setTimeout(() => setRecoveryState("none"), 3000);
    return () => window.clearTimeout(t);
  }, [recoveryState]);

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
            deleteDraft.mutate(reportId ?? 0);
            setToast("Report saved");
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
    updateReportSql.mutate(
      {
        id: reportId,
        sql: v.sql,
        summary: v.summary,
        question: lastUserMessage ?? v.summary.source,
      },
      { onSuccess: () => {
          deleteDraft.mutate(reportId ?? 0);
          setToast("Report updated");
        }
      },
    );
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
            setToast("Details updated");
          },
        },
      );
    },
    [reportId, updateReportDetails],
  );

  const handleRestoreDraft = useCallback(() => {
    const draft = draftQuery.data;
    if (!draft) return;
    const history = (draft.chatHistory as BuilderTurn[] | null) ?? [];
    if (history.length > 0) {
      setTurns(history);
      const lastVersion = history.findLast((t) => t.version != null)?.version;
      if (lastVersion) setLocalSelectedN(lastVersion.n);
    }
    deleteDraft.mutate(reportId ?? 0);
    setRecoveryState("none");
  }, [draftQuery.data, deleteDraft, reportId]);

  const handleDiscardDraft = useCallback(() => {
    deleteDraft.mutate(reportId ?? 0);
    setRecoveryState("dismissed");
  }, [deleteDraft, reportId]);

  const handleDelete = useCallback(() => {
    if (reportId == null) return;
    if (!window.confirm("Delete this saved report? This can't be undone.")) return;
    deleteReport.mutate(reportId, {
      onSuccess: () => onAfterDelete?.(),
    });
  }, [reportId, deleteReport, onAfterDelete]);

  const qc = useQueryClient();

  // Intercept Library navigation: flush any unsaved completed turns to the
  // draft table and optimistically populate the query cache so the navigate-away
  // toast in ReportsTab fires synchronously (before the URL change settles).
  const handleBackToLibrary = useCallback(() => {
    const completedTurns = turns.filter((t) => !t.inFlight);
    const lastVersionTurn = completedTurns.findLast((t) => t.version != null);
    const hasUserInput = completedTurns.some((t) => t.userMessage.trim() !== "");
    if (lastVersionTurn && hasUserInput) {
      const draftId = reportId ?? 0;
      qc.setQueryData(["report-draft", draftId], {
        reportId: draftId,
        params: lastVersionTurn.version,
        conversationId: conversationId ?? null,
        chatHistory: completedTurns,
        lastTouchedAt: new Date().toISOString(),
        createdAt: new Date().toISOString(),
      });
      upsertDraft.mutate({
        reportId: draftId,
        params: lastVersionTurn.version as unknown as object,
        conversationId: conversationId ?? null,
        chatHistory: completedTurns as unknown as object[],
      });
    }
    onBackToLibrary();
  }, [turns, reportId, conversationId, qc, upsertDraft, onBackToLibrary]);

  const handleCollapseChat = useCallback(() => {
    setChatCollapsed(true);
    onCollapseChat();
  }, [onCollapseChat, setChatCollapsed]);

  const handleExpandChat = useCallback(() => {
    setChatCollapsed(false);
  }, [setChatCollapsed]);

  const resultsPane = (
    <div className="flex min-h-0 flex-1 flex-col">
      {recoveryState === "banner" && (
        <div className="mx-3 mb-2 flex flex-wrap items-center justify-between gap-2 rounded-lg border border-[#C4B5FD] bg-[#EDE7F6] px-3.5 py-2.5 text-[12.5px]">
          <span className="text-[#5B21B6]">
            <span className="whitespace-nowrap font-semibold">You have unsaved work</span>
            <span className="ml-1.5 whitespace-nowrap text-[#7C3AED]">
              from {relativeAge(draftQuery.data?.lastTouchedAt ?? "")}
            </span>
          </span>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleDiscardDraft}
              className="rounded-md border border-[#C4B5FD] bg-white px-2.5 py-1 text-[11.5px] text-[#5B21B6] hover:bg-[#F7F5FA]"
            >
              Discard
            </button>
            <button
              type="button"
              onClick={handleRestoreDraft}
              className="rounded-md bg-[#3D1D72] px-2.5 py-1 text-[11.5px] text-white hover:bg-[#2D1562]"
            >
              Restore
            </button>
          </div>
        </div>
      )}
      <ResultsPane
        version={selectedVersion}
        sessionMode={sessionMode}
        savedReportTitle={savedReportTitle ?? ""}
        savedReportDescription={savedReportDescription}
        saveBusy={saveBusy}
        loadError={loadError}
        saveConfirmation={toast}
        onSaveNew={handleSaveNew}
        onUpdateSavedReport={handleUpdateSavedReport}
        onEditDetails={handleEditDetails}
        onDelete={handleDelete}
        onExpandChat={handleExpandChat}
      />
    </div>
  );

  const builderChat = (
    <div className="flex min-h-0 flex-col">
      {recoveryState === "restored" && (
        <div className="mx-3 mb-2 rounded-md border border-[#A5D6A7] bg-[#E8F5E9] px-3 py-1.5 text-[11.5px] text-[#2E7D32]">
          Draft restored
        </div>
      )}
      <BuilderChat
        title={headerTitle}
        turns={turns}
        versions={versions}
        selectedN={selectedVersion?.n ?? null}
        inFlight={inFlight}
        onSelectVersion={handleSelectVersion}
        onSubmit={submit}
        onNewReport={onNewReport}
        onCollapseChat={handleCollapseChat}
        onBackToLibrary={handleBackToLibrary}
      />
    </div>
  );

  // Mobile: one panel at a time — chat full-screen or results full-screen.
  // chatCollapsed doubles as the "show results" toggle on mobile.
  if (isMobile) {
    return (
      <div className="flex h-full min-h-0 flex-col bg-[#FFFCFA]">
        {chatCollapsed ? resultsPane : builderChat}
      </div>
    );
  }

  return (
    <div className="flex h-full min-h-0 bg-[#FFFCFA]">
      {chatCollapsed ? (
        <CollapsedChatRail
          versions={versions}
          selectedN={selectedVersion?.n ?? null}
          onSelectVersion={handleSelectVersion}
          onExpand={handleExpandChat}
        />
      ) : builderChat}
      {resultsPane}
    </div>
  );
}
