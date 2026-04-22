"use client";

import Link from "next/link";
import { ArrowLeft, Newspaper } from "lucide-react";
import { useMyTerritoryNewsQuery } from "@/features/news/lib/queries";
import { NewsCard } from "@/features/news/components/NewsCard";
import { Skeleton } from "@/features/shared/components/Skeleton";

export default function NewsPage() {
  const { data, isLoading, isError } = useMyTerritoryNewsQuery(100);

  return (
    <div className="min-h-screen bg-[#FFFCFA]">
      <div className="mx-auto max-w-4xl px-6 py-10">
        <div className="mb-6 flex items-center gap-3">
          <Link
            href="/"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md text-[#544A78] transition-colors hover:bg-[#EFEDF5]"
            aria-label="Back to home"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden />
          </Link>
          <div className="flex items-center gap-2">
            <Newspaper className="h-5 w-5 text-[#8A80A8]" aria-hidden />
            <h1 className="text-xl font-semibold text-[#403770]">Territory news</h1>
          </div>
        </div>

        {isLoading && (
          <div className="flex flex-col gap-3">
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
            <Skeleton variant="card" className="h-20" />
          </div>
        )}

        {isError && (
          <div className="rounded-md bg-[#fef1f0] px-4 py-3 text-sm text-[#f58d85]">
            Couldn&apos;t load news. Try again shortly.
          </div>
        )}

        {!isLoading && !isError && data && data.articles.length === 0 && (
          <div className="rounded-xl border border-[#E2DEEC] bg-white px-6 py-10 text-center text-sm text-[#6E6390]">
            <p className="font-medium text-[#403770]">No news yet.</p>
            <p className="mt-1">
              Articles are pulled for districts in your territory plans. Check back
              tomorrow or refresh a district from its panel.
            </p>
          </div>
        )}

        {!isLoading && !isError && data && data.articles.length > 0 && (
          <div className="flex flex-col gap-3">
            {data.articles.map((a) => (
              <NewsCard key={a.id} article={a} showDistrictChip />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
