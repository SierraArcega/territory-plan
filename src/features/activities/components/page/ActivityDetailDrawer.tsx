"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, ChevronLeft, ChevronRight, MoreVertical, Trash2, X } from "lucide-react";
import {
  useActivity,
  useUpdateActivity,
  useDeleteActivity,
  useActivityNotes,
  useActivityAttachments,
} from "@/features/activities/lib/queries";
import { useProfile } from "@/lib/api";
import { useFocusTrap } from "@/features/shared/lib/use-focus-trap";
import {
  ACTIVITY_TYPE_LABELS,
  ALL_ACTIVITY_TYPES,
  type ActivityStatus,
  type ActivityType,
} from "@/features/activities/types";
import EditableText from "@/features/shared/components/EditableText";
import EditableSelect from "@/features/shared/components/EditableSelect";
import TabBar, { type TabBarItem } from "@/features/shared/components/TabBar";
import OverviewPanel from "./drawer/OverviewPanel";
import OutcomePanel from "./drawer/OutcomePanel";
import NotesPanel from "./drawer/NotesPanel";
import ExpensesPanel from "./drawer/ExpensesPanel";
import FilesPanel from "./drawer/FilesPanel";

type TabId = "overview" | "outcome" | "notes" | "expenses" | "files";

type DrawerPatch = Partial<{
  type: ActivityType;
  title: string;
  status: ActivityStatus;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  outcome: string | null;
  outcomeType: string | null;
  sentiment: "positive" | "neutral" | "negative" | null;
  nextStep: string | null;
  followUpDate: string | null;
  dealImpact: "none" | "progressed" | "won" | "lost";
  outcomeDisposition: "completed" | "no_show" | "rescheduled" | "cancelled" | null;
  address: string | null;
  addressLat: number | null;
  addressLng: number | null;
  inPerson: boolean | null;
  metadata: Record<string, unknown> | null;
  attendeeUserIds: string[];
  contactIds: number[];
  rating: number;
  opportunityIds: string[];
}>;

const FLASH_MS = 1400;

export default function ActivityDetailDrawer({
  activityId,
  onClose,
  onNavigate,
  canPrev = false,
  canNext = false,
}: {
  activityId: string | null;
  onClose: () => void;
  onNavigate?: (dir: "prev" | "next") => void;
  canPrev?: boolean;
  canNext?: boolean;
}) {
  useEffect(() => {
    if (!activityId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
        return;
      }
      // Skip arrow nav while typing in an input/textarea/contentEditable
      const target = e.target as HTMLElement | null;
      const isEditable =
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.isContentEditable);
      if (isEditable) return;
      if (e.key === "ArrowLeft" && canPrev) onNavigate?.("prev");
      if (e.key === "ArrowRight" && canNext) onNavigate?.("next");
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activityId, onClose, onNavigate, canPrev, canNext]);

  if (!activityId) return null;
  // Don't key by activityId — keying remounts the panel on prev/next nav,
  // which throws away the useActivity cache state and flashes a blank
  // "Loading…" panel for ~200ms per click. Inner resets transient state
  // (tab, confirm, saved-flash) explicitly when activityId changes.
  return (
    <DrawerInner
      activityId={activityId}
      onClose={onClose}
      onNavigate={onNavigate}
      canPrev={canPrev}
      canNext={canNext}
    />
  );
}

function DrawerInner({
  activityId,
  onClose,
  onNavigate,
  canPrev,
  canNext,
}: {
  activityId: string;
  onClose: () => void;
  onNavigate?: (dir: "prev" | "next") => void;
  canPrev: boolean;
  canNext: boolean;
}) {
  const { data: activity, isLoading } = useActivity(activityId);
  const { data: notes = [] } = useActivityNotes(activityId);
  const { data: attachments = [] } = useActivityAttachments(activityId);
  const { data: profile } = useProfile();
  const update = useUpdateActivity();
  const remove = useDeleteActivity();
  const trapRef = useFocusTrap<HTMLDivElement>(true);
  const [tab, setTab] = useState<TabId>("overview");
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [savedFlash, setSavedFlash] = useState(false);

  // Reset transient panel state when the drawer pivots to a different
  // activity (replaces the previous key={activityId} approach so we keep
  // useActivity's placeholderData bridge across the nav).
  useEffect(() => {
    setTab("overview");
    setConfirmingDelete(false);
    setSavedFlash(false);
  }, [activityId]);

  const isAdmin = profile?.role === "admin";
  const isForeignOwned =
    !!activity?.createdByUserId && activity.createdByUserId !== profile?.id;
  const readOnly = isForeignOwned && !isAdmin;
  const ownerName = activity?.createdByUser?.fullName ?? null;

  function flashSaved() {
    setSavedFlash(true);
    window.setTimeout(() => setSavedFlash(false), FLASH_MS);
  }

  function patch(data: DrawerPatch) {
    if (!activity) return;
    update.mutate({ activityId: activity.id, ...data }, { onSuccess: flashSaved });
  }

  function onDelete() {
    if (!activity) return;
    remove.mutate(activity.id, { onSuccess: onClose });
  }

  const typeOptions = useMemo(
    () =>
      ALL_ACTIVITY_TYPES.map((t) => ({
        id: t,
        label: ACTIVITY_TYPE_LABELS[t],
      })),
    []
  );

  const tabs: TabBarItem<TabId>[] = activity
    ? [
        { id: "overview", label: "Overview" },
        { id: "outcome", label: "Outcome" },
        { id: "notes", label: "Notes", count: notes.length || null },
        {
          id: "expenses",
          label: "Expenses",
          count: activity.expenses.length || null,
        },
        { id: "files", label: "Files", count: attachments.length || null },
      ]
    : [];

  return (
    <>
      <div
        className="fixed inset-0 z-40 bg-black/40"
        style={{ animation: "fmFadeIn 200ms linear" }}
        onClick={onClose}
        aria-hidden
      />
      <aside
        ref={trapRef}
        role="dialog"
        aria-label="Activity detail"
        aria-modal="true"
        className="fm-drawer-panel fixed z-50 bg-white shadow-2xl flex flex-col left-0 md:left-auto right-0 bottom-0 md:bottom-auto top-auto md:top-0 w-full md:w-[520px] max-h-[85vh] md:max-h-none md:h-full rounded-t-2xl md:rounded-none"
      >
        {isLoading || !activity ? (
          <div className="flex items-center justify-center h-full text-sm text-[#8A80A8]">
            Loading…
          </div>
        ) : (
          <>
            {/* Header with plum strip */}
            <header className="relative flex items-start gap-3 px-5 py-4 border-b border-[#E2DEEC] bg-[#FFFCFA]">
              <span
                className="absolute left-0 top-0 bottom-0 w-1 bg-[#403770]"
                aria-hidden
              />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1.5">
                  <EditableSelect<ActivityType>
                    value={activity.type}
                    options={typeOptions}
                    readOnly={readOnly}
                    ariaLabel="Activity type"
                    onChange={(v) => patch({ type: v })}
                    renderValue={(opt) => (
                      <span className="inline-flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-[0.06em] text-[#403770]">
                        <span className="w-1.5 h-1.5 rounded-full bg-[#403770]" aria-hidden />
                        {opt?.label ?? activity.type}
                      </span>
                    )}
                  />
                  {isForeignOwned && (
                    <span className="ml-auto text-[10px] font-semibold text-[#6E6390] bg-[#EFEDF5] px-2 py-0.5 rounded-full whitespace-nowrap">
                      {readOnly
                        ? `Read-only · ${ownerName ?? "teammate"}`
                        : ownerName ?? "Teammate"}
                    </span>
                  )}
                </div>
                <EditableText
                  value={activity.title}
                  size="lg"
                  weight="bold"
                  placeholder="Add a title"
                  readOnly={readOnly}
                  ariaLabel="Activity title"
                  onChange={(v) => patch({ title: v })}
                />
              </div>
              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => onNavigate?.("prev")}
                  disabled={!canPrev}
                  aria-label="Previous activity"
                  title="Previous activity (←)"
                  className="fm-focus-ring w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6390] hover:bg-[#F7F5FA] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed [transition-duration:120ms] transition-colors"
                >
                  <ChevronLeft className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => onNavigate?.("next")}
                  disabled={!canNext}
                  aria-label="Next activity"
                  title="Next activity (→)"
                  className="fm-focus-ring w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6390] hover:bg-[#F7F5FA] disabled:opacity-30 disabled:hover:bg-transparent disabled:cursor-not-allowed [transition-duration:120ms] transition-colors"
                >
                  <ChevronRight className="w-4 h-4" />
                </button>
                {/* TODO: overflow menu */}
                <button
                  type="button"
                  aria-label="More options"
                  title="More"
                  className="fm-focus-ring w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6390] hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="fm-focus-ring w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6390] hover:bg-[#F7F5FA] [transition-duration:120ms] transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </header>

            {/* Tabs */}
            <TabBar<TabId>
              tabs={tabs}
              active={tab}
              onChange={setTab}
              ariaLabel="Activity sections"
            />

            {/* Body */}
            <div role="tabpanel" className="flex-1 overflow-hidden">
              {tab === "overview" && (
                <OverviewPanel
                  activity={activity}
                  readOnly={readOnly}
                  ownerName={isForeignOwned ? ownerName : null}
                  onPatch={patch}
                  notesCount={notes.length}
                  attachmentsCount={attachments.length}
                />
              )}
              {tab === "outcome" && (
                <OutcomePanel
                  activity={activity}
                  readOnly={readOnly}
                  onPatch={patch}
                />
              )}
              {tab === "notes" && (
                <NotesPanel
                  activityId={activity.id}
                  readOnly={readOnly}
                  onSaved={flashSaved}
                />
              )}
              {tab === "expenses" && (
                <ExpensesPanel
                  activity={activity}
                  readOnly={readOnly}
                  onSaved={flashSaved}
                />
              )}
              {tab === "files" && (
                <FilesPanel
                  activityId={activity.id}
                  readOnly={readOnly}
                  onSaved={flashSaved}
                />
              )}
            </div>

            {/* Footer */}
            <footer className="border-t border-[#E2DEEC] px-5 py-3 flex items-center gap-3 bg-[#FFFCFA]">
              {!readOnly &&
                (confirmingDelete ? (
                  <div className="inline-flex items-center gap-2">
                    <span className="text-xs text-[#c25a52]">Delete?</span>
                    <button
                      type="button"
                      onClick={onDelete}
                      className="fm-focus-ring px-2.5 py-1 text-xs font-medium text-white bg-[#F37167] rounded-md hover:bg-[#e25b50] [transition-duration:120ms] transition-colors"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="fm-focus-ring px-2.5 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#F7F5FA] rounded-md [transition-duration:120ms] transition-colors"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="Delete activity"
                    onClick={() => setConfirmingDelete(true)}
                    className="fm-focus-ring text-[#A69DC0] hover:text-[#F37167] inline-flex items-center gap-1 text-xs [transition-duration:120ms] transition-colors"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
                  </button>
                ))}
              <div className="ml-auto flex items-center gap-3">
                {savedFlash && (
                  <span
                    aria-live="polite"
                    className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#5f665b]"
                    style={{ animation: "fmFlashIn 1400ms ease-out" }}
                  >
                    <CheckCircle2 className="w-3 h-3 text-[#69B34A]" />
                    Saved
                  </span>
                )}
                <button
                  type="button"
                  onClick={onClose}
                  className="fm-focus-ring px-3 py-1.5 text-xs font-medium text-[#6E6390] hover:bg-[#F7F5FA] rounded-md [transition-duration:120ms] transition-colors"
                >
                  Close
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>
    </>
  );
}
