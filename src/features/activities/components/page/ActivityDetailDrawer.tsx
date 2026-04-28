"use client";

import { useEffect, useMemo, useState } from "react";
import { CheckCircle2, MoreVertical, Trash2, X } from "lucide-react";
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
}>;

const FLASH_MS = 1400;

export default function ActivityDetailDrawer({
  activityId,
  onClose,
}: {
  activityId: string | null;
  onClose: () => void;
}) {
  useEffect(() => {
    if (!activityId) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [activityId, onClose]);

  if (!activityId) return null;
  // Key the inner panel by activityId so tab/confirm/saved state resets fresh
  // when the drawer pivots to a different activity.
  return <DrawerInner key={activityId} activityId={activityId} onClose={onClose} />;
}

function DrawerInner({
  activityId,
  onClose,
}: {
  activityId: string;
  onClose: () => void;
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

  const readOnly =
    !!activity?.createdByUserId && activity.createdByUserId !== profile?.id;

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
        className="fixed top-0 right-0 z-50 h-full w-full md:w-[520px] bg-white shadow-2xl flex flex-col"
        style={{ animation: "fmSlideIn 250ms cubic-bezier(0.16, 1, 0.3, 1)" }}
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
                  {readOnly && (
                    <span className="ml-auto text-[10px] font-semibold text-[#6E6390] bg-[#EFEDF5] px-2 py-0.5 rounded-full whitespace-nowrap">
                      Read-only · team activity
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
                {/* TODO: overflow menu */}
                <button
                  type="button"
                  aria-label="More options"
                  title="More"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6390] hover:bg-[#F7F5FA]"
                >
                  <MoreVertical className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Close"
                  className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6390] hover:bg-[#F7F5FA]"
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
                      className="px-2.5 py-1 text-xs font-medium text-white bg-[#F37167] rounded-md hover:bg-[#e25b50]"
                    >
                      Yes
                    </button>
                    <button
                      type="button"
                      onClick={() => setConfirmingDelete(false)}
                      className="px-2.5 py-1 text-xs font-medium text-[#6E6390] hover:bg-[#F7F5FA] rounded-md"
                    >
                      No
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    aria-label="Delete activity"
                    onClick={() => setConfirmingDelete(true)}
                    className="text-[#A69DC0] hover:text-[#F37167] inline-flex items-center gap-1 text-xs"
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
                  className="px-3 py-1.5 text-xs font-medium text-[#6E6390] hover:bg-[#F7F5FA] rounded-md"
                >
                  Close
                </button>
              </div>
            </footer>
          </>
        )}
      </aside>

      <style jsx global>{`
        @keyframes fmFadeIn {
          from {
            opacity: 0;
          }
          to {
            opacity: 1;
          }
        }
        @keyframes fmSlideIn {
          from {
            transform: translateX(100%);
          }
          to {
            transform: translateX(0);
          }
        }
        @keyframes fmFlashIn {
          0% {
            opacity: 0;
            transform: translateY(-4px);
          }
          20% {
            opacity: 1;
            transform: translateY(0);
          }
          80% {
            opacity: 1;
          }
          100% {
            opacity: 0;
          }
        }
      `}</style>
    </>
  );
}
