"use client";

import { useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { ReportsLibrary } from "./ReportsLibrary";
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

  if (view === "builder") {
    return <BuilderPlaceholder onBack={goToLibrary} />;
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

// Placeholder until slice 4 lands the real builder. Lets the navigation flow
// be exercised end-to-end without the full chat UI.
function BuilderPlaceholder({ onBack }: { onBack: () => void }) {
  return (
    <div className="flex h-full items-center justify-center bg-[#FFFCFA] p-6">
      <div className="max-w-md rounded-xl border border-dashed border-[#D4CFE2] bg-white px-6 py-10 text-center">
        <div className="text-sm font-semibold text-[#403770]">Builder coming online next slice</div>
        <div className="mt-1 text-xs text-[#8A80A8]">
          The new chat-as-timeline builder lands in slice 4. The library nav and URL state are
          already wired so you can click around.
        </div>
        <button
          type="button"
          onClick={onBack}
          className="mt-4 inline-flex items-center gap-1.5 rounded-lg border border-[#D4CFE2] bg-white px-3.5 py-1.5 text-xs font-medium text-[#544A78] transition-colors hover:bg-[#F7F5FA]"
        >
          <span className="whitespace-nowrap">Back to library</span>
        </button>
      </div>
    </div>
  );
}
