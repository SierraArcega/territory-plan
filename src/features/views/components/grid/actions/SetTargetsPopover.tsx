"use client";
import { useEffect, useState, type RefObject } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useUpdateDistrictTargets } from "@/features/plans/lib/queries";
import { API_BASE, fetchJson } from "@/features/shared/lib/api-client";
import { AnchoredPopover } from "../AnchoredPopover";

interface Detail {
  renewalTarget: number | null;
  expansionTarget: number | null;
  winbackTarget: number | null;
  newBusinessTarget: number | null;
}

type Field = keyof Detail;

const FIELDS: { field: Field; label: string }[] = [
  { field: "renewalTarget", label: "Renewal" },
  { field: "expansionTarget", label: "Expansion" },
  { field: "winbackTarget", label: "Winback" },
  { field: "newBusinessTarget", label: "New business" },
];

function parseCurrency(v: string): number | null {
  const cleaned = v.replace(/[,$\s]/g, "");
  if (cleaned === "") return null;
  const n = parseFloat(cleaned);
  return Number.isNaN(n) ? null : n;
}

interface Props {
  planId: string;
  leaid: string;
  districtName: string;
  anchorRef: RefObject<HTMLElement | null>;
  open: boolean;
  onClose: () => void;
}

export function SetTargetsPopover({
  planId,
  leaid,
  districtName,
  anchorRef,
  open,
  onClose,
}: Props) {
  const queryClient = useQueryClient();
  const update = useUpdateDistrictTargets();

  // enabled:open keeps this from fetching for every row — only when the popover opens.
  const q = useQuery({
    queryKey: ["planDistrict", planId, leaid],
    queryFn: () =>
      fetchJson<Detail>(`${API_BASE}/territory-plans/${planId}/districts/${leaid}`),
    enabled: open,
  });

  const [vals, setVals] = useState<Record<Field, string>>({
    renewalTarget: "",
    expansionTarget: "",
    winbackTarget: "",
    newBusinessTarget: "",
  });

  // Reset to blank while closed so reopening never shows stale unsaved edits;
  // prefill from the server once data arrives.
  useEffect(() => {
    if (!open) {
      setVals({ renewalTarget: "", expansionTarget: "", winbackTarget: "", newBusinessTarget: "" });
      return;
    }
    if (!q.data) return;
    setVals({
      renewalTarget: q.data.renewalTarget != null ? String(q.data.renewalTarget) : "",
      expansionTarget: q.data.expansionTarget != null ? String(q.data.expansionTarget) : "",
      winbackTarget: q.data.winbackTarget != null ? String(q.data.winbackTarget) : "",
      newBusinessTarget:
        q.data.newBusinessTarget != null ? String(q.data.newBusinessTarget) : "",
    });
  }, [open, q.data]);

  function save() {
    update.mutate(
      {
        planId,
        leaid,
        renewalTarget: parseCurrency(vals.renewalTarget),
        expansionTarget: parseCurrency(vals.expansionTarget),
        winbackTarget: parseCurrency(vals.winbackTarget),
        newBusinessTarget: parseCurrency(vals.newBusinessTarget),
      },
      {
        onSuccess: () => {
          queryClient.invalidateQueries({ queryKey: ["views", "data"] });
          onClose();
        },
      },
    );
  }

  return (
    <AnchoredPopover anchorRef={anchorRef} open={open} onDismiss={onClose}>
      <div
        role="dialog"
        aria-modal="true"
        aria-label={`Set targets for ${districtName}`}
        style={{ width: 300, transform: "translateX(-268px)" }}
        className="rounded-xl border border-[#E2DEEC] bg-white p-3.5 shadow-[0_10px_30px_rgba(64,55,112,0.18)]"
      >
        <h4 className="m-0 mb-0.5 text-[13px] font-bold text-[#403770]">
          Set targets · {districtName}
        </h4>
        <p className="m-0 mb-3 text-[11px] text-[#8A80A8]">
          Enter any FY revenue target. Blank = unset.
        </p>
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(({ field, label }) => (
            <label key={field} className="block">
              <span className="mb-1 block text-[10px] font-bold uppercase tracking-[0.05em] text-[#8A80A8]">
                {label}
              </span>
              <input
                aria-label={label}
                value={vals[field]}
                onChange={(e) => setVals((p) => ({ ...p, [field]: e.target.value }))}
                placeholder="—"
                inputMode="numeric"
                className="w-full rounded-lg border border-[#E2DEEC] bg-[#FFFCFA] px-2.5 py-2 text-[13px] text-[#403770]"
              />
            </label>
          ))}
        </div>
        <div className="mt-3 flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-lg border border-[#E2DEEC] px-3.5 py-1.5 text-[12px] font-semibold text-[#544A78]"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={save}
            disabled={update.isPending || q.isLoading}
            className="rounded-lg bg-[#403770] px-3.5 py-1.5 text-[12px] font-semibold text-white disabled:opacity-60"
          >
            {update.isPending ? "Saving…" : "Save targets"}
          </button>
        </div>
      </div>
    </AnchoredPopover>
  );
}
