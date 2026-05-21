"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportsLibrary } from "./ReportsLibrary";
import { ReportsBuilder } from "./builder/ReportsBuilder";
import type { LibraryTab } from "./library/LibraryTabs";
import { useReportDraft, useDeleteReportDraft } from "../lib/queries";

function relativeAgeShort(iso: string): string {
  const diffSec = Math.round((Date.now() - new Date(iso).getTime()) / 1000);
  if (diffSec < 3600) return `${Math.round(diffSec / 60)}m ago`;
  if (diffSec < 86400) return `${Math.round(diffSec / 3600)}h ago`;
  return `${Math.round(diffSec / 86400)}d ago`;
}

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

  const [navAwayToast, setNavAwayToast] = useState(false);
  const prevViewRef = useRef<string | null>(null);
  const draftQuery = useReportDraft(0); // fresh-session draft (reportId=0)
  const deleteDraft = useDeleteReportDraft();

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

  // Show "Draft saved" toast when user leaves the builder and a fresh draft exists.
  useEffect(() => {
    const current = view ?? null;
    const previous = prevViewRef.current;
    prevViewRef.current = current;

    if (previous === "builder" && current !== "builder" && draftQuery.data) {
      setNavAwayToast(true);
      const t = window.setTimeout(() => setNavAwayToast(false), 4000);
      return () => window.clearTimeout(t);
    }
  }, [view, draftQuery.data]);

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
    <div className="relative flex h-full flex-col">
      {/* Navigate-away toast */}
      {navAwayToast && (
        <div className="fixed bottom-[calc(1.25rem+env(safe-area-inset-bottom))] right-5 z-50 flex items-center gap-2.5 rounded-xl bg-[#1E1033] px-4 py-3 text-[13px] text-white shadow-lg">
          <div>
            <div className="font-semibold">Draft saved</div>
            <div className="text-[11.5px] text-[#C4B5FD]">
              Resume anytime from the Reports tab
            </div>
          </div>
        </div>
      )}

      {/* Library banner — stale fresh-session draft (≥ 8 hours old) */}
      {draftQuery.data &&
        Date.now() - new Date(draftQuery.data.lastTouchedAt).getTime() >= 8 * 60 * 60 * 1000 && (
          <div className="mx-4 mt-3 flex items-center justify-between rounded-lg border border-[#C4B5FD] bg-[#EDE7F6] px-3.5 py-2.5 text-[12.5px]">
            <span className="text-[#5B21B6]">
              <span className="whitespace-nowrap font-semibold">You have an unsaved draft</span>
              <span className="ml-2 whitespace-nowrap text-[#7C3AED]">
                {relativeAgeShort(draftQuery.data.lastTouchedAt)}
              </span>
            </span>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => deleteDraft.mutate(0)}
                className="rounded-md border border-[#C4B5FD] bg-white px-2.5 py-1 text-[11.5px] text-[#5B21B6] hover:bg-[#F7F5FA]"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={() => goToBuilder()}
                className="rounded-md bg-[#3D1D72] px-2.5 py-1 text-[11.5px] text-white hover:bg-[#2D1562]"
              >
                Resume →
              </button>
            </div>
          </div>
        )}

      <ReportsLibrary
        initialTab={initialLibraryTab}
        onTabChange={handleLibraryTabChange}
        onOpenReport={(id) => {
          if (id === 0) goToBuilder();
          else goToBuilder({ report: String(id) });
        }}
        onNewReport={(prompt) => {
          const extras: Record<string, string> = {};
          if (prompt) extras.prompt = prompt;
          goToBuilder(extras);
        }}
      />
    </div>
  );
}
