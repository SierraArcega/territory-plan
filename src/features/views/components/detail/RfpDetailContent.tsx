"use client";

/**
 * RfpDetailContent — body for `kind === 'rfp'`.
 *
 * Data source: `useEntity('rfp', id)` → GET /api/rfps/[id] from Phase A.
 * Returns the RFP row + joined district.
 *
 * Prototype fidelity vs. API gap notes:
 *   - "Value" — we prefer `valueHigh`, fall back to `valueLow`, render `—`
 *     when both null. Prototype shows a single value figure.
 *   - "Scope" — we render `aiSummary` first (the AI blurb), then
 *     `description` (full RFP text), then a generic fallback.
 *   - Category — taken from `oppType.description` or first keyword. Best
 *     effort; some RFPs have null oppType. Falls back to "RFP".
 *   - Suggested actions are stub buttons matching the prototype's wording.
 */
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
  lookupStagePill,
} from "./atoms";

interface RfpApiResponse {
  id: number;
  title: string | null;
  aiSummary: string | null;
  description: string | null;
  agencyName: string | null;
  status: string | null;
  oppType: { description?: string | null } | null;
  keywords: string[] | null;
  postedDate: string | null;
  dueDate: string | null;
  valueLow: number | null;
  valueHigh: number | null;
  district: {
    leaid: string;
    name: string;
    stateAbbrev: string | null;
  } | null;
}

function isRfpApiResponse(value: unknown): value is RfpApiResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "number";
}

interface Props {
  id: string;
  onClose: () => void;
}

export default function RfpDetailContent({ id, onClose }: Props) {
  const q = useEntity("rfp", id);
  const data = isRfpApiResponse(q.data) ? q.data : null;

  const statusPill = lookupStagePill(data?.status ?? "open");
  const district = data?.district ?? null;
  const value =
    data?.valueHigh != null
      ? formatMoneyCompact(data.valueHigh)
      : data?.valueLow != null
        ? formatMoneyCompact(data.valueLow)
        : "—";
  const category =
    data?.oppType?.description ??
    data?.keywords?.[0] ??
    "RFP";

  const scope =
    data?.aiSummary ??
    data?.description ??
    (data?.title
      ? `District is soliciting proposals for ${data.title.toLowerCase()}. Submission window closes ${
          data.dueDate ? formatDateShort(data.dueDate) : "soon"
        }.`
      : "Scope details unavailable.");

  return (
    <>
      <DetailPanelHeader
        eyebrow={`RFP${district?.name ? ` · ${district.name}` : data?.agencyName ? ` · ${data.agencyName}` : ""}`}
        title={data?.title ?? "Loading…"}
        meta={
          <>
            <Pill bg={statusPill.bg} fg={statusPill.fg}>
              {data?.status ?? "Open"}
            </Pill>
            <Pill bg="#EFEDF5" fg="#6f6786">
              {category}
            </Pill>
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
        <PanelError message="RFP not found." />
      ) : (
        <PanelBody>
          <StatsGrid>
            <Stat
              label="Posted"
              value={data.postedDate ? formatDateShort(data.postedDate) : "—"}
            />
            <Stat
              label="Due"
              value={data.dueDate ? formatDateShort(data.dueDate) : "—"}
            />
            <Stat label="Value" value={value} />
            <Stat label="Status" value={data.status ?? "—"} />
          </StatsGrid>

          <Section label="Scope">
            <NoteBlock>{scope}</NoteBlock>
          </Section>

          <Section label="Suggested actions">
            <div className="flex flex-col">
              <Item
                title="Convert to opportunity"
                sub={`${value} potential ARR`}
              />
              <Item
                title="Assign to RFP team"
                sub="Notify proposals owner"
              />
              <Item
                title="Calendar reminder"
                sub={
                  data.dueDate
                    ? `3 days before ${formatDateShort(data.dueDate)}`
                    : "Set a reminder"
                }
                last
              />
            </div>
          </Section>
        </PanelBody>
      )}
    </>
  );
}

function formatMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}

function formatDateShort(isoDate: string): string {
  const d = new Date(isoDate);
  if (Number.isNaN(d.getTime())) return "—";
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}
