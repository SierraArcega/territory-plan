"use client";

import type { QueryParams, QueryResult } from "../lib/types";
import DataTable from "./DataTable";
import EmptyHero from "./EmptyHero";
import PreRunCard from "./PreRunCard";
import ErrorBanner from "./ErrorBanner";
import SkeletonRow from "./ui/SkeletonRow";

interface Props {
  params: QueryParams;
  result: QueryResult | null;
  loading: boolean;
  error: string | null;
  onRun: () => void;
  onRetry: () => void;
}

export default function ResultsArea({
  params,
  result,
  loading,
  error,
  onRun,
  onRetry,
}: Props) {
  const hasSource = Boolean(params.table);

  if (!hasSource && !result) {
    return <EmptyHero />;
  }

  if (loading && !result) {
    return (
      <div className="mx-8 mt-6 w-[calc(100%-4rem)] rounded-xl border border-[#E2DEEC] bg-white overflow-hidden">
        {Array.from({ length: 12 }).map((_, i) => (
          <SkeletonRow key={i} columns={5} striped={i % 2 === 1} />
        ))}
      </div>
    );
  }

  if (error && !result) {
    return (
      <div className="mx-8 mt-6">
        <ErrorBanner title="Query failed" detail={error} onRetry={onRetry} />
      </div>
    );
  }

  if (!result) {
    return (
      <PreRunCard
        summary={buildSummary(params)}
        onRun={onRun}
        disabled={loading}
      />
    );
  }

  return (
    <div className="flex flex-col w-full">
      {error && (
        <div className="mx-8 mt-4">
          <ErrorBanner
            title="Latest run failed"
            detail={`Showing previous results. ${error}`}
            onRetry={onRetry}
          />
        </div>
      )}
      <DataTable
        columns={result.columns}
        rows={result.rows}
        rowCount={result.rowCount}
        truncated={result.truncated}
      />
    </div>
  );
}

function buildSummary(params: QueryParams): string {
  const parts: string[] = [];
  parts.push(`Fetch ${params.table}`);
  if (params.joins?.length) {
    parts.push(`joined with ${params.joins.map((j) => j.toTable).join(" and ")}`);
  }
  if (params.filters?.length) {
    parts.push(`with ${params.filters.length} filter${params.filters.length === 1 ? "" : "s"}`);
  }
  if (params.orderBy?.[0]) {
    parts.push(`sorted by ${params.orderBy[0].column}`);
  }
  return parts.join(" ") + ".";
}
