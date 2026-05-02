"use client";

import { useQuery } from "@tanstack/react-query";
import { AlertCircle, Code2, MessageSquare, Wrench } from "lucide-react";

interface ConversationTurn {
  id: number;
  createdAt: string;
  question: string;
  assistantText: string | null;
  summarySource: string | null;
  sql: string | null;
  tools: string[];
  eventCount: number;
  rowCount: number | null;
  executionTimeMs: number | null;
  error: string | null;
  tokens: {
    input: number;
    output: number;
    cacheWrite: number;
    cacheRead: number;
  };
  cost: number;
}

interface ConversationDetailResponse {
  conversationId: string;
  userId: string;
  userEmail: string | null;
  userName: string | null;
  turnCount: number;
  totalCost: number;
  turns: ConversationTurn[];
}

function fmtUSD(n: number): string {
  return `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 4,
    maximumFractionDigits: 4,
  })}`;
}

function fmtTokens(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(2)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}k`;
  return n.toLocaleString();
}

function ToolChip({ name }: { name: string }) {
  // Color by category
  const isRunSql = name === "run_sql";
  const isExploration = ["describe_table", "search_metadata", "get_column_values", "sample_rows", "count_rows", "list_tables"].includes(name);
  const cls = isRunSql
    ? "bg-[#403770]/10 text-[#403770] border-[#403770]/20"
    : isExploration
      ? "bg-[#6EA3BE]/15 text-[#4d7285] border-[#6EA3BE]/30"
      : "bg-[#EFEDF5] text-[#544A78] border-[#D4CFE2]";
  return (
    <span
      className={`inline-flex items-center px-2 py-0.5 text-[11px] font-medium rounded-full border ${cls} whitespace-nowrap`}
    >
      {name}
    </span>
  );
}

function TurnCard({ turn, index }: { turn: ConversationTurn; index: number }) {
  return (
    <div className="bg-white rounded-lg border border-[#D4CFE2] shadow-sm p-4">
      {/* Turn header */}
      <div className="flex items-center justify-between gap-3 flex-wrap mb-3">
        <div className="flex items-center gap-2 whitespace-nowrap">
          <span className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8]">
            Turn {index + 1}
          </span>
          <span className="text-[#D4CFE2]">·</span>
          <span className="text-xs text-[#8A80A8]">
            {new Date(turn.createdAt).toLocaleString()}
          </span>
        </div>
        <div className="flex items-center gap-3 text-xs whitespace-nowrap">
          <span className="text-[#6E6390]">
            <span className="font-semibold text-[#403770] tabular-nums">
              {fmtUSD(turn.cost)}
            </span>
            <span className="text-[#A69DC0] ml-1">cost</span>
          </span>
          <span className="text-[#D4CFE2]">·</span>
          <span className="text-[#6E6390] tabular-nums">
            {fmtTokens(turn.tokens.input)} in / {fmtTokens(turn.tokens.output)} out
          </span>
          {(turn.tokens.cacheWrite > 0 || turn.tokens.cacheRead > 0) && (
            <>
              <span className="text-[#D4CFE2]">·</span>
              <span className="text-[#6E6390] tabular-nums">
                {fmtTokens(turn.tokens.cacheWrite)} cw / {fmtTokens(turn.tokens.cacheRead)} cr
              </span>
            </>
          )}
        </div>
      </div>

      {/* User question */}
      <div className="mb-3">
        <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] mb-1">
          <MessageSquare className="w-3 h-3" /> Question
        </div>
        <div className="text-sm text-[#403770] bg-[#F7F5FA] rounded-lg p-3 border border-[#E2DEEC]">
          {turn.question}
        </div>
      </div>

      {/* Assistant text */}
      {turn.assistantText && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] mb-1">
            <MessageSquare className="w-3 h-3" /> Assistant reply
          </div>
          <div className="text-sm text-[#544A78] bg-white rounded-lg p-3 border border-[#E2DEEC] whitespace-pre-wrap">
            {turn.assistantText}
          </div>
        </div>
      )}

      {/* Source / summary */}
      {turn.summarySource && (
        <div className="mb-3">
          <div className="text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] mb-1">
            Source label shown to user
          </div>
          <div className="text-sm text-[#544A78] italic">{turn.summarySource}</div>
        </div>
      )}

      {/* Tools called */}
      {turn.tools.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] mb-1">
            <Wrench className="w-3 h-3" /> Tools used ({turn.eventCount} events)
          </div>
          <div className="flex flex-wrap gap-1.5">
            {turn.tools.map((tool, i) => (
              <ToolChip key={`${tool}-${i}`} name={tool} />
            ))}
          </div>
        </div>
      )}

      {/* SQL */}
      {turn.sql && (
        <div className="mb-3">
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#8A80A8] mb-1">
            <Code2 className="w-3 h-3" /> SQL executed
            <span className="text-[#A69DC0] font-normal normal-case tracking-normal ml-1">
              {turn.rowCount ?? 0} rows
              {turn.executionTimeMs !== null && ` · ${turn.executionTimeMs}ms`}
            </span>
          </div>
          <pre className="text-xs text-[#403770] bg-[#F7F5FA] rounded-lg p-3 border border-[#E2DEEC] overflow-x-auto whitespace-pre-wrap font-mono">
            {turn.sql}
          </pre>
        </div>
      )}

      {/* Error */}
      {turn.error && (
        <div>
          <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wider text-[#c25a52] mb-1">
            <AlertCircle className="w-3 h-3" /> Error
          </div>
          <pre className="text-xs text-[#c25a52] bg-[#fef1f0] rounded-lg p-3 border border-[#F37167]/30 whitespace-pre-wrap font-mono">
            {turn.error}
          </pre>
        </div>
      )}
    </div>
  );
}

export default function ConversationDetail({
  conversationId,
}: {
  conversationId: string;
}) {
  const { data, isLoading, isError, error } = useQuery<ConversationDetailResponse>({
    queryKey: ["admin-ai-query-convo-detail", conversationId],
    queryFn: async () => {
      const res = await fetch(
        `/api/admin/ai-query/conversations/${encodeURIComponent(conversationId)}`,
      );
      if (!res.ok) throw new Error("Failed to load conversation");
      return res.json();
    },
    staleTime: 60_000,
  });

  if (isLoading) {
    return (
      <div className="space-y-3">
        {[...Array(2)].map((_, i) => (
          <div key={i} className="h-32 bg-[#E2DEEC]/40 rounded-lg animate-pulse" />
        ))}
      </div>
    );
  }

  if (isError || !data) {
    return (
      <div className="text-sm text-[#c25a52] bg-[#fef1f0] rounded-lg p-3 border border-[#F37167]/30">
        Failed to load conversation: {error instanceof Error ? error.message : "unknown"}
      </div>
    );
  }

  return (
    <div>
      <div className="text-xs text-[#8A80A8] mb-3 flex items-center gap-2 flex-wrap whitespace-nowrap">
        <span className="font-semibold text-[#544A78]">
          {data.userName ?? data.userEmail ?? data.userId.slice(0, 8)}
        </span>
        <span className="text-[#D4CFE2]">·</span>
        <span>{data.turnCount} turns</span>
        <span className="text-[#D4CFE2]">·</span>
        <span className="text-[#403770] font-semibold tabular-nums">
          {fmtUSD(data.totalCost)} total
        </span>
        <span className="text-[#D4CFE2]">·</span>
        <span className="font-mono">{data.conversationId.slice(0, 8)}</span>
      </div>
      <div className="space-y-3">
        {data.turns.map((turn, i) => (
          <TurnCard key={turn.id} turn={turn} index={i} />
        ))}
      </div>
    </div>
  );
}
