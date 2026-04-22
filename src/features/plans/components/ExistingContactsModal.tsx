"use client";

import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CheckCircle2, X } from "lucide-react";
import { useContactSources } from "@/features/plans/lib/queries";

interface ExistingContactsModalProps {
  planId: string;
  variant: "queued-zero" | "partial";
  districtCount: number;
  newCount?: number;
  onClose: () => void;
}

function pluralize(n: number, word: string): string {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function relativeDate(iso: string): string {
  const diff = Date.now() - new Date(iso).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 30) return `${days}d ago`;
  return new Date(iso).toLocaleDateString();
}

const FOCUSABLE_SELECTOR =
  'a[href], button:not([disabled]), textarea:not([disabled]), input:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])';

export default function ExistingContactsModal({
  planId,
  variant,
  districtCount,
  newCount,
  onClose,
}: ExistingContactsModalProps) {
  const queryClient = useQueryClient();
  const { data, isLoading, isError, refetch } = useContactSources(planId);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [showAll, setShowAll] = useState(false);

  const dialogRef = useRef<HTMLDivElement>(null);
  const primaryButtonRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    primaryButtonRef.current?.focus();
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        onClose();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;

      const focusable = dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTOR);
      if (focusable.length === 0) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey) {
        if (document.activeElement === first) {
          e.preventDefault();
          last.focus();
        }
      } else {
        if (document.activeElement === last) {
          e.preventDefault();
          first.focus();
        }
      }
    };

    document.addEventListener("keydown", handleKeyDown);
    return () => document.removeEventListener("keydown", handleKeyDown);
  }, [onClose]);

  const handleShowHere = async () => {
    setIsRefreshing(true);
    try {
      await queryClient.invalidateQueries({ queryKey: ["planContacts", planId] });
      onClose();
    } finally {
      setIsRefreshing(false);
    }
  };

  const title = variant === "queued-zero" ? "Contacts already exist" : "Enrichment complete";

  const plans = data?.plans ?? [];
  const visiblePlans = showAll ? plans : plans.slice(0, 3);
  const hiddenCount = plans.length - visiblePlans.length;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={title}
      className="fixed inset-0 z-50 flex items-center justify-center"
    >
      <div
        className="absolute inset-0 bg-black/40"
        onClick={onClose}
        data-testid="modal-backdrop"
      />

      <div
        ref={dialogRef}
        className="relative bg-white rounded-2xl shadow-xl w-full max-w-2xl mx-4 max-h-[85vh] flex flex-col"
      >
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#E2DEEC]">
          <h2 className="text-lg font-semibold text-[#403770]">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="p-1 rounded-full text-[#8A80A8] hover:text-[#403770] hover:bg-[#EFEDF5] transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-6 overflow-y-auto">
          {variant === "queued-zero" ? (
            <p className="text-sm text-[#6E6390] mb-6">
              Contacts for {pluralize(districtCount, "district")} in this plan are already in the
              system. They may not be showing on this tab yet.
            </p>
          ) : (
            <div className="mb-6 space-y-1.5">
              <div className="flex items-center gap-2 text-sm text-[#544A78]">
                <CheckCircle2 className="w-4 h-4 text-[#69B34A] flex-shrink-0" />
                <span>
                  Found {pluralize(newCount ?? 0, "new contact")} for{" "}
                  {pluralize(newCount ?? 0, "district")}.
                </span>
              </div>
              <p className="text-sm text-[#6E6390] pl-6">
                {pluralize(districtCount, "district")} already had contacts.
              </p>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <h3 className="text-base font-semibold text-[#403770] mb-2">Show them here</h3>
              <p className="text-sm text-[#6E6390] mb-4">
                Refresh the Contacts tab to reveal existing contacts for this plan&apos;s districts.
              </p>
              <button
                ref={primaryButtonRef}
                type="button"
                onClick={handleShowHere}
                disabled={isRefreshing}
                className="px-4 py-2 text-sm font-medium text-white bg-[#403770] rounded-lg hover:bg-[#322a5a] transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {isRefreshing ? "Refreshing…" : "Show them here"}
              </button>
            </div>

            <div>
              <h3 className="text-base font-semibold text-[#403770] mb-2">Open another plan</h3>
              <p className="text-sm text-[#6E6390] mb-4">
                These plans share districts and already have contacts.
              </p>

              {isLoading && (
                <div className="space-y-2" data-testid="contact-sources-loading">
                  {[0, 1, 2].map((i) => (
                    <div
                      key={i}
                      className="animate-pulse bg-[#EFEDF5] h-14 rounded-lg"
                      data-testid="contact-sources-skeleton"
                    />
                  ))}
                </div>
              )}

              {isError && (
                <p className="text-sm text-[#F37167]">
                  Couldn&apos;t load other plans.{" "}
                  <button
                    type="button"
                    onClick={() => refetch()}
                    className="underline font-medium text-[#F37167] hover:text-[#d85a50]"
                  >
                    Retry
                  </button>
                </p>
              )}

              {!isLoading && !isError && plans.length === 0 && (
                <p className="text-sm text-[#6E6390]">
                  No other plans contain these districts yet.
                </p>
              )}

              {!isLoading && !isError && plans.length > 0 && (
                <div className="space-y-2">
                  {visiblePlans.map((plan) => (
                    <a
                      key={plan.id}
                      href={`/plans/${plan.id}`}
                      className="block p-3 rounded-lg border border-[#E2DEEC] hover:bg-[#F7F5FA] transition-colors"
                    >
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-sm font-medium text-[#403770] truncate">
                          {plan.name}
                        </span>
                        <span className="text-xs text-[#8A80A8] flex-shrink-0">
                          {plan.ownerName ?? "Unassigned"}
                        </span>
                      </div>
                      <div className="mt-1 text-xs text-[#6E6390]">
                        {pluralize(plan.sharedDistrictCount, "district")} ·{" "}
                        {pluralize(plan.contactCount, "contact")}
                        {plan.lastEnrichedAt
                          ? ` · Last enriched ${relativeDate(plan.lastEnrichedAt)}`
                          : ""}
                      </div>
                    </a>
                  ))}
                  {hiddenCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setShowAll(true)}
                      className="text-sm font-medium text-[#403770] hover:text-[#322a5a] underline"
                    >
                      See all {plans.length}
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
