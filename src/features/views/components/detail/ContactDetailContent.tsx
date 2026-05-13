"use client";

/**
 * ContactDetailContent — body for `kind === 'contact'`.
 *
 * Data source: `useEntity('contact', id)` → GET /api/contacts/[id] (the
 * Phase-D-added GET handler that returns the contact + joined district).
 *
 * Prototype fidelity vs. API gap notes:
 *   - Engagement stats (`email_count`, `mtg_count`) and "Last touch" come
 *     from the prototype's sample data. Our schema doesn't aggregate those
 *     metrics today — we render `—` for each. v1.1 should derive these from
 *     Activity / Email Sync once those models stabilize.
 *   - "Recent" items are placeholders — same gap as above.
 */
import { Users } from "lucide-react";
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
  KV,
  Pill,
  lookupStagePill,
} from "./atoms";

interface ContactApiResponse {
  id: number;
  name: string | null;
  title: string | null;
  email: string | null;
  phone: string | null;
  persona: string | null;
  seniorityLevel: string | null;
  district: {
    leaid: string;
    name: string;
    stateAbbrev: string | null;
  } | null;
}

function isContactApiResponse(value: unknown): value is ContactApiResponse {
  if (!value || typeof value !== "object") return false;
  const v = value as Record<string, unknown>;
  return typeof v.id === "number" || typeof v.id === "string";
}

interface Props {
  id: string;
  onClose: () => void;
}

export default function ContactDetailContent({ id, onClose }: Props) {
  const q = useEntity("contact", id);
  const data = isContactApiResponse(q.data) ? q.data : null;

  // Map seniority → tier pill. Best-effort; falls through to "Engaged" pill.
  const tierLabel = data?.persona ?? data?.seniorityLevel ?? "Engaged";
  const tierPill = lookupStagePill(tierLabel);

  return (
    <>
      <DetailPanelHeader
        eyebrowIcon={<Users className="w-2.5 h-2.5" aria-hidden />}
        eyebrow="Contact"
        title={data?.name ?? "Loading…"}
        meta={
          <>
            <Pill bg={tierPill.bg} fg={tierPill.fg}>
              {tierLabel}
            </Pill>
            <span className="text-[11px] text-[#8A80A8] truncate">
              {(data?.title ?? "—") +
                (data?.district?.name ? ` · ${data.district.name}` : "")}
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
        <PanelError message="Contact not found." />
      ) : (
        <PanelBody>
          <Section label="Contact info">
            <div className="flex flex-col">
              <KV k="Email" v={data.email ?? "—"} />
              <KV k="Phone" v={data.phone ?? "—"} />
              <KV k="Last touch" v="—" />
            </div>
          </Section>

          <Section label="Engagement">
            <StatsGrid>
              <Stat label="Emails" value="—" />
              <Stat label="Meetings" value="—" />
            </StatsGrid>
          </Section>

          <Section label="Recent">
            <div className="p-2.5 bg-[#FFFCFA] border border-[#E2DEEC] rounded-lg text-xs text-[#8A80A8]">
              Recent touchpoints will surface here once activity sync is wired
              for contacts.
            </div>
            <Item title="No recent touchpoints" sub="Activity feed coming soon" last />
          </Section>
        </PanelBody>
      )}
    </>
  );
}
