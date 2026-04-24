import { describe, it, expect } from "vitest";
import {
  normalizeDrlRow,
  normalizeNirRow,
  type UnifiedIngestRow,
} from "../ingest-log-normalizer";

const baseDrl = {
  id: 42,
  data_source: "nces_districts",
  status: "success",
  records_updated: 18991,
  records_failed: 0,
  error_message: null,
  started_at: new Date("2026-04-22T10:00:00Z"),
  completed_at: new Date("2026-04-22T10:03:00Z"),
};

const baseNir = {
  id: "run_abc123",
  layer: "daily",
  status: "ok",
  started_at: new Date("2026-04-22T11:00:00Z"),
  finished_at: new Date("2026-04-22T11:05:00Z"),
  articles_new: 120,
  articles_dup: 15,
  districts_processed: 500,
  llm_calls: 42,
  error: null,
};

describe("normalizeDrlRow", () => {
  it("prefixes id with drl:", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.id).toBe("drl:42");
  });

  it("passes through data_source as source", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.source).toBe("nces_districts");
  });

  it("computes durationMs from started_at and completed_at", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.durationMs).toBe(3 * 60 * 1000);
  });

  it("returns durationMs = null when completed_at is null", () => {
    const out = normalizeDrlRow({ ...baseDrl, completed_at: null });
    expect(out.durationMs).toBeNull();
  });

  it("omits detail field for DRL rows", () => {
    const out = normalizeDrlRow(baseDrl);
    expect(out.detail).toBeUndefined();
  });
});

describe("normalizeNirRow", () => {
  it("prefixes id with nir:", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.id).toBe("nir:run_abc123");
  });

  it("builds source as news:<layer>", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.source).toBe("news:daily");
  });

  it("maps articles_new to recordsUpdated", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.recordsUpdated).toBe(120);
  });

  it("sets recordsFailed to null (no equivalent in NIR)", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.recordsFailed).toBeNull();
  });

  it("maps status 'ok' to 'success' in unified shape", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.status).toBe("success");
  });

  it("passes through status 'running' unchanged", () => {
    const out = normalizeNirRow({ ...baseNir, status: "running" });
    expect(out.status).toBe("running");
  });

  it("passes through status 'failed' unchanged", () => {
    const out = normalizeNirRow({ ...baseNir, status: "failed" });
    expect(out.status).toBe("failed");
  });

  it("computes durationMs from started_at to finished_at", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.durationMs).toBe(5 * 60 * 1000);
  });

  it("returns durationMs = null when finished_at is null", () => {
    const out = normalizeNirRow({ ...baseNir, finished_at: null });
    expect(out.durationMs).toBeNull();
  });

  it("includes detail with all news-specific fields", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.detail).toEqual({
      articlesDup: 15,
      districtsProcessed: 500,
      llmCalls: 42,
      layer: "daily",
    });
  });

  it("passes through error to errorMessage", () => {
    const out = normalizeNirRow({ ...baseNir, error: "timeout" });
    expect(out.errorMessage).toBe("timeout");
  });

  it("ISO-serializes timestamps", () => {
    const out = normalizeNirRow(baseNir);
    expect(out.startedAt).toBe("2026-04-22T11:00:00.000Z");
    expect(out.completedAt).toBe("2026-04-22T11:05:00.000Z");
  });
});
