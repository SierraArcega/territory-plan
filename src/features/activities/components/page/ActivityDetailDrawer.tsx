"use client";

import { useEffect, useState } from "react";
import { X, Trash2 } from "lucide-react";
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
  ACTIVITY_STATUS_CONFIG,
  type ActivityStatus,
} from "@/features/activities/types";
import OverviewPanel from "./drawer/OverviewPanel";
import OutcomePanel from "./drawer/OutcomePanel";
import NotesPanel from "./drawer/NotesPanel";
import ExpensesPanel from "./drawer/ExpensesPanel";
import FilesPanel from "./drawer/FilesPanel";

type TabId = "overview" | "outcome" | "notes" | "expenses" | "files";

const TABS: { id: TabId; label: string }[] = [
  { id: "overview", label: "Overview" },
  { id: "outcome", label: "Outcome" },
  { id: "notes", label: "Notes" },
  { id: "expenses", label: "Expenses" },
  { id: "files", label: "Files" },
];

type DrawerPatch = Partial<{
  status: ActivityStatus;
  startDate: string | null;
  endDate: string | null;
  notes: string | null;
  outcomeType: string | null;
  outcome: string | null;
}>;

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

  const readOnly = !!activity?.createdByUserId && activity.createdByUserId !== profile?.id;
  const expensesTotal = activity?.expenses.reduce((s, e) => s + Number(e.amount || 0), 0) ?? 0;
  const status = activity ? ACTIVITY_STATUS_CONFIG[activity.status] : null;

  function patch(data: DrawerPatch) {
    if (!activity) return;
    update.mutate(
      { activityId: activity.id, ...data },
      {
        onSuccess: () => {
          setSavedFlash(true);
          window.setTimeout(() => setSavedFlash(false), 1400);
        },
      }
    );
  }

  function onDelete() {
    if (!activity) return;
    remove.mutate(activity.id, { onSuccess: onClose });
  }

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
            <header className="relative flex items-start gap-3 px-5 py-4 border-b border-[#E2DEEC]">
              <span className="absolute left-0 top-0 bottom-0 w-1 bg-[#403770]" aria-hidden />
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 mb-1">
                  <span className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold text-[#403770] bg-[#EEEAF5] rounded">
                    {ACTIVITY_TYPE_LABELS[activity.type] ?? activity.type}
                  </span>
                  {status && (
                    <span
                      className="px-2 py-0.5 text-[10px] uppercase tracking-wider font-bold rounded"
                      style={{ backgroundColor: status.bgColor, color: status.color }}
                    >
                      {status.label}
                    </span>
                  )}
                </div>
                <h2 className="text-base font-bold text-[#403770] truncate">{activity.title}</h2>
                <div className="mt-1 text-[11px] text-[#8A80A8] flex items-center gap-3">
                  {activity.startDate && (
                    <span>{new Date(activity.startDate).toLocaleString(undefined, { dateStyle: "medium", timeStyle: "short" })}</span>
                  )}
                  {activity.districts[0] && <span>{activity.districts[0].name}</span>}
                </div>
              </div>
              <button
                type="button"
                onClick={onClose}
                aria-label="Close"
                className="w-8 h-8 inline-flex items-center justify-center rounded-md text-[#6E6390] hover:bg-[#F7F5FA]"
              >
                <X className="w-4 h-4" />
              </button>
            </header>

            {/* Tabs */}
            <div role="tablist" aria-label="Activity sections" className="flex items-center gap-1 px-5 border-b border-[#E2DEEC]">
              {TABS.map((t) => {
                const active = tab === t.id;
                return (
                  <button
                    key={t.id}
                    role="tab"
                    aria-selected={active}
                    type="button"
                    onClick={() => setTab(t.id)}
                    className={`px-3 py-2.5 text-sm font-medium border-b-2 -mb-px transition-colors ${
                      active
                        ? "border-[#403770] text-[#403770]"
                        : "border-transparent text-[#8A80A8] hover:text-[#403770]"
                    }`}
                  >
                    {t.label}
                  </button>
                );
              })}
            </div>

            {/* Body */}
            <div role="tabpanel" className="flex-1 overflow-hidden">
              {tab === "overview" && (
                <OverviewPanel
                  activity={activity}
                  notesCount={notes.length}
                  expensesTotal={expensesTotal}
                  attachmentsCount={attachments.length}
                  readOnly={readOnly}
                  onPatch={patch}
                />
              )}
              {tab === "outcome" && (
                <OutcomePanel
                  activity={activity}
                  readOnly={readOnly}
                  onPatch={patch}
                />
              )}
              {tab === "notes" && <NotesPanel activityId={activity.id} readOnly={readOnly} />}
              {tab === "expenses" && <ExpensesPanel activity={activity} readOnly={readOnly} />}
              {tab === "files" && <FilesPanel activityId={activity.id} readOnly={readOnly} />}
            </div>

            {/* Footer */}
            <footer className="border-t border-[#E2DEEC] px-5 py-3 flex items-center gap-3 bg-[#FFFCFA]">
              {!readOnly && (
                <>
                  {confirmingDelete ? (
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
                  )}
                </>
              )}
              <div className="ml-auto flex items-center gap-2">
                <span
                  aria-live="polite"
                  className={`text-[11px] transition-opacity ${
                    savedFlash ? "opacity-100 text-[#69B34A]" : "opacity-0"
                  }`}
                >
                  Saved
                </span>
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
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes fmSlideIn {
          from { transform: translateX(100%); }
          to { transform: translateX(0); }
        }
      `}</style>
    </>
  );
}
