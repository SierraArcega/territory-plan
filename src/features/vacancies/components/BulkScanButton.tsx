"use client";

import { useState, useEffect, useCallback } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { useBulkScan, useBatchProgress } from "@/features/vacancies/lib/queries";
import type { BatchProgress } from "@/features/vacancies/lib/queries";

interface BulkScanButtonProps {
  territoryPlanId: string;
}

type ScanState = "idle" | "scanning" | "complete" | "error";

export default function BulkScanButton({ territoryPlanId }: BulkScanButtonProps) {
  const [scanState, setScanState] = useState<ScanState>("idle");
  const [batchId, setBatchId] = useState<string | null>(null);
  const [completeSummary, setCompleteSummary] = useState<{
    vacanciesFound: number;
    fullmindRelevant: number;
  } | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const queryClient = useQueryClient();
  const bulkScan = useBulkScan();
  const { data: batchProgress } = useBatchProgress(
    scanState === "scanning" ? batchId : null
  );

  // Watch for batch completion
  useEffect(() => {
    if (!batchProgress || scanState !== "scanning") return;

    if (batchProgress.pending === 0) {
      setScanState("complete");
      setCompleteSummary({
        vacanciesFound: batchProgress.vacanciesFound,
        fullmindRelevant: batchProgress.fullmindRelevant,
      });
      setBatchId(null);
      // Invalidate vacancy queries so tables/tabs refresh
      queryClient.invalidateQueries({ queryKey: ["planVacancies"] });
      queryClient.invalidateQueries({ queryKey: ["vacancies"] });
    }
  }, [batchProgress, scanState]);

  // Auto-dismiss complete state after 5 seconds
  useEffect(() => {
    if (scanState !== "complete") return;
    const timer = setTimeout(() => {
      setScanState("idle");
      setCompleteSummary(null);
    }, 5000);
    return () => clearTimeout(timer);
  }, [scanState]);

  const handleScan = useCallback(async () => {
    setScanState("scanning");
    setErrorMessage(null);
    setCompleteSummary(null);

    try {
      const result = await bulkScan.mutateAsync(territoryPlanId);
      if (result.scansCreated === 0) {
        // No districts with job board URLs — show complete immediately
        setScanState("complete");
        setCompleteSummary({ vacanciesFound: 0, fullmindRelevant: 0 });
        return;
      }
      setBatchId(result.batchId);
    } catch (err) {
      setScanState("error");
      setErrorMessage(
        err instanceof Error ? err.message : "Scan failed. Please try again."
      );
    }
  }, [territoryPlanId, bulkScan]);

  const handleRetry = useCallback(() => {
    setErrorMessage(null);
    handleScan();
  }, [handleScan]);

  // --- Idle ---
  if (scanState === "idle") {
    return (
      <button
        onClick={handleScan}
        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-[#403770] border border-[#403770] rounded-lg hover:bg-[#403770] hover:text-white transition-colors"
      >
        <svg
          className="w-3.5 h-3.5"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M21 21l-4.35-4.35M11 19a8 8 0 100-16 8 8 0 000 16z"
          />
        </svg>
        Scan Vacancies
      </button>
    );
  }

  // --- Scanning ---
  if (scanState === "scanning") {
    const progress = batchProgress as BatchProgress | undefined;
    const completed = progress ? progress.completed + progress.failed : 0;
    const total = progress?.total ?? 0;
    const pct = total > 0 ? Math.round((completed / total) * 100) : 0;

    return (
      <div className="inline-flex items-center gap-3 px-3 py-1.5 text-sm text-[#403770] border border-[#C2BBD4] rounded-lg bg-[#F7F5FA]">
        {/* Spinner */}
        <div className="w-3.5 h-3.5 border-2 border-[#403770] border-t-transparent rounded-full animate-spin flex-shrink-0" />

        <div className="flex flex-col gap-1 min-w-[140px]">
          <span className="text-xs font-medium text-[#6E6390]">
            Scanning... {total > 0 ? `${completed}/${total} districts` : "starting..."}
          </span>
          {/* Progress bar */}
          <div className="h-1.5 bg-[#E2DEEC] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full bg-[#403770] transition-all duration-300"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      </div>
    );
  }

  // --- Complete ---
  if (scanState === "complete" && completeSummary) {
    return (
      <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-[#8AA891] border border-[#8AA891]/30 rounded-lg bg-[#8AA891]/5">
        <svg
          className="w-3.5 h-3.5 flex-shrink-0"
          fill="none"
          stroke="currentColor"
          viewBox="0 0 24 24"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M5 13l4 4L19 7"
          />
        </svg>
        <span>
          {completeSummary.vacanciesFound} vacancies found
          {completeSummary.fullmindRelevant > 0 && (
            <span className="text-[#403770]">
              {" "}({completeSummary.fullmindRelevant} Fullmind-relevant)
            </span>
          )}
        </span>
      </div>
    );
  }

  // --- Error ---
  return (
    <div className="inline-flex items-center gap-2 px-3 py-1.5 text-sm text-red-600 border border-red-200 rounded-lg bg-red-50">
      <svg
        className="w-3.5 h-3.5 flex-shrink-0"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
        />
      </svg>
      <span className="text-xs">{errorMessage || "Scan failed"}</span>
      <button
        onClick={handleRetry}
        className="ml-1 text-xs font-medium text-red-700 underline hover:text-red-800"
      >
        Retry
      </button>
    </div>
  );
}
