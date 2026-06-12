"use client";

// OppFields — reusable create-or-link opportunity form (LeadOpportunity.jsx).
// Used by LinkOpportunityModal and the Outcome modal's required-opp section.
// "Create new" shows the Stage 0 context banner + name/product/amount/close
// fields; "Link existing" lists the lead's district's open opportunities
// first and searches the whole opportunities table (lead-district matches
// pinned on top of search results).

import { useState } from "react";
import { Briefcase, Search } from "lucide-react";
import { fmtDate } from "@/features/shared/lib/date-utils";
import {
  OPP_PRODUCTS,
  OPP_STAGES,
  fmtMoney,
  oppStageFromString,
} from "@/features/leads/lib/status-config";
import {
  suggestOppName,
  type OppDraft,
} from "@/features/leads/lib/opp-draft";
import { useOppSearchQuery, type DistrictOpenOpp } from "@/features/leads/lib/queries";
import MicroLabel from "../bits/MicroLabel";
import { ChoiceButton, FIELD_CLASS, SELECT_CLASS } from "./modal-chrome";

const STAGE0 = OPP_STAGES[0];

/** Search spans every district — float the lead's own district to the top. */
function pinDistrictFirst(opps: DistrictOpenOpp[], leaid: string | null) {
  if (!leaid) return opps;
  return [...opps].sort(
    (a, b) => Number(b.districtLeaId === leaid) - Number(a.districtLeaId === leaid),
  );
}

function OppRows({
  opps,
  emptyText,
  showDistrict,
  selectedId,
  onPick,
}: {
  opps: DistrictOpenOpp[];
  emptyText: string;
  /** Results span districts — show each row's district under the stage. */
  showDistrict: boolean;
  selectedId: string;
  onPick: (opp: DistrictOpenOpp) => void;
}) {
  if (opps.length === 0) {
    return (
      <div className="rounded-[10px] border border-dashed border-[#D4CFE2] px-3 py-[18px] text-center text-[12.5px] text-[#A69DC0]">
        {emptyText}
      </div>
    );
  }
  return (
    <div className="flex max-h-[300px] flex-col gap-2 overflow-y-auto">
      {opps.map((o) => {
        const sel = selectedId === o.id;
        const stage = oppStageFromString(o.stage);
        return (
          <button
            key={o.id}
            type="button"
            data-testid={`opp-row-${o.id}`}
            onClick={() => onPick(o)}
            className={`w-full shrink-0 rounded-[10px] border px-3 py-2.5 text-left transition-[border-color,box-shadow] duration-[120ms] ${
              sel
                ? "border-[#7A6FD0] bg-[#F7F5FD] shadow-[0_0_0_2px_rgba(122,111,208,0.15)]"
                : "border-[#E2DEEC] bg-white hover:border-[#C2BBD4]"
            }`}
          >
            <div className="mb-1 flex items-center justify-between gap-2">
              <span className="truncate text-[13px] font-semibold text-[#403770]">
                {o.name ?? "Opportunity"}
              </span>
              <span className="shrink-0 whitespace-nowrap text-[13px] font-bold tabular-nums text-[#403770]">
                {fmtMoney(o.netBookingAmount)}
              </span>
            </div>
            <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
              {stage ? (
                <span
                  className="inline-flex items-center gap-1.5 whitespace-nowrap rounded-full px-2 py-0.5 text-[10.5px] font-bold"
                  style={{ background: stage.bg, color: stage.fg }}
                >
                  <span className="tabular-nums opacity-85">Stage {stage.n}</span>
                  <span
                    className="h-[3px] w-[3px] rounded-full opacity-50"
                    style={{ background: stage.fg }}
                  />
                  {stage.label}
                </span>
              ) : (
                <span className="whitespace-nowrap rounded-full bg-[#F4F2F8] px-2 py-0.5 text-[10.5px] font-bold text-[#6E6390]">
                  {o.stage ?? "—"}
                </span>
              )}
              {showDistrict && o.districtName && (
                <span className="truncate whitespace-nowrap text-[11px] text-[#8A80A8]">
                  {o.districtName}
                </span>
              )}
              {o.closeDate && (
                <span className="whitespace-nowrap text-[11px] text-[#9E97B8]">
                  Close {fmtDate(o.closeDate)}
                </span>
              )}
            </div>
          </button>
        );
      })}
    </div>
  );
}

export interface OppFieldsProps {
  draft: OppDraft;
  onChange: (draft: OppDraft) => void;
  /** Open opportunities in the lead's district (Link-existing list). */
  openOpps: DistrictOpenOpp[] | undefined;
  openOppsLoading: boolean;
  /** Lead's district — labels the district list and pins its search matches. */
  districtLeaId?: string | null;
  districtName?: string | null;
  /** Fired with the full opp row when one is picked (toast context). */
  onPickOpp?: (opp: DistrictOpenOpp) => void;
}

export default function OppFields({
  draft,
  onChange,
  openOpps,
  openOppsLoading,
  districtLeaId,
  districtName,
  onPickOpp,
}: OppFieldsProps) {
  const set = (patch: Partial<OppDraft>) => onChange({ ...draft, ...patch });

  const [oppQuery, setOppQuery] = useState("");
  const searching = oppQuery.trim().length >= 2;
  const oppSearch = useOppSearchQuery(oppQuery);

  // Changing the product keeps the suggested name in sync unless the user
  // already customized it (the product is baked into the opp name — the
  // opportunities table has no separate product column).
  const setProduct = (product: string) => {
    const suffix = ` — ${draft.product}`;
    set({
      product,
      name: draft.name.endsWith(suffix)
        ? suggestOppName(draft.name.slice(0, -suffix.length), product)
        : draft.name,
    });
  };

  return (
    <div>
      {/* Create new vs. link existing */}
      <div className="mb-4 flex gap-2">
        <ChoiceButton active={draft.mode === "new"} onClick={() => set({ mode: "new" })}>
          Create new
        </ChoiceButton>
        <ChoiceButton
          active={draft.mode === "existing"}
          onClick={() => set({ mode: "existing" })}
        >
          Link existing
        </ChoiceButton>
      </div>

      {draft.mode === "existing" ? (
        <div>
          {/* Search the whole opportunities table */}
          <div className="relative mb-3">
            <Search
              size={14}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0]"
              aria-hidden
            />
            <input
              value={oppQuery}
              onChange={(e) => setOppQuery(e.target.value)}
              placeholder="Search all opportunities…"
              aria-label="Search all opportunities"
              className={`${FIELD_CLASS} pl-8`}
            />
          </div>
          <MicroLabel className="mb-[7px]">
            {searching
              ? "Search results"
              : districtName
                ? `Open at ${districtName}`
                : "Select an open opportunity"}
          </MicroLabel>
          {(searching ? oppSearch.isLoading : openOppsLoading) ? (
            <div className="flex flex-col gap-2">
              {Array.from({ length: 2 }).map((_, i) => (
                <div
                  key={i}
                  className="h-[72px] animate-pulse rounded-[10px] border border-[#EDEAF4] bg-[#FAF8FC]"
                />
              ))}
            </div>
          ) : (
            <OppRows
              opps={
                searching
                  ? pinDistrictFirst(oppSearch.data ?? [], districtLeaId ?? null)
                  : (openOpps ?? [])
              }
              emptyText={
                searching
                  ? "No open opportunities match."
                  : "No open opportunities at this district — search all of them above."
              }
              showDistrict={searching}
              selectedId={draft.existingId}
              onPick={(o) => {
                set({ existingId: o.id });
                onPickOpp?.(o);
              }}
            />
          )}
        </div>
      ) : (
        <>
          {/* Stage 0 context banner */}
          <div
            className="mb-4 flex items-center gap-2.5 rounded-[10px] border px-3 py-2.5"
            style={{ background: STAGE0.bg, borderColor: `${STAGE0.dot}33` }}
          >
            <Briefcase size={16} className="shrink-0" style={{ color: STAGE0.fg }} aria-hidden />
            <div className="min-w-0">
              <div
                className="whitespace-nowrap text-[12.5px] font-bold"
                style={{ color: STAGE0.fg }}
              >
                Creates a Stage 0 opportunity
              </div>
              <div className="mt-px text-[11px] text-[#8A80A8]">
                Opens at {STAGE0.prob}% · advances through the pipeline from here
              </div>
            </div>
          </div>

          <div className="mb-4">
            <MicroLabel className="mb-[7px]">Opportunity name</MicroLabel>
            <input
              value={draft.name}
              onChange={(e) => set({ name: e.target.value })}
              placeholder="District — Product"
              aria-label="Opportunity name"
              className={FIELD_CLASS}
            />
          </div>

          <div className="mb-4">
            <MicroLabel className="mb-[7px]">Product line</MicroLabel>
            <select
              value={draft.product}
              onChange={(e) => setProduct(e.target.value)}
              aria-label="Product line"
              className={SELECT_CLASS}
            >
              {OPP_PRODUCTS.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
            <div>
              <MicroLabel className="mb-[7px]">Est. amount</MicroLabel>
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[13px] font-semibold text-[#8A80A8]">
                  $
                </span>
                <input
                  type="number"
                  min={0}
                  step={1000}
                  value={draft.amount}
                  onChange={(e) => set({ amount: Number(e.target.value) })}
                  aria-label="Estimated amount"
                  className={`${FIELD_CLASS} pl-6 tabular-nums`}
                />
              </div>
            </div>
            <div>
              <MicroLabel className="mb-[7px]">Est. close date</MicroLabel>
              <input
                type="date"
                value={draft.closeDate}
                onChange={(e) => set({ closeDate: e.target.value })}
                aria-label="Estimated close date"
                className={`${FIELD_CLASS} cursor-pointer tabular-nums`}
              />
            </div>
          </div>
        </>
      )}
    </div>
  );
}
