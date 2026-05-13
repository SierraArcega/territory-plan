"use client";

/**
 * NewsDetailContent — body for `kind === 'news'`.
 *
 * Data source: `useEntity('news', id)` → GET /api/news/[id] from Phase A.
 * Returns the article + matched districts (+ confidence) + matched contacts.
 *
 * Prototype fidelity vs. API gap notes:
 *   - "Tag" pill — the prototype shows category-derived pills with custom
 *     bg/fg colors per tag. Our API returns `categories: string[]`; we use
 *     the first category as the pill label and a single neutral plum tint
 *     for color. v1.1 can introduce a category → color map.
 *   - "Summary" — we render the article's `description` (the AI-summarized
 *     blurb) when present, falling back to `content` truncated. If neither
 *     exists, the placeholder copy from the prototype is shown.
 *   - "Related districts in plan" — we just render the joined districts;
 *     the panel doesn't know about the active plan, so we don't filter to
 *     in-plan items. v1.1 can intersect with the current plan's leaid set.
 *   - Suggested actions are stub buttons matching the prototype's wording.
 */
import { useEntity } from "../../lib/queries";
import DetailPanelHeader from "./DetailPanelHeader";
import {
  PanelBody,
  PanelBodySkeleton,
  PanelError,
  Section,
  Item,
  NoteBlock,
  Pill,
} from "./atoms";

interface NewsApiResponse {
  id: string;
  title: string;
  description: string | null;
  content: string | null;
  source: string | null;
  publishedAt: string;
  categories: string[];
  districts: Array<{
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    confidence: string;
  }>;
}

function isNewsApiResponse(value: unknown): value is NewsApiResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string" && typeof v.title === "string";
}

interface Props {
  id: string;
  onClose: () => void;
}

export default function NewsDetailContent({ id, onClose }: Props) {
  const q = useEntity("news", id);
  const data = isNewsApiResponse(q.data) ? q.data : null;

  const firstDistrict = data?.districts?.[0];
  const tag = data?.categories?.[0] ?? "News";

  const summary =
    data?.description ??
    (data?.content
      ? data.content.slice(0, 280) + (data.content.length > 280 ? "…" : "")
      : "Article summary not available yet.");

  const publishedLabel = data?.publishedAt
    ? formatDateShort(data.publishedAt)
    : "—";

  return (
    <>
      <DetailPanelHeader
        eyebrow={`News${firstDistrict?.name ? ` · ${firstDistrict.name}` : ""}`}
        title={data?.title ?? "Loading…"}
        meta={
          <>
            <Pill bg="#EFEDF5" fg="#6f6786">
              {tag}
            </Pill>
            <span className="text-[11px] text-[#8A80A8] whitespace-nowrap truncate">
              {(data?.source ?? "—") + " · " + publishedLabel}
            </span>
          </>
        }
        onClose={onClose}
        secondaryActionLabel="Save"
      />

      {q.isLoading ? (
        <PanelBodySkeleton />
      ) : q.isError ? (
        <PanelError
          message={q.error?.message ?? "Network error"}
          onRetry={() => q.refetch()}
        />
      ) : !data ? (
        <PanelError message="Article not found." />
      ) : (
        <PanelBody>
          <Section label="Summary">
            <NoteBlock>{summary}</NoteBlock>
          </Section>

          <Section label="Related districts">
            {data.districts.length === 0 ? (
              <div className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg text-xs text-[#8A80A8]">
                No districts matched to this article.
              </div>
            ) : (
              <div className="flex flex-col">
                {data.districts.slice(0, 5).map((d, i, arr) => (
                  <Item
                    key={d.leaid}
                    title={d.name}
                    sub={
                      d.stateAbbrev
                        ? `${d.stateAbbrev} · Confidence ${d.confidence}`
                        : `Confidence ${d.confidence}`
                    }
                    last={i === arr.length - 1}
                  />
                ))}
              </div>
            )}
          </Section>

          <Section label="Suggested actions">
            <div className="flex flex-col">
              <Item title="Add to plan brief" sub="Flag for next territory review" />
              <Item title="Share with team" sub="Send to your pod channel" last />
            </div>
          </Section>
        </PanelBody>
      )}
    </>
  );
}

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
