"use client";

import { useCallback, useState } from "react";
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

  // Bumped on every "+ New" click so the builder remounts even when the URL
  // params (?report=, ?prompt=) didn't actually change — e.g. clicking "+ New"
  // while already on a blank builder. Without this, the URL-derived key stays
  // identical and the in-memory state never resets.
  const [newReportNonce, setNewReportNonce] = useState(0);

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

  if (view === "builder") {
    const reportIdParam = searchParams.get("report");
    const reportId = reportIdParam ? Number(reportIdParam) : NaN;
    const promptParam = searchParams.get("prompt");
    const vParam = searchParams.get("v");
    const selectedV = vParam ? Number(vParam) : NaN;
    // ReportsBuilder keys off ?report and ?prompt for its mount-time effect.
    // Remount it whenever those params change so a "+ New" reset clears in-
    // memory turns too. Without this key, dropping ?report/?prompt would
    // leave the previous session's turns stranded.
    const builderKey = `${reportIdParam ?? ""}::${promptParam ?? ""}::${newReportNonce}`;
    return (
      <ReportsBuilder
        key={builderKey}
        reportId={Number.isFinite(reportId) ? reportId : null}
        initialPrompt={promptParam}
        selectedVersionN={Number.isFinite(selectedV) ? selectedV : null}
        onNewReport={() => {
          setNewReportNonce((n) => n + 1);
          updateParams((p) => {
            p.delete("report");
            p.delete("prompt");
            p.delete("v");
          });
        }}
        onCollapseChat={() => {
          // Slice 8 wires the actual collapsed-rail. For now a no-op; the
          // chevron in the chat header still renders so the visual contract
          // is in place.
        }}
        onBackToLibrary={goToLibrary}
        onAfterSaveNew={(newId) => {
          updateParams((p) => {
            p.set("report", String(newId));
            p.delete("prompt");
            p.delete("v");
          });
        }}
        onAfterDelete={() => {
          goToLibrary();
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
