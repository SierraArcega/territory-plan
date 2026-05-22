"use client";

/**
 * DistrictDetailContent — body for `kind === 'district'`.
 *
 * Data source: `useEntity('district', leaid)` → GET /api/districts/[leaid]
 * (the long-standing detail endpoint shared with the legacy DistrictDetailPanel).
 *
 * Prototype fidelity vs. API gap notes:
 *   - ARR / Pipeline / Renewal come from CRM fields that may be null on
 *     non-customer districts. We render `—` for any missing value, which
 *     matches the prototype's pattern for districts with no Fullmind data.
 *   - "Recent activity" — the API response does NOT include activity items
 *     (the legacy DistrictDetailPanel mounts a separate ActivityTimeline
 *     component that re-queries). For v1 we render a "View full activity"
 *     CTA pointing to the legacy panel rather than re-implementing the feed.
 *   - Contacts / Pipeline / Activity tabs render placeholder text + a "View
 *     full district" link to the legacy district page — duplicating those
 *     full surfaces in a 380px panel is out-of-scope for D2 per the brief.
 */
import { useMemo, useState } from "react";
import { MapPin } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { useEntity } from "../../lib/queries";
import { useMapV2Store } from "@/features/map/lib/store";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import DetailPanelHeader from "./DetailPanelHeader";
import DetailPanelTabs, { type DistrictDetailTab } from "./DetailPanelTabs";
import {
  PanelBody,
  PanelBodySkeleton,
  PanelError,
  Section,
  Stat,
  StatsGrid,
  Item,
  Pill,
  lookupStagePill,
} from "./atoms";

interface DistrictApiResponse {
  district: {
    leaid: string;
    name: string;
    stateAbbrev: string | null;
    enrollment: number | null;
    numberOfSchools: number | null;
    schoolCount?: number | null;
    accountType?: string | null;
  } | null;
  fullmindData: {
    leaid: string;
    accountName: string | null;
    isCustomer: boolean | null;
    hasOpenPipeline: boolean | null;
    districtFinancials: Array<{
      netBookingAmount?: number | string | null;
      schoolYr?: string | null;
      contractThrough?: string | null;
      contractType?: string | null;
    }> | null;
  } | null;
  contacts?: Array<{
    id: number;
    name: string;
    title: string | null;
    email: string | null;
    phone: string | null;
    isPrimary: boolean;
  }> | null;
}

function isDistrictApiResponse(value: unknown): value is DistrictApiResponse {
  if (!value || typeof value !== "object") return false;
  return "district" in (value as Record<string, unknown>);
}

interface Props {
  id: string;
  onClose: () => void;
}

export default function DistrictDetailContent({ id, onClose }: Props) {
  const q = useEntity("district", id);
  const [tab, setTab] = useState<DistrictDetailTab>("overview");
  const [logOpen, setLogOpen] = useState(false);
  // Current plan context (set when viewing a plan's grid) — pre-associates the
  // logged activity with "the plan I'm in". Null on list views (no plan scope).
  const viewsPlanId = useMapV2Store((s) => s.viewsPlanId);
  const qc = useQueryClient();

  const data = isDistrictApiResponse(q.data) ? q.data : null;
  const district = data?.district ?? null;
  const fullmind = data?.fullmindData ?? null;
  const contacts = data?.contacts ?? [];

  // Pick the primary contact (or first by isPrimary if none flagged).
  const primary = useMemo(() => {
    if (!contacts.length) return null;
    return contacts.find((c) => c.isPrimary) ?? contacts[0];
  }, [contacts]);

  const stage = useMemo(() => {
    // Map customer status → prototype's stage labels.
    if (!fullmind) return "Prospect";
    if (fullmind.isCustomer) return "Customer";
    if (fullmind.hasOpenPipeline) return "Prospect";
    return "Prospect";
  }, [fullmind]);

  const arr = useMemo(() => {
    const fin = fullmind?.districtFinancials?.[0];
    if (!fin || fin.netBookingAmount == null) return "—";
    const n = Number(fin.netBookingAmount);
    if (!Number.isFinite(n)) return "—";
    return formatMoneyCompact(n);
  }, [fullmind]);

  const schools =
    district?.schoolCount ?? district?.numberOfSchools ?? null;

  const renewal = useMemo(() => {
    const fin = fullmind?.districtFinancials?.[0];
    return fin?.contractThrough ?? "—";
  }, [fullmind]);

  const stagePill = lookupStagePill(stage);

  return (
    <>
      <DetailPanelHeader
        eyebrowIcon={<MapPin className="w-2.5 h-2.5" aria-hidden />}
        eyebrow={
          district
            ? `${district.stateAbbrev ?? ""} · District`.trim()
            : "District"
        }
        title={district?.name ?? "Loading…"}
        meta={
          <>
            <Pill bg={stagePill.bg} fg={stagePill.fg}>
              {stage}
            </Pill>
            {district?.enrollment != null ? (
              <span className="text-[11px] text-[#8A80A8] whitespace-nowrap">
                · {district.enrollment.toLocaleString()} students
              </span>
            ) : null}
          </>
        }
        onClose={onClose}
        onPrimaryAction={() => setLogOpen(true)}
        secondaryActionLabel="Add to list"
      />

      <DetailPanelTabs active={tab} onSelect={setTab} />

      {q.isLoading ? (
        <PanelBodySkeleton />
      ) : q.isError ? (
        <PanelError
          message={q.error?.message ?? "Network error"}
          onRetry={() => q.refetch()}
        />
      ) : !district ? (
        <PanelError message="District not found." />
      ) : tab === "overview" ? (
        <PanelBody>
          <StatsGrid>
            <Stat label="ARR" value={arr} />
            <Stat label="Pipeline" value="—" />
            <Stat label="Schools" value={schools != null ? schools : "—"} />
            <Stat label="Renewal" value={renewal} />
          </StatsGrid>

          <Section label="Primary contact">
            {primary ? (
              <PrimaryContactCard
                name={primary.name}
                role={primary.title ?? "—"}
              />
            ) : (
              <div className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg text-xs text-[#8A80A8]">
                No primary contact on file.
              </div>
            )}
          </Section>

          <Section label="Recent activity">
            <div className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg text-xs text-[#8A80A8]">
              Activity timeline lives on the full district page.{" "}
              <a
                href={`/?leaid=${encodeURIComponent(district.leaid)}`}
                className="text-[#403770] font-semibold underline"
              >
                View full district
              </a>
            </div>
          </Section>
        </PanelBody>
      ) : tab === "contacts" ? (
        <PanelBody>
          <Section label="Contacts">
            {contacts.length === 0 ? (
              <div className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg text-xs text-[#8A80A8]">
                No contacts on file.
              </div>
            ) : (
              <div className="flex flex-col">
                {contacts.slice(0, 5).map((c, i) => (
                  <Item
                    key={c.id}
                    title={c.name}
                    sub={c.title ?? "—"}
                    last={i === Math.min(contacts.length, 5) - 1}
                  />
                ))}
              </div>
            )}
            <a
              href={`/?leaid=${encodeURIComponent(district.leaid)}`}
              className="text-xs text-[#403770] font-semibold underline mt-1 inline-block"
            >
              View full contact list
            </a>
          </Section>
        </PanelBody>
      ) : tab === "pipeline" ? (
        <PanelBody>
          <div className="p-3.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg text-xs text-[#544A78]">
            Pipeline details surface on the full district page.{" "}
            <a
              href={`/?leaid=${encodeURIComponent(district.leaid)}`}
              className="text-[#403770] font-semibold underline"
            >
              View pipeline
            </a>
          </div>
        </PanelBody>
      ) : (
        <PanelBody>
          <div className="p-3.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg text-xs text-[#544A78]">
            Full activity timeline lives on the district page.{" "}
            <a
              href={`/?leaid=${encodeURIComponent(district.leaid)}`}
              className="text-[#403770] font-semibold underline"
            >
              View activity
            </a>
          </div>
        </PanelBody>
      )}

      <ActivityFormModal
        isOpen={logOpen}
        onClose={() => setLogOpen(false)}
        defaultPlanId={viewsPlanId ?? undefined}
        defaultDistricts={
          district
            ? [{ leaid: district.leaid, name: district.name, stateAbbrev: district.stateAbbrev }]
            : []
        }
        onCreated={() => qc.invalidateQueries({ queryKey: ["views", "data"] })}
      />
    </>
  );
}

// ── Primary contact card — avatar + name + role ──────────────────────────

function PrimaryContactCard({ name, role }: { name: string; role: string }) {
  const initials = name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((s) => s[0]?.toUpperCase() ?? "")
    .join("");
  return (
    <div className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg flex items-center gap-2.5">
      <div className="w-8 h-8 rounded-full bg-[#C4E7E6] flex items-center justify-center text-xs font-semibold text-[#403770] flex-shrink-0">
        {initials || "—"}
      </div>
      <div className="flex-1 min-w-0">
        <div className="text-[13px] font-semibold text-[#403770] truncate">
          {name}
        </div>
        <div className="text-[11px] text-[#8A80A8] truncate">{role}</div>
      </div>
    </div>
  );
}

// ── Local money formatter — keeps imports light, matches prototype output ──

function formatMoneyCompact(n: number): string {
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1).replace(/\.0$/, "")}M`;
  if (n >= 1_000) return `$${Math.round(n / 1_000)}K`;
  return `$${Math.round(n).toLocaleString()}`;
}
