export interface UnifiedIngestRow {
  id: string;
  source: string;
  status: string;
  recordsUpdated: number | null;
  recordsFailed: number | null;
  startedAt: string;
  completedAt: string | null;
  durationMs: number | null;
  errorMessage: string | null;
  detail?: {
    articlesDup: number;
    districtsProcessed: number;
    llmCalls: number;
    layer: string;
  };
}

export interface DrlRow {
  id: number;
  data_source: string;
  status: string;
  records_updated: number | null;
  records_failed: number | null;
  error_message: string | null;
  started_at: Date | string;
  completed_at: Date | string | null;
}

export interface NirRow {
  id: string;
  layer: string;
  status: string;
  started_at: Date | string;
  finished_at: Date | string | null;
  articles_new: number | null;
  articles_dup: number | null;
  districts_processed: number | null;
  llm_calls: number | null;
  error: string | null;
}

function toIso(d: Date | string): string {
  return typeof d === "string" ? new Date(d).toISOString() : d.toISOString();
}

function diffMs(start: Date | string, end: Date | string | null): number | null {
  if (!end) return null;
  const startMs = (typeof start === "string" ? new Date(start) : start).getTime();
  const endMs = (typeof end === "string" ? new Date(end) : end).getTime();
  return endMs - startMs;
}

export function normalizeDrlRow(row: DrlRow): UnifiedIngestRow {
  return {
    id: `drl:${row.id}`,
    source: row.data_source,
    status: row.status,
    recordsUpdated: row.records_updated,
    recordsFailed: row.records_failed,
    startedAt: toIso(row.started_at),
    completedAt: row.completed_at ? toIso(row.completed_at) : null,
    durationMs: diffMs(row.started_at, row.completed_at),
    errorMessage: row.error_message,
  };
}

export function normalizeNirRow(row: NirRow): UnifiedIngestRow {
  const status = row.status === "ok" ? "success" : row.status;
  return {
    id: `nir:${row.id}`,
    source: `news:${row.layer}`,
    status,
    recordsUpdated: row.articles_new,
    recordsFailed: null,
    startedAt: toIso(row.started_at),
    completedAt: row.finished_at ? toIso(row.finished_at) : null,
    durationMs: diffMs(row.started_at, row.finished_at),
    errorMessage: row.error,
    detail: {
      articlesDup: row.articles_dup ?? 0,
      districtsProcessed: row.districts_processed ?? 0,
      llmCalls: row.llm_calls ?? 0,
      layer: row.layer,
    },
  };
}
