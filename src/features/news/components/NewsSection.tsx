"use client";

import { useState } from "react";
import { RefreshCw, Newspaper } from "lucide-react";
import { Skeleton } from "@/features/shared/components/Skeleton";
import {
  useDistrictNewsQuery,
  useRefreshDistrictNewsMutation,
} from "@/features/news/lib/queries";
import { NewsCard } from "./NewsCard";

interface NewsSectionProps {
  leaid: string;
  limit?: number;
}

export function NewsSection({ leaid, limit = 5 }: NewsSectionProps) {
  const { data, isLoading, isError, refetch } = useDistrictNewsQuery(leaid, limit);
  const refresh = useRefreshDistrictNewsMutation();
  const [flash, setFlash] = useState<string | null>(null);

  async function handleRefresh() {
    setFlash(null);
    try {
      const result = await refresh.mutateAsync(leaid);
      const msg =
        result.newArticles > 0
          ? `${result.newArticles} new article${result.newArticles === 1 ? "" : "s"}`
          : "No new articles";
      setFlash(msg);
      setTimeout(() => setFlash(null), 3000);
      refetch();
    } catch {
      setFlash("Couldn't refresh");
      setTimeout(() => setFlash(null), 3000);
    }
  }

  const articles = data?.articles ?? [];

  return (
    <section className="rounded-xl border border-[#E2DEEC] bg-white p-3">
      <div className="mb-2 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Newspaper className="h-4 w-4 text-[#8A80A8]" aria-hidden />
          <h3 className="text-sm font-semibold text-[#403770]">Recent News</h3>
        </div>
        <button
          type="button"
          onClick={handleRefresh}
          disabled={refresh.isPending}
          className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-xs font-medium text-[#544A78] transition-colors hover:bg-[#EFEDF5] disabled:opacity-50"
          aria-label="Refresh district news"
        >
          <RefreshCw
            className={`h-3.5 w-3.5 ${refresh.isPending ? "animate-spin" : ""}`}
            aria-hidden
          />
          Refresh
        </button>
      </div>

      {flash && (
        <div
          role="status"
          className="mb-2 rounded-md bg-[#EFEDF5] px-2.5 py-1.5 text-xs text-[#544A78]"
        >
          {flash}
        </div>
      )}

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
        </div>
      ) : isError ? (
        <div className="rounded-md bg-[#fef1f0] px-3 py-2 text-xs text-[#f58d85]">
          Couldn&apos;t load news.{" "}
          <button
            type="button"
            className="underline"
            onClick={() => refetch()}
          >
            Retry
          </button>
        </div>
      ) : articles.length === 0 ? (
        <div className="rounded-md bg-[#F7F5FA] px-3 py-2.5 text-xs text-[#6E6390]">
          No recent news for this district. News refreshes every ~2 days, or click
          Refresh.
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {articles.map((a) => (
            <NewsCard key={a.id} article={a} />
          ))}
        </div>
      )}
    </section>
  );
}
