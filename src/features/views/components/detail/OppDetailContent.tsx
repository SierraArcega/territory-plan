"use client";

/**
 * OppDetailContent — body for `kind === 'opp'`.
 *
 * Data source: `useEntity('opp', id)` → GET /api/opportunities/[id] from
 * Phase A. Returns the full Opportunity row + joined district.
 *
 * Prototype fidelity vs. API gap notes:
 *   - "Confidence" — no first-class field exists on Opportunity today. We
 *     render `—`. The prototype shows values like "High"/"Medium" derived
 *     from sample data only.
 *   - "Notes" — the schema has no free-form opportunity notes field. We
 *     show a placeholder card. v1.1 should either add a notes column or
 *     surface the most recent activity body here.
 *   - Stage history items come from `stageHistory` (JSON column) — we
 *     render up to the last 3 transitions when present.
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

interface OppApiResponse {
  id: string;
  name: string | null;
  stage: string | null;
  netBookingAmount: number | null;
  closeDate: string | null;
  salesRepName: string | null;
  districtName: string | null;
  district: { leaid: string; name: string } | null;
  stageHistory?: unknown;
}

interface StageHistoryEntry {
  stage: string;
  enteredAt?: string | null;
  durationDays?: number | null;
}

function isOppApiResponse(value: unknown): value is OppApiResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "string";
}

function parseStageHistory(value: unknown): StageHistoryEntry[] {
  if (!Array.isArray(value)) return [];
  return value
    .filter((e): e is Record<string, unknown> => !!e && typeof e === "object")
    .map((e) => ({
      stage: typeof e.stage === "string" ? e.stage : "Unknown",
      enteredAt: typeof e.enteredAt === "string" ? e.enteredAt : null,
      durationDays:
        typeof e.durationDays === "number" ? e.durationDays : null,
    }));
}

interface Props {
  id: string;
  onClose: () => void;
}

export default function OppDetailContent({ id, onClose }: Props) {
  const q = useEntity("opp", id);
  const data = isOppApiResponse(q.data) ? q.data : null;

  const stagePill = lookupStagePill(data?.stage);
  const districtLabel =
    data?.district?.name ?? data?.districtName ?? "—";

  const arr =
    data?.netBookingAmount != null
      ? formatMoneyCompact(data.netBookingAmount)
      : "—";

  const closeDate = data?.closeDate
    ? formatDateShort(data.closeDate)
    : "—";

  const history = parseStageHistory(data?.stageHistory);

  return (
    <>
      <DetailPanelHeader
        eyebrow="Opportunity"
        title={data?.name ?? "Loading…"}
        meta={
          <>
            <Pill bg={stagePill.bg} fg={stagePill.fg}>
              {data?.stage ?? "—"}
            </Pill>
            <span className="text-[11px] text-[#8A80A8] truncate">
              {districtLabel}
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
        <PanelError message="Opportunity not found." />
      ) : (
        <PanelBody>
          <StatsGrid>
            <Stat label="ARR" value={arr} />
            <Stat label="Close" value={closeDate} />
            <Stat label="Owner" value={data.salesRepName ?? "—"} />
            <Stat label="Confidence" value="—" />
          </StatsGrid>

          <Section label="Notes">
            <NoteBlock>
              {/*
               * No notes field on Opportunity today — surface a clear
               * placeholder rather than fake content so reps don't expect
               * editable notes to round-trip.
               */}
              <span className="text-[#8A80A8]">
                Notes will appear here when added to the opportunity record.
              </span>
            </NoteBlock>
          </Section>

          <Section label="Stage history">
            {history.length === 0 ? (
              <Item
                title={data.stage ?? "—"}
                sub="Current stage · history not recorded yet"
                last
              />
            ) : (
              <div className="flex flex-col">
                {history.slice(-3).map((h, i, arr) => (
                  <Item
                    key={`${h.stage}-${i}`}
                    title={h.stage}
                    sub={
                      h.enteredAt
                        ? `${formatDateShort(h.enteredAt)}${
                            h.durationDays != null
                              ? ` · ${h.durationDays} days`
                              : ""
                          }`
                        : h.durationDays != null
                          ? `${h.durationDays} days`
                          : "—"
                    }
                    last={i === arr.length - 1}
                  />
                ))}
              </div>
            )}
          </Section>
        </PanelBody>
      )}
    </>
  );
}

// ── Local formatters — kept here to avoid widening the shared lib surface ──

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
