"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { Search, Download, ChevronDown } from "lucide-react";
import { TARGET_ROLES, type TargetRole } from "@/features/shared/types/contact-types";
import { SCHOOL_LEVEL_LABELS, SCHOOL_TYPE_LABELS } from "@/features/shared/lib/schoolLabels";
import type { Contact } from "@/lib/api";
import {
  useBulkEnrich,
  useEnrichProgress,
} from "@/features/plans/lib/queries";

interface ContactsActionBarProps {
  planId: string;
  planName: string;
  contacts: Contact[];
  districtNameMap?: Map<string, string>;
  /** All district LEAIDs in the plan — used for CSV export of empty districts */
  allDistrictLeaids: string[];
  /** Map of leaid -> website URL for CSV export */
  districtWebsiteMap?: Map<string, string>;
  /** Callback to notify parent when enrichment starts/stops (for polling usePlanContacts) */
  onEnrichingChange?: (isEnriching: boolean) => void;
}

export default function ContactsActionBar({
  planId,
  planName,
  contacts,
  districtNameMap,
  allDistrictLeaids,
  districtWebsiteMap,
  onEnrichingChange,
}: ContactsActionBarProps) {
  const [showPopover, setShowPopover] = useState(false);
  const [selectedRole, setSelectedRole] = useState<TargetRole>("Superintendent");
  // School-level subfilter (only meaningful when selectedRole === "Principal").
  // Default: all 3 levels checked (1 = Primary/Elementary, 2 = Middle, 3 = High).
  const [schoolLevels, setSchoolLevels] = useState<Set<number>>(new Set([1, 2, 3]));
  const [isEnriching, setIsEnriching] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: "info" | "success" | "warning" | "error" } | null>(null);
  const popoverRef = useRef<HTMLDivElement>(null);
  const stallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastEnrichedRef = useRef<number>(0);

  const bulkEnrich = useBulkEnrich();

  // Fetch progress on mount (cached 30s), fast-poll every 5s when enriching
  const { data: progress } = useEnrichProgress(planId, isEnriching);

  // On mount, auto-detect if enrichment is already in progress (e.g., after page refresh)
  const hasCheckedInitial = useRef(false);
  useEffect(() => {
    if (hasCheckedInitial.current || isEnriching) return;
    if (progress && progress.queued > 0 && progress.enriched < progress.queued) {
      setIsEnriching(true);
    }
    if (progress) {
      hasCheckedInitial.current = true;
    }
  }, [progress, isEnriching]);

  // Notify parent of enrichment state changes (for usePlanContacts polling)
  useEffect(() => {
    onEnrichingChange?.(isEnriching);
  }, [isEnriching, onEnrichingChange]);

  // Auto-dismiss toast after 5 seconds
  useEffect(() => {
    if (!toast) return;
    const timer = setTimeout(() => setToast(null), 5000);
    return () => clearTimeout(timer);
  }, [toast]);

  // Close popover on outside click
  useEffect(() => {
    if (!showPopover) return;
    const handleClick = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setShowPopover(false);
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [showPopover]);

  // Track enrichment completion and stall detection
  useEffect(() => {
    if (!isEnriching || !progress) return;

    // Completion check
    if (progress.queued > 0 && progress.enriched >= progress.queued) {
      setIsEnriching(false);
      setToast({ message: `Contact enrichment complete — ${progress.enriched} contact${progress.enriched !== 1 ? "s" : ""} found`, type: "success" });
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      return;
    }

    // Stall detection: if progress hasn't changed in 2 minutes
    if (progress.enriched !== lastEnrichedRef.current) {
      lastEnrichedRef.current = progress.enriched;
      // Reset stall timer
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
      stallTimerRef.current = setTimeout(() => {
        setIsEnriching(false);
        setToast({ message: "Enrichment may be stalled — some contacts may not have results", type: "warning" });
      }, 2 * 60 * 1000);
    }
  }, [isEnriching, progress]);

  // Cleanup stall timer on unmount
  useEffect(() => {
    return () => {
      if (stallTimerRef.current) clearTimeout(stallTimerRef.current);
    };
  }, []);

  const handleStartEnrichment = useCallback(async () => {
    setShowPopover(false);

    try {
      const result = await bulkEnrich.mutateAsync({
        planId,
        targetRole: selectedRole,
        ...(selectedRole === "Principal"
          ? { schoolLevels: Array.from(schoolLevels).sort() }
          : {}),
      });

      if (result.queued === 0) {
        setToast({ message: "Nothing to enrich — all targets already have contacts", type: "info" });
        return;
      }

      setIsEnriching(true);
      lastEnrichedRef.current = 0;

      // Start stall timer
      stallTimerRef.current = setTimeout(() => {
        setIsEnriching(false);
        setToast({ message: "Enrichment may be stalled — some contacts may not have results", type: "warning" });
      }, 2 * 60 * 1000);

      setToast({ message: `Looking for ${result.queued} contact${result.queued !== 1 ? "s" : ""}`, type: "info" });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to start contact enrichment";
      if (message.includes("409") || message.includes("already in progress")) {
        setToast({ message: "Enrichment already in progress", type: "info" });
        setIsEnriching(true);
      } else {
        setToast({ message, type: "error" });
      }
    }
  }, [planId, selectedRole, schoolLevels, bulkEnrich]);

  const handleExportCsv = useCallback(() => {
    const headers = [
      "District Name",
      "Website",
      "School Name",
      "School Level",
      "School Type",
      "Contact Name",
      "Title",
      "Email",
      "Phone",
      "Department",
      "Seniority Level",
    ];

    const rows: string[][] = [];
    const seenDistricts = new Set<string>();

    // One row per contact
    for (const contact of contacts) {
      seenDistricts.add(contact.leaid);
      const districtName = districtNameMap?.get(contact.leaid) || contact.leaid;
      const websiteUrl = districtWebsiteMap?.get(contact.leaid) || "";

      const link = contact.schoolContacts?.[0];
      const schoolName = link?.name ?? "";
      const schoolLevel =
        link?.schoolLevel != null ? (SCHOOL_LEVEL_LABELS[link.schoolLevel] ?? "") : "";
      const schoolType =
        link?.schoolType != null ? (SCHOOL_TYPE_LABELS[link.schoolType] ?? "") : "";

      rows.push([
        districtName,
        websiteUrl,
        schoolName,
        schoolLevel,
        schoolType,
        contact.name || "",
        contact.title || "",
        contact.email || "",
        contact.phone || "",
        contact.persona || "",
        contact.seniorityLevel || "",
      ]);
    }

    // Preserve coverage-gap signal: one blank row per district with zero contacts
    for (const leaid of allDistrictLeaids) {
      if (seenDistricts.has(leaid)) continue;
      const districtName = districtNameMap?.get(leaid) || leaid;
      const websiteUrl = districtWebsiteMap?.get(leaid) || "";
      rows.push([districtName, websiteUrl, "", "", "", "", "", "", "", "", ""]);
    }

    const csvContent = [headers, ...rows]
      .map((row) => row.map((cell) => `"${cell.replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    const safeName = planName.replace(/[^a-zA-Z0-9-_ ]/g, "").replace(/\s+/g, "-").toLowerCase();
    link.download = `${safeName}-contacts-${new Date().toISOString().split("T")[0]}.csv`;
    link.click();
    URL.revokeObjectURL(url);
  }, [contacts, allDistrictLeaids, districtNameMap, districtWebsiteMap, planName]);

  const progressPercent =
    progress && progress.queued > 0
      ? Math.round((progress.enriched / progress.queued) * 100)
      : 0;

  return (
    <>
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-[#EFEDF5]">
        <div className="flex items-center gap-2">
          {/* Find Contacts */}
          <div className="relative" ref={popoverRef}>
            <button
              onClick={() => setShowPopover(!showPopover)}
              disabled={isEnriching || bulkEnrich.isPending}
              className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
            >
              <Search className="w-3.5 h-3.5" />
              Find Contacts
            </button>

            {showPopover && (
              <div
                className="absolute left-0 top-full mt-1 w-64 bg-white rounded-lg shadow-xl border border-[#EFEDF5] p-3 z-50"
                style={{ animation: "tooltipEnter 200ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
              >
                <label className="block text-[11px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
                  Target Role
                </label>
                <div className="relative mb-3">
                  <select
                    value={selectedRole}
                    onChange={(e) => setSelectedRole(e.target.value as TargetRole)}
                    className="w-full appearance-none px-3 py-2 pr-8 text-[13px] text-[#403770] bg-[#F7F5FA] border border-[#EFEDF5] rounded-lg focus:outline-none focus:ring-2 focus:ring-[#403770]/20"
                  >
                    {TARGET_ROLES.map((role) => (
                      <option key={role} value={role}>
                        {role}
                      </option>
                    ))}
                  </select>
                  <ChevronDown className="absolute right-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-[#403770]/40 pointer-events-none" />
                </div>

                {selectedRole === "Principal" && (
                  <div className="mb-3">
                    <label className="block text-[11px] font-semibold text-[#403770]/60 uppercase tracking-wider mb-1.5">
                      School Level
                    </label>
                    <div className="flex flex-col gap-1.5">
                      {[
                        { value: 1, label: "Primary" },
                        { value: 2, label: "Middle" },
                        { value: 3, label: "High" },
                      ].map(({ value, label }) => (
                        <label
                          key={value}
                          className="flex items-center gap-2 text-[13px] text-[#403770] cursor-pointer"
                        >
                          <input
                            type="checkbox"
                            checked={schoolLevels.has(value)}
                            onChange={(e) => {
                              setSchoolLevels((prev) => {
                                const next = new Set(prev);
                                if (e.target.checked) next.add(value);
                                else next.delete(value);
                                return next;
                              });
                            }}
                            className="w-3.5 h-3.5 accent-[#403770]"
                          />
                          {label}
                        </label>
                      ))}
                    </div>
                  </div>
                )}

                <button
                  onClick={handleStartEnrichment}
                  disabled={
                    bulkEnrich.isPending ||
                    (selectedRole === "Principal" && schoolLevels.size === 0)
                  }
                  className="w-full px-3 py-2 text-[13px] font-medium text-white bg-[#403770] hover:bg-[#322a5a] disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                >
                  {bulkEnrich.isPending ? "Starting..." : "Start"}
                </button>
              </div>
            )}
          </div>

          {/* Progress indicator */}
          {isEnriching && progress && progress.queued > 0 && (
            <div className="flex items-center gap-2 ml-2">
              <div className="w-24 h-1.5 bg-[#EFEDF5] rounded-full overflow-hidden">
                <div
                  className="h-full bg-[#8AA891] rounded-full transition-all duration-500"
                  style={{ width: `${progressPercent}%` }}
                />
              </div>
              <span className="text-[12px] text-[#403770]/60 font-medium whitespace-nowrap">
                {progress.enriched}/{progress.queued}
              </span>
            </div>
          )}
        </div>

        {/* Export CSV */}
        <button
          onClick={handleExportCsv}
          className="inline-flex items-center gap-2 px-3 py-1.5 text-[13px] font-medium text-[#403770] hover:bg-[#F7F5FA] rounded-lg transition-colors"
        >
          <Download className="w-3.5 h-3.5" />
          Export CSV
        </button>
      </div>

      {/* Toast */}
      {toast && (
        <div
          className={`fixed bottom-6 left-1/2 -translate-x-1/2 z-50 px-4 py-2.5 rounded-xl shadow-lg text-[13px] font-medium ${
            toast.type === "success"
              ? "bg-[#8AA891] text-white"
              : toast.type === "warning"
                ? "bg-amber-500 text-white"
                : toast.type === "error"
                  ? "bg-red-500 text-white"
                  : "bg-[#403770] text-white"
          }`}
          style={{ animation: "tooltipEnter 250ms cubic-bezier(0.16, 1, 0.3, 1) forwards" }}
        >
          {toast.message}
        </div>
      )}
    </>
  );
}
