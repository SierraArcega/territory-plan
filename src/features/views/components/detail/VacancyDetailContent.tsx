"use client";

/**
 * VacancyDetailContent — body for `kind === 'vacancy'`.
 *
 * Data source: `useEntity('vacancy', id)` → GET /api/vacancies/[id] (predates
 * Phase A — returns the vacancy + joined district + school).
 *
 * Prototype fidelity vs. API gap notes:
 *   - "Why it matters" — the prototype shows a hand-written narrative card.
 *     We don't have an AI-generated context blurb on Vacancy yet; we render
 *     a generic explanation that's accurate for any leadership-transition
 *     vacancy. v1.1 should hydrate this from the per-vacancy `notes` field
 *     or a derived signal blurb.
 *   - "Signal" pill — Vacancy schema has no first-class signal level today;
 *     we infer high/med/low from category + status (admin + open = high,
 *     specialist/open = med, anything else = low). Best-effort heuristic.
 *   - Suggested action buttons render as items per prototype; onClicks are
 *     stubs (alert in dev). Wiring goes through v1.1's task/watchlist flow.
 */
import { MapPin } from "lucide-react";
import { useEntity } from "../../lib/queries";
import DetailPanelHeader from "./DetailPanelHeader";
import {
  PanelBody,
  PanelBodySkeleton,
  PanelError,
  Section,
  Stat,
  StatsGrid,
  Item,
  NoteBlock,
  Pill,
} from "./atoms";

interface VacancyApiResponse {
  id: string;
  title: string | null;
  category: string | null;
  status: string | null;
  notes: string | null;
  postedDate: string | null;
  leaid: string | null;
  districtName: string | null;
  schoolName: string | null;
}

function isVacancyApiResponse(value: unknown): value is VacancyApiResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string";
}

const SIGNAL = {
  high: { bg: "#FEF2F1", fg: "#c25a52", label: "High signal" },
  med: { bg: "#FFF6DD", fg: "#7d6d3a", label: "Med signal" },
  low: { bg: "#EFEDF5", fg: "#6f6786", label: "Low signal" },
} as const;

function inferSignal(
  category: string | null | undefined,
  status: string | null | undefined,
): keyof typeof SIGNAL {
  // Best-effort mapping; documented in the file header.
  if (status?.toLowerCase() === "closed") return "low";
  if (!category) return "low";
  const c = category.toLowerCase();
  if (c === "admin") return "high";
  if (c === "specialist" || c === "counseling") return "med";
  return "low";
}

interface Props {
  id: string;
  onClose: () => void;
}

export default function VacancyDetailContent({ id, onClose }: Props) {
  const q = useEntity("vacancy", id);
  const data = isVacancyApiResponse(q.data) ? q.data : null;

  const signalKey = inferSignal(data?.category, data?.status);
  const sig = SIGNAL[signalKey];

  const postedLabel = data?.postedDate
    ? formatDateShort(data.postedDate)
    : "—";

  return (
    <>
      <DetailPanelHeader
        eyebrowIcon={<MapPin className="w-2.5 h-2.5" aria-hidden />}
        eyebrow={`Vacancy${data?.districtName ? ` · ${data.districtName}` : ""}`}
        title={data?.title ?? "Loading…"}
        meta={
          <>
            <Pill bg={sig.bg} fg={sig.fg}>
              {sig.label}
            </Pill>
            <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">
              Posted {postedLabel}
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
        <PanelError message="Vacancy not found." />
      ) : (
        <PanelBody>
          <Section label="Why it matters">
            <NoteBlock>
              {data.notes ??
                "Leadership transitions often trigger budget reviews and vendor reassessment within 90 days."}
            </NoteBlock>
          </Section>

          <StatsGrid>
            <Stat label="Status" value={data.status ?? "—"} />
            <Stat label="Posted" value={postedLabel} />
          </StatsGrid>

          <Section label="Suggested actions">
            <div className="flex flex-col">
              <Item
                title="Add to watchlist"
                sub="Track when this role gets filled"
              />
              <Item
                title="Brief account owner"
                sub={
                  data.districtName
                    ? `Notify ${data.districtName} owner`
                    : "Notify district owner"
                }
              />
              <Item
                title="Set follow-up"
                sub="Re-engage in 30 days"
                last
              />
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
