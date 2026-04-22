"use client";

import Link from "next/link";
import { Newspaper } from "lucide-react";
import { useMyTerritoryNewsQuery } from "@/features/news/lib/queries";
import { Skeleton } from "@/features/shared/components/Skeleton";
import { NewsCard } from "./NewsCard";

/**
 * Shows up to 10 recent news articles from any district the authenticated user
 * owns or collaborates on. Hides entirely when there are 0 articles so the home
 * feed stays clean for new users.
 */
export function HomeNewsCard({ limit = 10 }: { limit?: number }) {
  const { data, isLoading, isError } = useMyTerritoryNewsQuery(limit);

  // Hide empty / errored — non-blocking placement on home dashboard
  if (isError) return null;
  if (!isLoading && (!data?.articles || data.articles.length === 0)) return null;

  return (
    <section
      aria-label="Territory news"
      className="rounded-xl border border-[#E2DEEC] bg-white p-4"
    >
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <Newspaper className="h-4 w-4 text-[#8A80A8]" aria-hidden />
          <h3 className="text-sm font-semibold text-[#403770]">Territory news</h3>
        </div>
        <Link
          href="/news"
          className="text-xs font-medium text-[#544A78] hover:text-[#322a5a]"
        >
          See all →
        </Link>
      </div>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
          <Skeleton variant="card" className="h-16" />
        </div>
      ) : (
        <div className="flex flex-col gap-2">
          {data!.articles.map((a) => (
            <NewsCard key={a.id} article={a} showDistrictChip />
          ))}
        </div>
      )}
    </section>
  );
}
