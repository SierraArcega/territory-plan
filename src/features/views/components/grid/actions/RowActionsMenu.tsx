"use client";
import { useRef, useState } from "react";
import { lmsOpportunityUrl } from "./lms";
import { MoreHorizontal, Pencil, Target, Briefcase, X, StickyNote } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { AnchoredPopover } from "../AnchoredPopover";
import { useRemoveDistrictFromPlan } from "@/features/plans/lib/queries";
import { SetTargetsPopover } from "./SetTargetsPopover";
import ActivityFormModal from "@/features/activities/components/ActivityFormModal";
import { NotesPopover } from "@/features/views/components/notes/NotesPopover";

interface Props {
  planId: string;
  leaid: string;
  districtName: string;
}

type Surface = null | "targets" | "remove" | "activity" | "note";

export function RowActionsMenu({ planId, leaid, districtName }: Props) {
  const [open, setOpen] = useState(false);
  const [surface, setSurface] = useState<Surface>(null);
  const btnRef = useRef<HTMLButtonElement>(null);

  const queryClient = useQueryClient();
  const removeMutation = useRemoveDistrictFromPlan();

  const item =
    "flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#403770] hover:bg-[#F7F5FA]";

  function choose(next: Surface) {
    setOpen(false);
    setSurface(next);
  }

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        aria-label={`Actions for ${districtName}`}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((o) => !o)}
        className="rounded-md p-1 text-[#544A78] hover:bg-[#F7F5FA]"
      >
        <MoreHorizontal className="h-4 w-4" />
      </button>

      <AnchoredPopover anchorRef={btnRef} open={open} onDismiss={() => setOpen(false)}>
        {/* AnchoredPopover left-aligns under the anchor; shift a 220px panel left so it
            right-aligns under the ~32px right-edge kebab and stays on-screen. */}
        <div
          role="menu"
          aria-label="District actions"
          style={{ width: 220, transform: "translateX(-188px)" }}
          className="rounded-xl border border-[#E2DEEC] bg-white p-1.5 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
        >
          <button type="button" role="menuitem" className={item} onClick={() => choose("activity")}>
            <Pencil className="h-3.5 w-3.5 opacity-70" /> Log activity
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => choose("note")}>
            <StickyNote className="h-3.5 w-3.5 opacity-70" /> Add note
          </button>
          <button type="button" role="menuitem" className={item} onClick={() => choose("targets")}>
            <Target className="h-3.5 w-3.5 opacity-70" /> Set targets
          </button>
          <button
            type="button"
            role="menuitem"
            className={item}
            onClick={() => {
              window.open(lmsOpportunityUrl(), "_blank", "noopener,noreferrer");
              setOpen(false);
            }}
          >
            <Briefcase className="h-3.5 w-3.5 opacity-70" /> Create opportunity
            <span className="ml-auto text-[10px] text-[#A69DC0]">↗ LMS</span>
          </button>
          <div className="my-1 h-px bg-[#EFEDF5]" />
          <button
            type="button"
            role="menuitem"
            className="flex w-full items-center gap-2.5 rounded-md px-2.5 py-2 text-left text-[13px] text-[#c25a52] hover:bg-[#fef1f0]"
            onClick={() => choose("remove")}
          >
            <X className="h-3.5 w-3.5 opacity-80" /> Remove from plan
          </button>
        </div>
      </AnchoredPopover>

      {surface === "remove" && (
        <AnchoredPopover anchorRef={btnRef} open onDismiss={() => setSurface(null)}>
          <div
            role="dialog"
            aria-modal="true"
            aria-label="Confirm removal"
            style={{ width: 240, transform: "translateX(-208px)" }}
            className="rounded-xl border border-[#E2DEEC] bg-white p-3 shadow-[0_8px_24px_rgba(64,55,112,0.16)]"
          >
            <p className="m-0 mb-2.5 text-[13px] text-[#403770]">
              Remove <b>{districtName}</b> from this plan?
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                className="rounded-md border border-[#E2DEEC] px-3 py-1.5 text-[12px] text-[#544A78]"
                onClick={() => setSurface(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={removeMutation.isPending}
                className="rounded-md bg-[#c25a52] px-3 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
                onClick={() => {
                  removeMutation.mutate(
                    { planId, leaid },
                    {
                      onSuccess: () => {
                        queryClient.invalidateQueries({ queryKey: ["views", "data"] });
                        setSurface(null);
                      },
                    },
                  );
                }}
              >
                {removeMutation.isPending ? "Removing…" : "Remove"}
              </button>
            </div>
          </div>
        </AnchoredPopover>
      )}

      <SetTargetsPopover
        planId={planId}
        leaid={leaid}
        districtName={districtName}
        anchorRef={btnRef}
        open={surface === "targets"}
        onClose={() => setSurface(null)}
      />

      {surface === "activity" && (
        <ActivityFormModal
          isOpen
          onClose={() => setSurface(null)}
          defaultPlanId={planId}
          defaultDistricts={[{ leaid, name: districtName, stateAbbrev: null }]}
          onCreated={() => queryClient.invalidateQueries({ queryKey: ["views", "data"] })}
        />
      )}

      {surface === "note" && (
        <AnchoredPopover anchorRef={btnRef} open onDismiss={() => setSurface(null)}>
          <div style={{ transform: "translateX(-448px)" }}>
            <NotesPopover leaid={leaid} districtName={districtName} onClose={() => setSurface(null)} />
          </div>
        </AnchoredPopover>
      )}
    </>
  );
}
