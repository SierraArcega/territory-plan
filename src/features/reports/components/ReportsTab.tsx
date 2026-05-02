"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportsLibrary } from "./ReportsLibrary";
import { ReportsBuilder } from "./builder/ReportsBuilder";
import type { LibraryTab } from "./library/LibraryTabs";

const VALID_LIBRARY_TABS: LibraryTab[] = ["mine", "starred", "team"];

function isLibraryTab(v: string | null): v is LibraryTab {
  return v !== null && (VALID_LIBRARY_TABS as string[]).includes(v);
}

export function ReportsTab() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const view = searchParams.get("view");
  const libraryTabParam = searchParams.get("libraryTab");
  const initialLibraryTab: LibraryTab = isLibraryTab(libraryTabParam) ? libraryTabParam : "mine";

  const updateParams = useCallback(
    (mutate: (p: URLSearchParams) => void) => {
      const params = new URLSearchParams(searchParams.toString());
      mutate(params);
      const qs = params.toString();
      router.push(qs ? `?${qs}` : "/", { scroll: false });
    },
    [router, searchParams],
  );

  const goToBuilder = useCallback(
    (extras: Record<string, string> = {}) => {
      updateParams((p) => {
        p.set("view", "builder");
        for (const [k, v] of Object.entries(extras)) p.set(k, v);
      });
    },
    [updateParams],
  );

  const goToLibrary = useCallback(() => {
    updateParams((p) => {
      p.delete("view");
      p.delete("report");
      p.delete("v");
      p.delete("prompt");
    });
  }, [updateParams]);

  const handleLibraryTabChange = useCallback(
    (next: LibraryTab) => {
      updateParams((p) => {
        if (next === "mine") p.delete("libraryTab");
        else p.set("libraryTab", next);
      });
    },
    [updateParams],
  );

  const handleSelectVersion = useCallback(
    (n: number) => {
      updateParams((p) => {
        if (n <= 1) p.delete("v");
        else p.set("v", String(n));
      });
    },
    [updateParams],
  );

  if (view === "builder") {
    const reportIdParam = searchParams.get("report");
    const reportId = reportIdParam ? Number(reportIdParam) : NaN;
    const promptParam = searchParams.get("prompt");
    const vParam = searchParams.get("v");
    const selectedV = vParam ? Number(vParam) : NaN;
    return (
      <ReportsBuilder
        reportId={Number.isFinite(reportId) ? reportId : null}
        initialPrompt={promptParam}
        selectedVersionN={Number.isFinite(selectedV) ? selectedV : null}
        onSelectVersion={handleSelectVersion}
        onNewReport={() => {
          // Hard reset — drop ?report, ?prompt, ?v, then route back to a blank
          // builder so all in-memory turns clear. Same effect as clicking the
          // header "+ New" while inside an existing session.
          updateParams((p) => {
            p.delete("report");
            p.delete("prompt");
            p.delete("v");
          });
          // Force a remount of ReportsBuilder by briefly toggling view; in
          // practice the param reset triggers fresh state because the builder
          // keys off ?report and ?prompt. If we wanted truly fresh state we'd
          // also navigate to library and back — keep it simple for slice 4.
        }}
        onCollapseChat={() => {
          // Slice 8 wires the actual collapsed-rail. For now this is a no-op
          // that we leave in the contract so the chat header chevron works.
        }}
      />
    );
  }

  return (
    <ReportsLibrary
      initialTab={initialLibraryTab}
      onTabChange={handleLibraryTabChange}
      onOpenReport={(id) => goToBuilder({ report: String(id) })}
      onNewReport={(prompt) => {
        const extras: Record<string, string> = {};
        if (prompt) extras.prompt = prompt;
        goToBuilder(extras);
      }}
    />
  );
}
