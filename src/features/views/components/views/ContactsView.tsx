"use client";

/**
 * ContactsView — contacts table for the active plan/list district scope.
 *
 * Columns (per prototype `app-unified.jsx::CanvasContactsView`):
 *   - Contact  — 26px avatar + name
 *   - Role     — secondary text
 *   - District — secondary text
 *   - Stage    — pill (Champion green / Engaged blue / Cold red); derived
 *               from a v1 heuristic (engagement model isn't yet in DB).
 *   - Tier
 *   - Last touch (deferred until contact-activity join lands)
 *
 * Data source: `GET /api/contacts?leaids=<csv>&limit=N`. Phase C added the
 * `leaids` query param to that existing route.
 */
import { useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import {
  EmptyState,
  ErrorState,
  FilterHintBanner,
  LoadingState,
  PAGE_SIZE,
  ShowMoreButton,
  ViewScroll,
  leaidsCsv,
  leaidsKey,
} from "./_shared";

interface ContactsViewProps {
  leaids: string[] | null;
}

interface ContactRow {
  id: number;
  leaid: string | null;
  name: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  isPrimary: boolean;
  districtName: string | null;
}

interface ContactsResponse {
  contacts: ContactRow[];
  total: number;
}

const STAGE_PILL: Record<string, { bg: string; fg: string }> = {
  Champion: { bg: "#EDFFE3", fg: "#5f665b" },
  Engaged: { bg: "#e8f1f5", fg: "#4d7285" },
  Cold: { bg: "#FEF2F1", fg: "#c25a52" },
};

/** Best-effort stage label until contact-activity join is wired. */
function deriveStage(c: ContactRow): "Champion" | "Engaged" | "Cold" {
  if (c.isPrimary) return "Champion";
  if (c.email) return "Engaged";
  return "Cold";
}

function initialsOf(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return "?";
  if (parts.length === 1) return parts[0].slice(0, 2).toUpperCase();
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

const TH_CLS =
  "text-[10px] font-semibold uppercase tracking-[0.06em] text-[#8A80A8] py-2.5 px-4 border-b border-[#E2DEEC] text-left whitespace-nowrap";
const TD_CLS = "py-2.5 px-4 border-b border-[#EFEDF5] bg-white";

export default function ContactsView({ leaids }: ContactsViewProps) {
  const [page, setPage] = useState(1);
  const visibleCount = page * PAGE_SIZE;

  const keyTag = leaidsKey(leaids);
  const q = useQuery({
    queryKey: ["views", "contacts", keyTag, visibleCount] as const,
    queryFn: () => {
      const csv = leaidsCsv(leaids);
      return fetchJson<ContactsResponse>(
        `${API_BASE}/contacts?leaids=${encodeURIComponent(csv)}&limit=${visibleCount}`,
      );
    },
    enabled: leaids !== null && leaids.length > 0,
    staleTime: 60 * 1000,
  });

  if (leaids === null || leaids.length === 0) {
    return (
      <EmptyState
        title="No districts in scope"
        hint="Add districts to this plan or list to see their contacts."
      />
    );
  }

  if (q.isLoading) return <LoadingState rows={6} />;
  if (q.isError) {
    return (
      <ErrorState
        message={String(q.error?.message ?? "Could not fetch contacts.")}
        onRetry={() => q.refetch()}
      />
    );
  }

  const rows = q.data?.contacts ?? [];
  const total = q.data?.total ?? rows.length;

  if (rows.length === 0) {
    return (
      <EmptyState
        title="No contacts yet"
        hint="Contacts will appear here once districts in this plan have entries."
      />
    );
  }

  const remaining = Math.max(0, total - rows.length);

  return (
    <ViewScroll>
      <FilterHintBanner total={total} />
      <div className="overflow-x-auto">
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="bg-[#FFFCFA]">
              <th className={TH_CLS}>Contact</th>
              <th className={TH_CLS}>Role</th>
              <th className={TH_CLS}>District</th>
              <th className={TH_CLS}>Stage</th>
              <th className={TH_CLS}>Email</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => {
              const stage = deriveStage(c);
              const stagePill = STAGE_PILL[stage];
              return (
                <tr
                  key={c.id}
                  data-row-kind="contact"
                  data-row-id={String(c.id)}
                  className="hover:bg-[#F7F5FA] cursor-pointer transition-colors duration-100"
                >
                  <td className={TD_CLS}>
                    <div className="flex items-center gap-2.5">
                      <div
                        className="w-[26px] h-[26px] rounded-full bg-[#C4E7E6] flex items-center justify-center flex-shrink-0"
                        aria-hidden
                      >
                        <span className="text-[11px] font-semibold text-[#403770]">
                          {initialsOf(c.name)}
                        </span>
                      </div>
                      <span className="font-semibold text-[#403770] whitespace-nowrap">
                        {c.name}
                      </span>
                    </div>
                  </td>
                  <td className={`${TD_CLS} text-[#544A78] whitespace-nowrap`}>
                    {c.title ?? "—"}
                  </td>
                  <td className={`${TD_CLS} text-[#544A78] whitespace-nowrap`}>
                    {c.districtName ?? "—"}
                  </td>
                  <td className={TD_CLS}>
                    <span
                      className="inline-block px-2 py-0.5 rounded-full text-[11px] font-semibold whitespace-nowrap"
                      style={{ background: stagePill.bg, color: stagePill.fg }}
                    >
                      {stage}
                    </span>
                  </td>
                  <td className={`${TD_CLS} text-[#8A80A8] text-[12px] whitespace-nowrap`}>
                    {c.email ?? "—"}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {remaining > 0 && (
        <ShowMoreButton
          onClick={() => setPage((p) => p + 1)}
          remaining={remaining}
        />
      )}
    </ViewScroll>
  );
}
