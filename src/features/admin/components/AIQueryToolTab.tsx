"use client";

import { Fragment, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { AlertCircle, ChevronRight, RefreshCcw } from "lucide-react";
import ConversationDetail from "./ai-query/ConversationDetail";

type Scope = "7d" | "30d" | "90d" | "all";

interface CostSummary {
  scope: Scope;
  totalTurns: number;
  totalCost: number;
  avgCostPerTurn: number;
  totalInput: number;
  totalOutput: number;
  totalCacheWrite: number;
  totalCacheRead: number;
  cacheHitPct: number;
  wastedCost: number;
  wastedTurns: number;
  wastedPct: number;
  byPosition: Array<{
    position: number;
    n: number;
    avgCost: number;
    avgInput: number;
    avgOutput: number;
    avgCacheWrite: number;
    avgCacheRead: number;
  }>;
  topExpensiveTurns: Array<{
    id: number;
    conversationId: string | null;
    question: string;
    cost: number;
    events: number;
    rowCount: number | null;
    hasError: boolean;
    createdAt: string;
  }>;
  topExpensiveConversations: Array<{
    conversationId: string;
    turns: number;
    cost: number;
    firstQuestion: string;
    lastActivity: string;
  }>;
}

interface ConversationRow {
  conversationId: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  turnCount: number;
  totalCost: number;
  hasError: boolean;
  firstQuestion: string;
  lastActivity: string;
}

interface ConversationListResponse {
  rows: ConversationRow[];
  page: number;
  pageSize: number;
  total: number;
  scope: Scope;
}

const SCOPE_LABELS: Record<Scope, string> = {
  "7d": "Last 7 days",
  "30d": "Last 30 days",
  "90d": "Last 90 days",
  all: "All time",
};

const SCOPES: Scope[] = ["7d", "30d", "90d", "all"];

function fmtUSD(n: number, fractionDigits = 2): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: fractionDigits,
    maximumFractionDigits: fractionDigits,
  })}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function relativeTime(date: string | null): string {
  if (!date) return "—";
  const diff = Date.now() - new Date(date).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  return `${days}d ago`;
}

function ScopePicker({ value, onChange }: { value: Scope; onChange: (s: Scope) => void }) {
  return (
    <div className="inline-flex items-center bg-[#F7F5FA] border border-[#D4CFE2] rounded-lg p-0.5">
      {SCOPES.map((s) => (
        <button
          key={s}
          onClick={() => onChange(s)}
          className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-colors duration-100 whitespace-nowrap ${
            value === s
              ? "bg-white text-[#403770] shadow-sm"
              : "text-[#8A80A8] hover:text-[#403770]"
          }`}
        >
          {SCOPE_LABELS[s]}
        </button>
      ))}
    </div>
  );
}

interface KPICardProps {
  accent: string;
  label: string;
  value: string;
  subtitle: string;
}

function KPICard({ accent, label, value, subtitle }: KPICardProps) {
  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden">
      <div
        className="absolute left-0 top-0 bottom-0 w-[3px]"
        style={{ backgroundColor: accent }}
      />
      <div className="text-[11px] text-[#8A80A8] font-semibold uppercase tracking-wider whitespace-nowrap">
        {label}
      </div>
      <div className="text-xl font-bold text-[#403770] mt-1 tabular-nums whitespace-nowrap">
        {value}
      </div>
      <div className="text-[11px] text-[#A69DC0] mt-0.5 whitespace-nowrap">
        {subtitle}
      </div>
    </div>
  );
}

function KPICardSkeleton() {
  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4 relative overflow-hidden">
      <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#E2DEEC]" />
      <div className="h-3 w-20 bg-[#E2DEEC]/60 rounded animate-pulse mb-2" />
      <div className="h-5 w-24 bg-[#E2DEEC]/60 rounded animate-pulse mb-1" />
      <div className="h-3 w-32 bg-[#E2DEEC]/40 rounded animate-pulse" />
    </div>
  );
}

function CostByPositionTable({ rows }: { rows: CostSummary["byPosition"] }) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-[#8A80A8] py-6 text-center">
        No data in this window.
      </div>
    );
  }
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[#8A80A8] border-b border-[#E2DEEC]">
            <th className="px-3 py-2 whitespace-nowrap">Turn</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">N</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Avg cost</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Input</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Output</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Cache write</th>
            <th className="px-3 py-2 text-right whitespace-nowrap">Cache read</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.position} className="border-b border-[#E2DEEC] last:border-0">
              <td className="px-3 py-2 font-semibold text-[#403770] whitespace-nowrap">
                #{r.position}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#6E6390]">
                {r.n}
              </td>
              <td className="px-3 py-2 text-right tabular-nums font-medium text-[#403770]">
                {fmtUSD(r.avgCost, 4)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#6E6390]">
                {fmtTokens(r.avgInput)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#6E6390]">
                {fmtTokens(r.avgOutput)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#6E6390]">
                {fmtTokens(r.avgCacheWrite)}
              </td>
              <td className="px-3 py-2 text-right tabular-nums text-[#6E6390]">
                {fmtTokens(r.avgCacheRead)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function TopExpensiveTurnsList({ rows }: { rows: CostSummary["topExpensiveTurns"] }) {
  if (rows.length === 0) {
    return (
      <div className="text-xs text-[#8A80A8] py-6 text-center">
        No data in this window.
      </div>
    );
  }
  return (
    <ul className="divide-y divide-[#E2DEEC]">
      {rows.map((t) => (
        <li key={t.id} className="py-2.5 flex items-start gap-3">
          <div className="text-sm font-semibold text-[#403770] tabular-nums shrink-0 w-16">
            {fmtUSD(t.cost, 4)}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-sm text-[#544A78] truncate">{t.question}</div>
            <div className="text-[11px] text-[#8A80A8] mt-0.5 flex items-center gap-2 whitespace-nowrap">
              <span>{t.events} events</span>
              <span className="text-[#D4CFE2]">·</span>
              <span>{t.rowCount ?? 0} rows</span>
              <span className="text-[#D4CFE2]">·</span>
              <span>{relativeTime(t.createdAt)}</span>
              {t.hasError && (
                <>
                  <span className="text-[#D4CFE2]">·</span>
                  <span className="inline-flex items-center gap-1 text-[#c25a52] font-semibold">
                    <AlertCircle className="w-3 h-3" /> error
                  </span>
                </>
              )}
            </div>
          </div>
        </li>
      ))}
    </ul>
  );
}

interface ConversationsTableProps {
  rows: ConversationRow[];
  isLoading: boolean;
  expandedId: string | null;
  onToggleExpand: (id: string) => void;
}

function ConversationsTable({
  rows,
  isLoading,
  expandedId,
  onToggleExpand,
}: ConversationsTableProps) {
  if (isLoading && rows.length === 0) {
    return (
      <div className="space-y-2 p-4">
        {[...Array(5)].map((_, i) => (
          <div key={i} className="h-10 bg-[#E2DEEC]/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (rows.length === 0) {
    return (
      <div className="text-center text-sm text-[#8A80A8] py-12">
        No conversations in this window.
      </div>
    );
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="text-left text-xs font-semibold uppercase tracking-wider text-[#8A80A8] border-b border-[#E2DEEC] bg-[#F7F5FA]">
            <th className="px-3 py-2.5 w-8" />
            <th className="px-3 py-2.5">First question</th>
            <th className="px-3 py-2.5 whitespace-nowrap">User</th>
            <th className="px-3 py-2.5 text-right whitespace-nowrap">Turns</th>
            <th className="px-3 py-2.5 text-right whitespace-nowrap">Cost</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Last activity</th>
            <th className="px-3 py-2.5 whitespace-nowrap">Status</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => {
            const isExpanded = expandedId === c.conversationId;
            return (
              <Fragment key={c.conversationId}>
                <tr
                  onClick={() => onToggleExpand(c.conversationId)}
                  className={`border-b border-[#E2DEEC] cursor-pointer transition-colors duration-100 ${
                    isExpanded ? "bg-[#EFEDF5]" : "hover:bg-[#F7F5FA]"
                  }`}
                >
                  <td className="px-3 py-2.5">
                    <ChevronRight
                      className={`w-4 h-4 text-[#8A80A8] transition-transform duration-150 ${
                        isExpanded ? "rotate-90" : ""
                      }`}
                    />
                  </td>
                  <td className="px-3 py-2.5 text-[#544A78] max-w-md truncate">
                    {c.firstQuestion}
                  </td>
                  <td className="px-3 py-2.5 text-[#6E6390] whitespace-nowrap">
                    {c.userName ?? c.userEmail ?? c.userId.slice(0, 8)}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums text-[#6E6390]">
                    {c.turnCount}
                  </td>
                  <td className="px-3 py-2.5 text-right tabular-nums font-medium text-[#403770]">
                    {fmtUSD(c.totalCost, 4)}
                  </td>
                  <td className="px-3 py-2.5 text-[#8A80A8] whitespace-nowrap">
                    {relativeTime(c.lastActivity)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    {c.hasError ? (
                      <span className="inline-flex items-center gap-1 px-2 py-0.5 text-xs font-medium rounded-full bg-[#F37167]/15 text-[#c25a52]">
                        <AlertCircle className="w-3 h-3" /> error
                      </span>
                    ) : (
                      <span className="inline-flex px-2 py-0.5 text-xs font-medium rounded-full bg-[#EDFFE3] text-[#5f665b]">
                        ok
                      </span>
                    )}
                  </td>
                </tr>
                {isExpanded && (
                  <tr className="bg-[#FFFCFA]">
                    <td colSpan={7} className="px-4 py-4 border-b border-[#E2DEEC]">
                      <ConversationDetail conversationId={c.conversationId} />
                    </td>
                  </tr>
                )}
              </Fragment>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

export default function AIQueryToolTab() {
  const [scope, setScope] = useState<Scope>("30d");
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const summary = useQuery<CostSummary>({
    queryKey: ["admin-ai-query-summary", scope],
    queryFn: async () => {
      const res = await fetch(`/api/admin/ai-query/cost-summary?scope=${scope}`);
      if (!res.ok) throw new Error("Failed to load cost summary");
      return res.json();
    },
    staleTime: 60_000,
  });

  const convos = useQuery<ConversationListResponse>({
    queryKey: ["admin-ai-query-conversations", scope, search, page],
    queryFn: async () => {
      const url = new URL("/api/admin/ai-query/conversations", window.location.origin);
      url.searchParams.set("scope", scope);
      url.searchParams.set("page", String(page));
      url.searchParams.set("page_size", "25");
      if (search) url.searchParams.set("search", search);
      const res = await fetch(url.toString());
      if (!res.ok) throw new Error("Failed to load conversations");
      return res.json();
    },
    staleTime: 60_000,
  });

  const totalPages = useMemo(
    () => (convos.data ? Math.max(1, Math.ceil(convos.data.total / convos.data.pageSize)) : 1),
    [convos.data],
  );

  return (
    <div className="space-y-6">
      {/* Header row: scope picker + refresh */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <h2 className="text-lg font-semibold text-[#403770]">AI Query Tool usage</h2>
          <p className="text-sm text-[#8A80A8] mt-0.5">
            Cost analysis and chat history for the Reports tool.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <ScopePicker value={scope} onChange={setScope} />
          <button
            onClick={() => {
              summary.refetch();
              convos.refetch();
            }}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D4CFE2] text-[#544A78] bg-white hover:border-[#403770]/30 transition-colors duration-100"
          >
            <RefreshCcw className="w-3 h-3" /> Refresh
          </button>
        </div>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {summary.isLoading || !summary.data ? (
          <>
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
            <KPICardSkeleton />
          </>
        ) : (
          <>
            <KPICard
              accent="#403770"
              label="Total spend"
              value={fmtUSD(summary.data.totalCost)}
              subtitle={`${summary.data.totalTurns} turns ${SCOPE_LABELS[scope].toLowerCase()}`}
            />
            <KPICard
              accent="#6EA3BE"
              label="Avg / turn"
              value={fmtUSD(summary.data.avgCostPerTurn, 4)}
              subtitle={`${fmtTokens(summary.data.totalInput + summary.data.totalCacheRead)} input incl. cache`}
            />
            <KPICard
              accent="#8AC670"
              label="Cache hit rate"
              value={`${summary.data.cacheHitPct.toFixed(1)}%`}
              subtitle={`${fmtTokens(summary.data.totalCacheRead)} served from cache`}
            />
            <KPICard
              accent="#F37167"
              label="Wasted on failures"
              value={fmtUSD(summary.data.wastedCost)}
              subtitle={`${summary.data.wastedTurns} failed turns (${summary.data.wastedPct.toFixed(1)}%)`}
            />
          </>
        )}
      </div>

      {/* Two-column: cost-by-position + top expensive turns */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4">
          <h3 className="text-sm font-semibold text-[#403770] mb-1">
            Cost by turn position
          </h3>
          <p className="text-xs text-[#8A80A8] mb-3">
            Cold start (turn 1) is typically twice as expensive as follow-ups.
          </p>
          {summary.isLoading || !summary.data ? (
            <div className="h-48 bg-[#E2DEEC]/30 rounded animate-pulse" />
          ) : (
            <CostByPositionTable rows={summary.data.byPosition} />
          )}
        </div>
        <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4">
          <h3 className="text-sm font-semibold text-[#403770] mb-1">
            Top 10 most expensive turns
          </h3>
          <p className="text-xs text-[#8A80A8] mb-3">
            Single-turn cost outliers — usually deep exploration or failed retries.
          </p>
          {summary.isLoading || !summary.data ? (
            <div className="h-48 bg-[#E2DEEC]/30 rounded animate-pulse" />
          ) : (
            <TopExpensiveTurnsList rows={summary.data.topExpensiveTurns} />
          )}
        </div>
      </div>

      {/* Conversations inspector */}
      <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm overflow-hidden">
        <div className="p-4 border-b border-[#E2DEEC] flex items-center justify-between gap-4 flex-wrap">
          <div>
            <h3 className="text-sm font-semibold text-[#403770]">Conversations</h3>
            <p className="text-xs text-[#8A80A8] mt-0.5">
              Click a row to inspect every turn — questions, replies, SQL, tools, tokens, errors.
            </p>
          </div>
          <input
            type="search"
            placeholder="Search questions..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
            className="px-3 py-1.5 text-sm rounded-lg border border-[#C2BBD4] bg-white focus:outline-none focus:border-[#403770] focus:ring-2 focus:ring-[#403770]/10 w-64"
          />
        </div>
        <ConversationsTable
          rows={convos.data?.rows ?? []}
          isLoading={convos.isLoading}
          expandedId={expandedId}
          onToggleExpand={(id) => setExpandedId((cur) => (cur === id ? null : id))}
        />
        {convos.data && convos.data.total > convos.data.pageSize && (
          <div className="p-3 flex items-center justify-between border-t border-[#E2DEEC] bg-[#F7F5FA]">
            <div className="text-xs text-[#8A80A8] whitespace-nowrap">
              Page {page} of {totalPages} ({convos.data.total} total)
            </div>
            <div className="flex items-center gap-2">
              <button
                disabled={page <= 1}
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D4CFE2] text-[#544A78] bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#403770]/30 transition-colors duration-100"
              >
                Previous
              </button>
              <button
                disabled={page >= totalPages}
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                className="px-3 py-1.5 text-xs font-semibold rounded-lg border border-[#D4CFE2] text-[#544A78] bg-white disabled:opacity-50 disabled:cursor-not-allowed hover:border-[#403770]/30 transition-colors duration-100"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
