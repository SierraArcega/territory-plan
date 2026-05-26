"use client";
import { useState, useCallback, useEffect, useRef } from "react";
import { useBulkEnrich, useEnrichProgress, useExpandRollup } from "./queries";
import type { TargetRole } from "@/features/shared/types/contact-types";

export interface EnrichToast {
  message: string;
  type: "info" | "success" | "warning" | "error";
  action?: { label: string; onClick: () => void };
}

export interface EnrichModalState {
  variant: "queued-zero" | "partial";
  districtCount: number;
  newCount?: number;
}

export interface StartEnrichParams {
  targetRole: TargetRole;
  schoolLevels?: Set<number>;
  /** When provided, scope enrichment to these leaids only (instead of all plan districts). */
  leaids?: string[];
}

export interface BulkEnrichFlowResult {
  isEnriching: boolean;
  toast: EnrichToast | null;
  setToast: (t: EnrichToast | null) => void;
  modalState: EnrichModalState | null;
  setModalState: (m: EnrichModalState | null) => void;
  progressPercent: number;
  progress: { total: number; enriched: number; queued: number } | undefined;
  handleStartEnrichment: (params: StartEnrichParams) => Promise<void>;
  bulkEnrich: ReturnType<typeof useBulkEnrich>;
  expandRollup: ReturnType<typeof useExpandRollup>;
}

export function useBulkEnrichFlow({
  planId,
  onEnrichingChange,
}: {
  planId: string;
  onEnrichingChange?: (isEnriching: boolean) => void;
}): BulkEnrichFlowResult {
  const [isEnriching, setIsEnriching] = useState(false);
  const [toast, setToast] = useState<EnrichToast | null>(null);
  const [modalState, setModalState] = useState<EnrichModalState | null>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEnrichedRef = useRef<number>(0);
  const pendingPartialRef = useRef<{ newCount: number; skippedCount: number } | null>(null);

  const bulkEnrich = useBulkEnrich();
  const expandRollup = useExpandRollup();
  const { data: progress } = useEnrichProgress(planId, isEnriching);

  // Auto-detect in-progress enrichment on mount.
  const hasCheckedInitial = useRef(false);
  useEffect(() => {
    if (hasCheckedInitial.current || isEnriching) return;
    if (progress && progress.queued > 0 && progress.enriched < progress.queued) {
      setIsEnriching(true);
    }
    if (progress) hasCheckedInitial.current = true;
  }, [progress, isEnriching]);

  // Notify parent of state changes.
  useEffect(() => {
    onEnrichingChange?.(isEnriching);
  }, [isEnriching, onEnrichingChange]);

  // Auto-dismiss toasts without actions.
  useEffect(() => {
    if (!toast || toast.action) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Completion and stall detection.
  useEffect(() => {
    if (!isEnriching || !progress) return;
    if (progress.queued > 0 && progress.enriched >= progress.queued) {
      setIsEnriching(false);
      setToast({
        message: `Contact enrichment complete — ${progress.enriched} contact${progress.enriched !== 1 ? "s" : ""} found`,
        type: "success",
      });
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      if (pendingPartialRef.current) {
        setModalState({
          variant: "partial",
          districtCount: pendingPartialRef.current.skippedCount,
          newCount: pendingPartialRef.current.newCount,
        });
        pendingPartialRef.current = null;
      }
      return;
    }
    if (progress.enriched !== lastEnrichedRef.current) {
      lastEnrichedRef.current = progress.enriched;
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        setIsEnriching(false);
        setToast({
          message: "Enrichment may be stalled — some contacts may not have results",
          type: "warning",
        });
      }, 2 * 60 * 1000);
    }
  }, [isEnriching, progress]);

  useEffect(() => () => { if (stallTimerRef.current) clearTimeout(stallTimerRef.current); }, []);

  const handleStartEnrichmentRef = useRef<(p: StartEnrichParams) => Promise<void>>(() =>
    Promise.resolve()
  );

  const handleStartEnrichment = useCallback(
    async ({ targetRole, schoolLevels, leaids }: StartEnrichParams) => {
      try {
        const result = await bulkEnrich.mutateAsync({
          planId,
          targetRole,
          ...(schoolLevels && schoolLevels.size > 0
            ? { schoolLevels: Array.from(schoolLevels).sort() }
            : {}),
          ...(leaids ? { leaids } : {}),
        });

        if (result.queued === 0) {
          if (result.skipped > 0) {
            setModalState({ variant: "queued-zero", districtCount: result.skipped });
          } else {
            const reasonMap: Record<string, string> = {
              "no-districts": "No districts to enrich — add districts to this plan first",
              "no-schools-in-district": "No schools on record for this district",
              "no-schools-at-levels": "No schools at the selected levels",
            };
            setToast({
              message: result.reason
                ? (reasonMap[result.reason] ??
                    (targetRole === "Principal" ? "No schools to enrich" : "No contacts to enrich"))
                : (targetRole === "Principal" ? "No schools to enrich" : "No contacts to enrich"),
              type: "info",
            });
          }
          return;
        }

        if (result.skipped > 0) {
          pendingPartialRef.current = { newCount: result.queued, skippedCount: result.skipped };
        }

        setIsEnriching(true);
        lastEnrichedRef.current = 0;
        stallTimerRef.current = setTimeout(() => {
          setIsEnriching(false);
          setToast({
            message: "Enrichment may be stalled — some contacts may not have results",
            type: "warning",
          });
        }, 2 * 60 * 1000);
        setToast({
          message: `Looking for ${result.queued} contact${result.queued !== 1 ? "s" : ""}`,
          type: "info",
        });
      } catch (error) {
        const body = (error as { body?: unknown })?.body;
        if (
          body &&
          typeof body === "object" &&
          (body as { reason?: unknown }).reason === "rollup-district"
        ) {
          const b = body as { childLeaids?: string[]; rollupLeaids?: string[] };
          const count = b.childLeaids?.length ?? 0;
          const rollupCount = b.rollupLeaids?.length ?? 0;
          if (rollupCount === 0 || count === 0) {
            setToast({ message: "Plan contains a rollup district; cannot expand automatically.", type: "error" });
            return;
          }
          setToast({
            message: `This plan contains ${count.toLocaleString()} child districts rolled up under a parent.`,
            type: "warning",
            action: {
              label: `Expand to ${count.toLocaleString()} districts`,
              onClick: async () => {
                try {
                  await expandRollup.mutateAsync({ planId });
                  setToast(null);
                  await handleStartEnrichmentRef.current({ targetRole, schoolLevels, leaids });
                } catch {
                  setToast({ message: "Failed to expand rollup; please refresh and try again.", type: "error" });
                }
              },
            },
          });
          return;
        }
        const message = error instanceof Error ? error.message : "Failed to start contact enrichment";
        if (message.includes("409") || message.includes("already in progress")) {
          setToast({ message: "Enrichment already in progress", type: "info" });
          setIsEnriching(true);
        } else {
          setToast({ message, type: "error" });
        }
      }
    },
    [planId, bulkEnrich, expandRollup]
  );

  useEffect(() => {
    handleStartEnrichmentRef.current = handleStartEnrichment;
  }, [handleStartEnrichment]);

  const progressPercent =
    progress && progress.queued > 0
      ? Math.round((progress.enriched / progress.queued) * 100)
      : 0;

  return {
    isEnriching,
    toast,
    setToast,
    modalState,
    setModalState,
    progressPercent,
    progress,
    handleStartEnrichment,
    bulkEnrich,
    expandRollup,
  };
}
