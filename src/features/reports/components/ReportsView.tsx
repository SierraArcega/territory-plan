"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useProfile } from "@/features/shared/lib/queries";
import { useReportsStore, useChatOpen, useDirty, isDirty } from "../lib/store";
import { useDraftParams } from "../lib/use-draft-params";
import {
  useDiscardDraftMutation,
  useRunQueryMutation,
  useSavedReportQuery,
  useSuggestMutation,
  useUpsertDraftMutation,
} from "../lib/queries";
import type { QueryParams, QueryResult } from "../lib/types";
import type { ChatMessage } from "../lib/ui-types";
import BuilderStrip from "./builder/BuilderStrip";
import ChatPanel from "./ChatPanel";
import ResultsArea from "./ResultsArea";
import Library from "./Library";
import SaveModal from "./SaveModal";
import TopBar from "./TopBar";

export default function ReportsView() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const view = searchParams.get("view");
  const reportIdRaw = searchParams.get("report");
  const reportId = reportIdRaw ? Number.parseInt(reportIdRaw, 10) : null;

  const { data: profile } = useProfile();
  const isAdmin = profile?.role === "admin";
  const currentUserId = profile?.id ?? "";

  const { params, setParams } = useDraftParams();
  const upsertDraft = useUpsertDraftMutation();
  const discardDraft = useDiscardDraftMutation();
  const runQuery = useRunQueryMutation();
  const suggest = useSuggestMutation();

  const savedQuery = useSavedReportQuery(reportId);
  const snapshot = useReportsStore((s) => s.lastRunSnapshot);
  const snapshotRun = useReportsStore((s) => s.snapshotRun);
  const dirty = useDirty();
  const chatOpen = useChatOpen();

  const [result, setResult] = useState<QueryResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saveOpen, setSaveOpen] = useState(false);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [hydratedReportId, setHydratedReportId] = useState<number | null>(null);

  // Hydrate builder from a saved report (deep link)
  useEffect(() => {
    if (!reportId || !savedQuery.data) return;
    if (hydratedReportId === reportId) return;
    const report = savedQuery.data;
    if (report.params) {
      void upsertDraft.mutateAsync({ params: report.params });
      setHydratedReportId(reportId);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reportId, savedQuery.data]);

  // Keep dirty flag in sync with draft vs snapshot comparison
  useEffect(() => {
    if (isDirty(params, snapshot)) {
      useReportsStore.getState().markDirty();
    }
  }, [params, snapshot]);

  const handleRun = useCallback(async () => {
    setError(null);
    try {
      const data = await runQuery.mutateAsync({ params });
      setResult(data);
      snapshotRun(params);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }, [params, runQuery, snapshotRun]);

  const handleSend = useCallback(
    async (text: string) => {
      const userMsg: ChatMessage = {
        id: `u-${Date.now()}`,
        role: "user",
        content: text,
        timestamp: new Date().toISOString(),
      };
      setMessages((m) => [...m, userMsg]);
      try {
        const res = await suggest.mutateAsync({ question: text });
        await setParams(res.params);
        const filterCount = res.params.filters?.length ?? 0;
        const columnCount = res.params.columns?.length ?? 0;
        const sortCount = res.params.orderBy?.length ?? 0;
        const assistantMsg: ChatMessage = {
          id: `a-${Date.now()}`,
          role: "assistant",
          content: res.explanation,
          timestamp: new Date().toISOString(),
          receipt: {
            summary: `Populated builder: ${filterCount} filter${filterCount === 1 ? "" : "s"}, ${columnCount} column${columnCount === 1 ? "" : "s"}, ${sortCount} sort`,
            counts: {
              filters: filterCount,
              columns: columnCount,
              sort: sortCount,
            },
          },
        };
        setMessages((m) => [...m, assistantMsg]);
      } catch (err: unknown) {
        setMessages((m) => [
          ...m,
          {
            id: `e-${Date.now()}`,
            role: "assistant",
            content:
              err instanceof Error && err.message
                ? `I couldn't translate that — ${err.message}. Try rephrasing or edit the chips manually.`
                : "I couldn't translate that — try rephrasing or edit the chips manually.",
            timestamp: new Date().toISOString(),
            error: true,
          },
        ]);
      }
    },
    [suggest, setParams],
  );

  const handleNewReport = useCallback(() => {
    void discardDraft.mutateAsync();
    setResult(null);
    setMessages([]);
    setError(null);
    useReportsStore.getState().reset();
    router.push("/?tab=reports", { scroll: false });
  }, [discardDraft, router]);

  const openSavedReport = useCallback(
    (id: number) => {
      router.push(`/?tab=reports&report=${id}`, { scroll: false });
    },
    [router],
  );

  const backToLibrary = useCallback(() => {
    router.push("/?tab=reports&view=library", { scroll: false });
  }, [router]);

  const currentTitle = useMemo(() => {
    if (reportId && savedQuery.data) return savedQuery.data.title;
    if (!params.table) return "New report";
    return "Untitled draft";
  }, [reportId, savedQuery.data, params.table]);

  const badge: "Draft" | "Saved" | null = reportId ? "Saved" : params.table ? "Draft" : null;

  // Library view
  if (view === "library") {
    return (
      <Library
        currentUserId={currentUserId}
        onNewReport={handleNewReport}
        onOpenReport={openSavedReport}
      />
    );
  }

  return (
    <div className="flex h-full flex-col bg-[#FFFCFA]">
      <TopBar
        title={currentTitle}
        badge={badge}
        backToLibrary={backToLibrary}
        onSaveClick={() => setSaveOpen(true)}
        saveDisabled={!result || !params.table}
      />
      <BuilderStrip
        params={params}
        onChange={(p) => void setParams(p)}
        dirty={dirty}
        running={runQuery.isPending}
        hasSnapshot={snapshot !== null}
        onRun={handleRun}
      />
      <div className="flex h-[calc(100%-172px)] items-stretch">
        <div className="flex flex-1 flex-col overflow-auto">
          <ResultsArea
            params={params}
            result={result}
            loading={runQuery.isPending}
            error={error}
            onRun={handleRun}
            onRetry={handleRun}
          />
        </div>
        {chatOpen && (
          <ChatPanel
            messages={messages}
            sending={suggest.isPending}
            onSend={handleSend}
          />
        )}
      </div>

      <SaveModal
        open={saveOpen}
        onClose={() => setSaveOpen(false)}
        params={params}
        isAdmin={!!isAdmin}
        onSaved={(id) => {
          router.push(`/?tab=reports&report=${id}`, { scroll: false });
        }}
      />
    </div>
  );
}
