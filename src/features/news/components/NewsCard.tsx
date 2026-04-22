"use client";

import { ExternalLink } from "lucide-react";
import { cn } from "@/features/shared/lib/cn";
import { timeAgo } from "@/features/shared/lib/pretty-duration";
import type { NewsArticleDto } from "@/features/news/lib/queries";

interface NewsCardProps {
  article: NewsArticleDto;
  showDistrictChip?: boolean;
  className?: string;
}

/** Initials-style letter avatar used when the article has no image. */
function SourceAvatar({ source }: { source: string }) {
  const letter = source.replace(/^www\./, "").charAt(0).toUpperCase() || "•";
  return (
    <div
      aria-hidden
      className="flex h-12 w-12 shrink-0 items-center justify-center rounded-lg bg-[#F7F5FA] text-base font-semibold text-[#544A78]"
    >
      {letter}
    </div>
  );
}

export function NewsCard({ article, showDistrictChip, className }: NewsCardProps) {
  const sourceDomain = article.source.replace(/^www\./, "");
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "group flex gap-3 rounded-xl border border-[#E2DEEC] bg-white p-3",
        "transition-colors hover:bg-[#F7F5FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#403770]",
        className
      )}
    >
      {article.imageUrl ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={article.imageUrl}
          alt=""
          className="h-12 w-12 shrink-0 rounded-lg object-cover"
          loading="lazy"
          onError={(e) => {
            (e.currentTarget as HTMLImageElement).style.display = "none";
          }}
        />
      ) : (
        <SourceAvatar source={article.source} />
      )}

      <div className="min-w-0 flex-1">
        <h4 className="line-clamp-2 text-sm font-semibold text-[#403770] group-hover:text-[#322a5a]">
          {article.title}
        </h4>
        {article.description && (
          <p className="mt-1 line-clamp-1 text-xs text-[#6E6390]">{article.description}</p>
        )}
        <div className="mt-1.5 flex items-center gap-1.5 text-[11px] text-[#8A80A8]">
          <span className="font-medium">{sourceDomain}</span>
          <span aria-hidden>·</span>
          <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt)}</time>
          {article.confidence === "llm" && (
            <>
              <span aria-hidden>·</span>
              <span
                title="Matched via AI disambiguation"
                className="rounded-full bg-[#EFEDF5] px-1.5 py-0.5 text-[10px] font-medium text-[#544A78]"
              >
                AI match
              </span>
            </>
          )}
          {showDistrictChip && article.districtName && (
            <>
              <span aria-hidden>·</span>
              <span className="truncate rounded-full bg-[#C4E7E6] px-1.5 py-0.5 text-[10px] font-medium text-[#403770]">
                {article.districtName}
              </span>
            </>
          )}
        </div>
      </div>
      <ExternalLink
        aria-hidden
        className="mt-1 h-3.5 w-3.5 shrink-0 text-[#A69DC0] opacity-0 transition-opacity group-hover:opacity-100"
      />
    </a>
  );
}

export function NewsCardCompact({ article, className }: { article: NewsArticleDto; className?: string }) {
  const sourceDomain = article.source.replace(/^www\./, "");
  return (
    <a
      href={article.url}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "block rounded-lg border border-[#E2DEEC] bg-white px-2.5 py-2 transition-colors",
        "hover:bg-[#F7F5FA] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#403770]",
        className
      )}
    >
      <h5 className="line-clamp-2 text-xs font-medium text-[#403770]">{article.title}</h5>
      <div className="mt-1 text-[10px] text-[#8A80A8]">
        {sourceDomain} · <time dateTime={article.publishedAt}>{timeAgo(article.publishedAt)}</time>
      </div>
    </a>
  );
}
