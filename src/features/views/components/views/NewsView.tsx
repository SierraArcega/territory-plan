"use client";

/**
 * NewsView — card feed (NOT a table) for the active plan/list scope, with an
 * optional toggle to switch to GridView table mode.
 *
 * Mode defaults to "cards" and persists via viewLayouts.news.mode.
 *
 * Card layout prototype source: `district-feeds.jsx::CanvasNewsView`. Each card:
 *   - 36px square block tinted by category, district initials inside
 *   - Headline (14px, 500 weight)
 *   - Category pill
 *   - Source · date meta
 *
 * Data: `GET /api/news?territoryPlanId=<id>&limit=N` when scoped to a plan.
 * Lists ship empty in v0 — the news endpoint doesn't accept a leaid set yet
 * and Phase E's list preview will surface that scope later.
 */
import { useState, useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import {
  EmptyState,
  ErrorState,
  LoadingState,
  PAGE_SIZE,
  ShowMoreButton,
  ViewScroll,
} from "./_shared";
import type { ViewBodyProps } from "./_shared";
import GridView from "../grid/GridView";
import {
  useUpdatePlanLayout,
  useUpdateListLayout,
} from "@/features/views/lib/queries";
import type { ViewLayouts } from "@/lib/saved-views/grid-layout-schema";

// ── Types ─────────────────────────────────────────────────────────────────────

interface NewsArticle {
  id: string;
  url: string;
  title: string;
  description: string | null;
  imageUrl: string | null;
  source: string;
  feedSource: string;
  publishedAt: string;
  categories: string[];
  districtLeaid?: string;
  districtName?: string;
}

interface NewsResponse {
  articles: NewsArticle[];
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function relativeFromIso(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const diffDays = Math.floor((Date.now() - then) / (1000 * 60 * 60 * 24));
  if (diffDays <= 0) return "today";
  if (diffDays === 1) return "1d ago";
  if (diffDays < 14) return `${diffDays}d ago`;
  if (diffDays < 60) return `${Math.floor(diffDays / 7)}w ago`;
  return `${Math.floor(diffDays / 30)}mo ago`;
}

function initialsOf(name: string | undefined): string {
  if (!name) return "—";
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "—";
  return parts
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

const CATEGORY_TINT: Record<string, { bg: string; fg: string }> = {
  funding: { bg: "#EDFFE3", fg: "#5f665b" },
  leadership: { bg: "#e8f1f5", fg: "#4d7285" },
  curriculum: { bg: "#EFEDF5", fg: "#6f4c8c" },
  risk: { bg: "#FEF2F1", fg: "#c25a52" },
  strategy: { bg: "#FFF6DD", fg: "#7d6d3a" },
  program: { bg: "#e8f1f5", fg: "#4d7285" },
  procurement: { bg: "#FEF2F1", fg: "#c25a52" },
};

function categoryStyle(categories: string[]): { bg: string; fg: string; label: string } {
  for (const cat of categories) {
    const key = cat.toLowerCase();
    const style = CATEGORY_TINT[key];
    if (style) return { ...style, label: cat };
  }
  return { bg: "#EFEDF5", fg: "#6f6786", label: categories[0] ?? "Update" };
}

// ── NewsCards — preserved cards rendering ─────────────────────────────────────

interface NewsCardsProps {
  territoryPlanId: string | null;
}

function NewsCards({ territoryPlanId }: NewsCardsProps) {
  const [page, setPage] = useState(1);
  const visibleCount = page * PAGE_SIZE;

  const q = useQuery({
    queryKey: ["views", "news", territoryPlanId, visibleCount] as const,
    queryFn: () => {
      if (!territoryPlanId) throw new Error("Missing plan id");
      return fetchJson<NewsResponse>(
        `${API_BASE}/news?territoryPlanId=${encodeURIComponent(territoryPlanId)}&limit=${visibleCount}`,
      );
    },
    enabled: !!territoryPlanId,
    staleTime: 60 * 1000,
  });

  if (!territoryPlanId) {
    return (
      <EmptyState
        title="News available on plans only"
        hint="Saved Lists will surface news in a follow-up — open a plan to see scoped headlines."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={4} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch news.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const articles = q.data?.articles ?? [];
  if (articles.length === 0) {
    return (
      <EmptyState
        title="No news yet"
        hint="Articles matched to this plan's districts will appear here."
      />
    );
  }

  return (
    <ViewScroll>
      <div className="px-5 py-3.5 flex flex-col gap-2 max-w-[880px]">
        {articles.map((n) => {
          const cat = categoryStyle(n.categories);
          return (
            <a
              key={n.id}
              data-row-kind="news"
              data-row-id={n.id}
              href={n.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-start gap-3 p-3 rounded-lg bg-white border border-[#D4CFE2] hover:border-[#B8B0D0] transition-colors duration-100 group"
            >
              <div
                className="w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0 text-[14px] font-bold"
                style={{ background: cat.bg, color: cat.fg }}
                aria-hidden
              >
                {initialsOf(n.districtName)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2 mb-1 flex-wrap">
                  <span className="text-[12px] font-semibold text-[#403770] whitespace-nowrap">
                    {n.districtName ?? "—"}
                  </span>
                  <span
                    className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                    style={{ background: cat.bg, color: cat.fg }}
                  >
                    {cat.label}
                  </span>
                </div>
                <div
                  className="text-[14px] font-medium text-[#2d2750] leading-snug"
                  style={{ letterSpacing: "-0.005em" }}
                >
                  {n.title}
                </div>
                <div className="text-[11px] text-[#8A80A8] mt-1 whitespace-nowrap">
                  {n.source} · {relativeFromIso(n.publishedAt)}
                </div>
              </div>
            </a>
          );
        })}
      </div>
      {articles.length >= PAGE_SIZE && (
        <ShowMoreButton
          onClick={() => setPage((p) => p + 1)}
          remaining={PAGE_SIZE}
        />
      )}
    </ViewScroll>
  );
}

// ── NewsView — top-level with toggle ──────────────────────────────────────────

export default function NewsView({
  leaids,
  parentKind,
  parentId,
  savedLayouts,
}: ViewBodyProps & { leaids: string[] | null }) {
  // Derive territoryPlanId the same way GroupCanvas used to — only plans have news.
  // GroupCanvas no longer passes territoryPlanId directly; we reconstruct it from
  // parentKind/parentId (plan IDs are strings and are the parentId when kind=plan).
  const territoryPlanId = parentKind === "plan" ? parentId : null;

  const initialMode = savedLayouts?.news?.mode ?? "cards";
  const [mode, setMode] = useState<"cards" | "table">(initialMode);

  const planMutation = useUpdatePlanLayout(parentKind === "plan" ? parentId : "");
  const listMutation = useUpdateListLayout(parentKind === "list" ? parentId : "");

  // Re-hydrate mode if savedLayouts updates externally (e.g. another tab).
  useEffect(() => {
    const incoming = savedLayouts?.news?.mode;
    if (incoming && incoming !== mode) {
      setMode(incoming);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [savedLayouts?.news?.mode]);

  const toggleMode = (next: "cards" | "table") => {
    if (next === mode) return;
    setMode(next);
    const mergedNews = {
      ...(savedLayouts?.news ?? {
        columns: [],
        sort: [],
        filters: { kind: "and" as const, children: [] },
      }),
      mode: next,
    };
    const merged: ViewLayouts = { ...(savedLayouts ?? {}), news: mergedNews };
    if (parentKind === "plan") planMutation.mutate(merged);
    else listMutation.mutate(merged);
  };

  return (
    <div className="flex flex-col h-full">
      {/* View-as toggle bar */}
      <div className="flex items-center gap-2 border-b border-[#EFEDF5] bg-white px-3 py-2 flex-shrink-0">
        <div
          className="inline-flex rounded-md border border-[#E2DEEC] bg-white p-0.5"
          role="group"
          aria-label="View as"
        >
          <button
            type="button"
            onClick={() => toggleMode("cards")}
            className={`rounded px-2 py-0.5 text-[12px] whitespace-nowrap transition-colors ${
              mode === "cards"
                ? "bg-[#403770] text-white"
                : "text-[#544A78] hover:bg-[#F7F5FA]"
            }`}
          >
            Cards
          </button>
          <button
            type="button"
            onClick={() => toggleMode("table")}
            className={`rounded px-2 py-0.5 text-[12px] whitespace-nowrap transition-colors ${
              mode === "table"
                ? "bg-[#403770] text-white"
                : "text-[#544A78] hover:bg-[#F7F5FA]"
            }`}
          >
            Table
          </button>
        </div>
      </div>

      {/* View body */}
      <div className="flex-1 min-h-0">
        {mode === "cards" ? (
          <NewsCards territoryPlanId={territoryPlanId} />
        ) : (
          <GridView
            source="news"
            leaids={leaids}
            listId={null}
            parentKind={parentKind}
            parentId={parentId}
            viewType="news"
            savedLayouts={savedLayouts}
          />
        )}
      </div>
    </div>
  );
}
