"use client";

// Add lead — create-MQL form per LeadModals.jsx (AddMqlModal). The prototype's
// free-text "School / District name" + "NCES ID" + city/state fields are
// replaced by a real district combobox (search /api/districts/search) plus an
// optional school select scoped to the chosen district — dropdowns over
// typing, and location comes from the district record. Assigned BDR defaults
// to the current user; the created lead is auto-selected (create-and-add).

import { useState } from "react";
import { AlertTriangle, Check, ChevronDown, Plus, Search, X } from "lucide-react";
import { useToast } from "@/features/shared/components/Toast";
import { useProfile, useUsers } from "@/features/shared/lib/queries";
import {
  useDistrictNameSearch,
  type DistrictSearchResult,
} from "@/features/plans/lib/queries";
import {
  useCreateLeadMutation,
  useDistrictSchoolsQuery,
} from "@/features/leads/lib/queries";
import {
  LEAD_TYPES,
  LEAD_TYPE_ORDER,
  SEQUENCES,
  leadTypeConfig,
} from "@/features/leads/lib/status-config";
import type { Lead } from "@/features/leads/lib/types";
import MicroLabel from "../bits/MicroLabel";
import LeadModalShell, {
  BTN_GHOST,
  BTN_PRIMARY,
  FIELD_CLASS,
  FIELD_ERROR_CLASS,
  FieldLabel,
  SELECT_CLASS,
} from "./modal-chrome";

const SALUTATIONS = ["Dr.", "Mr.", "Ms.", "Mrs.", "Mx."];

/** District search combobox — results from /api/districts/search?name=. */
function DistrictCombobox({
  value,
  onSelect,
  error,
}: {
  value: DistrictSearchResult | null;
  onSelect: (d: DistrictSearchResult | null) => void;
  error: boolean;
}) {
  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const { data: results, isLoading } = useDistrictNameSearch(query.trim());

  if (value) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-[#C2BBD4] bg-[#FAF8FC] px-3 py-[9px]">
        <Check size={14} className="shrink-0 text-[#69B34A]" aria-hidden />
        <span className="min-w-0 flex-1 truncate text-[13.5px] font-semibold text-[#403770]">
          {value.name}
        </span>
        <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-[#8A80A8]">
          {value.stateAbbrev ?? ""} · NCES {value.leaid}
        </span>
        <button
          type="button"
          onClick={() => {
            onSelect(null);
            setQuery("");
          }}
          aria-label="Clear district"
          className="flex shrink-0 rounded p-0.5 text-[#8A80A8] hover:bg-[#EFEDF5] hover:text-[#403770]"
        >
          <X size={13} aria-hidden />
        </button>
      </div>
    );
  }

  return (
    <div className="relative">
      <Search
        size={14}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-[#A69DC0]"
        aria-hidden
      />
      <input
        value={query}
        onChange={(e) => {
          setQuery(e.target.value);
          setOpen(true);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => setTimeout(() => setOpen(false), 150)}
        placeholder="Search districts…"
        aria-label="Search districts"
        className={`${error ? FIELD_ERROR_CLASS : FIELD_CLASS} pl-8`}
      />
      {open && query.trim().length >= 2 && (
        <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-20 max-h-56 overflow-y-auto rounded-xl border border-[#E2DEEC] bg-white py-1 shadow-[0_10px_28px_-8px_rgba(64,55,112,0.22)]">
          {isLoading ? (
            <div className="px-3 py-2 text-[12.5px] text-[#A69DC0]">Searching…</div>
          ) : !results || results.length === 0 ? (
            <div className="px-3 py-2 text-[12.5px] text-[#A69DC0]">No districts found.</div>
          ) : (
            results.map((d) => (
              <button
                key={d.leaid}
                type="button"
                // onMouseDown so the click beats the input's onBlur close.
                onMouseDown={(e) => {
                  e.preventDefault();
                  onSelect(d);
                  setOpen(false);
                }}
                className="flex w-full items-center gap-2 px-3 py-2 text-left hover:bg-[#F7F5FA]"
              >
                <span className="min-w-0 flex-1 truncate text-[13px] font-semibold text-[#403770]">
                  {d.name}
                </span>
                <span className="shrink-0 whitespace-nowrap text-[11px] tabular-nums text-[#8A80A8]">
                  {d.stateAbbrev ?? ""} · NCES {d.leaid}
                </span>
              </button>
            ))
          )}
        </div>
      )}
    </div>
  );
}

export interface AddLeadModalProps {
  onClose: () => void;
  /** Create-and-add: the new lead is auto-selected by the caller. */
  onCreated: (lead: Lead) => void;
}

export default function AddLeadModal({ onClose, onCreated }: AddLeadModalProps) {
  const [salutation, setSalutation] = useState("");
  const [first, setFirst] = useState("");
  const [last, setLast] = useState("");
  const [title, setTitle] = useState("");
  const [district, setDistrict] = useState<DistrictSearchResult | null>(null);
  const [schoolNcessch, setSchoolNcessch] = useState("");
  const [email, setEmail] = useState("");
  const [phone, setPhone] = useState("");
  const [leadType, setLeadType] = useState("mql");
  const [score, setScore] = useState("");
  const [bdr, setBdr] = useState<string | null>(null);
  const [sequence, setSequence] = useState<string>(SEQUENCES[0]);
  const [marketingOwner, setMarketingOwner] = useState("");
  const [showErr, setShowErr] = useState(false);
  const [serverError, setServerError] = useState<string | null>(null);

  const { data: profile } = useProfile();
  const { data: users, isLoading: usersLoading } = useUsers();
  const { data: schools, isLoading: schoolsLoading } = useDistrictSchoolsQuery(
    district?.leaid ?? null,
  );
  const createLead = useCreateLeadMutation();
  const { showToast } = useToast();

  // Default the assigned BDR to the current user (UX rule).
  const bdrValue = bdr ?? profile?.id ?? "";

  const missing = {
    first: !first.trim(),
    last: !last.trim(),
    title: !title.trim(),
    district: !district,
    email: !email.trim(),
  };
  const anyMissing = Object.values(missing).some(Boolean);
  const fieldClass = (key: keyof typeof missing) =>
    showErr && missing[key] ? FIELD_ERROR_CLASS : FIELD_CLASS;

  const submit = () => {
    if (anyMissing) {
      setShowErr(true);
      return;
    }
    if (createLead.isPending) return;
    setServerError(null);
    const typeLabel = leadTypeConfig(leadType).label;
    createLead.mutate(
      {
        leaid: district!.leaid,
        schoolNcessch: schoolNcessch || null,
        contactName: [salutation, first.trim(), last.trim()].filter(Boolean).join(" "),
        contactTitle: title.trim(),
        email: email.trim(),
        phone: phone.trim() || null,
        leadType,
        sequence,
        marketingOwner: marketingOwner.trim() || null,
        assignedBdrId: bdrValue || null,
        // Prototype default: an unstated score lands at the 100-pt MQL threshold.
        score: parseInt(score, 10) || 100,
      },
      {
        onSuccess: (lead) => {
          showToast(`${typeLabel} added · ${district!.name}`, { tone: "success" });
          onCreated(lead);
        },
        onError: (error: Error) => {
          setServerError(error.message.replace(/^\d{3}:\s*/, "") || "Failed to create lead");
        },
      },
    );
  };

  return (
    <LeadModalShell
      title="Add lead"
      subtitle="Create a lead and route it to a BDR — the acceptance SLA starts on assignment"
      onClose={onClose}
      maxWidth="max-w-[560px]"
      footer={
        <>
          <button type="button" onClick={onClose} className={BTN_GHOST}>
            Cancel
          </button>
          <button
            type="button"
            onClick={submit}
            disabled={createLead.isPending}
            className={BTN_PRIMARY}
          >
            <Plus size={15} aria-hidden />
            Add &amp; assign
          </button>
        </>
      }
    >
      <MicroLabel className="mb-3">Core contact</MicroLabel>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-[0.6fr_1fr_1fr]">
        <div>
          <FieldLabel>Salutation</FieldLabel>
          <select
            value={salutation}
            onChange={(e) => setSalutation(e.target.value)}
            aria-label="Salutation"
            className={SELECT_CLASS}
          >
            <option value="">—</option>
            {SALUTATIONS.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel req>First name</FieldLabel>
          <input
            value={first}
            onChange={(e) => setFirst(e.target.value)}
            placeholder="Karen"
            aria-label="First name"
            className={fieldClass("first")}
          />
        </div>
        <div>
          <FieldLabel req>Last name</FieldLabel>
          <input
            value={last}
            onChange={(e) => setLast(e.target.value)}
            placeholder="Whitfield"
            aria-label="Last name"
            className={fieldClass("last")}
          />
        </div>
      </div>
      <div className="mt-3.5">
        <FieldLabel req>Title</FieldLabel>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Director of Special Education"
          aria-label="Title"
          className={fieldClass("title")}
        />
      </div>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <FieldLabel req>District</FieldLabel>
          <DistrictCombobox
            value={district}
            onSelect={(d) => {
              setDistrict(d);
              setSchoolNcessch("");
            }}
            error={showErr && missing.district}
          />
        </div>
        <div>
          <FieldLabel>School</FieldLabel>
          <div className="relative">
            <select
              value={schoolNcessch}
              onChange={(e) => setSchoolNcessch(e.target.value)}
              disabled={!district || schoolsLoading}
              aria-label="School"
              className={`${SELECT_CLASS} appearance-none pr-8 disabled:cursor-not-allowed disabled:bg-[#FAF8FC] disabled:text-[#A69DC0]`}
            >
              <option value="">
                {!district
                  ? "Pick a district first"
                  : schoolsLoading
                    ? "Loading schools…"
                    : "District office"}
              </option>
              {(schools ?? []).map((s) => (
                <option key={s.ncessch} value={s.ncessch}>
                  {s.schoolName ?? s.ncessch}
                </option>
              ))}
            </select>
            <ChevronDown
              size={14}
              className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-[#A69DC0]"
              aria-hidden
            />
          </div>
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <FieldLabel req>Email</FieldLabel>
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="name@district.org"
            aria-label="Email"
            className={fieldClass("email")}
          />
        </div>
        <div>
          <FieldLabel>Phone</FieldLabel>
          <input
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            placeholder="(970) 555-0142"
            aria-label="Phone"
            className={FIELD_CLASS}
          />
        </div>
      </div>

      <MicroLabel className="mb-3 mt-[22px]">Qualification &amp; routing</MicroLabel>
      <div className="grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <FieldLabel>Lead type</FieldLabel>
          <select
            value={leadType}
            onChange={(e) => setLeadType(e.target.value)}
            aria-label="Lead type"
            className={SELECT_CLASS}
          >
            {LEAD_TYPE_ORDER.map((k) => (
              <option key={k} value={k}>
                {LEAD_TYPES[k].label}
              </option>
            ))}
          </select>
        </div>
        <div>
          <FieldLabel>Engagement score</FieldLabel>
          <input
            type="number"
            value={score}
            onChange={(e) => setScore(e.target.value)}
            placeholder="100"
            aria-label="Engagement score"
            className={`${FIELD_CLASS} tabular-nums`}
          />
        </div>
      </div>
      <div className="mt-3.5 grid grid-cols-1 gap-3.5 sm:grid-cols-2">
        <div>
          <FieldLabel>Assign to BDR</FieldLabel>
          {usersLoading || !users ? (
            <select disabled aria-label="Assign to BDR" className={`${SELECT_CLASS} text-[#A69DC0]`}>
              <option>Loading…</option>
            </select>
          ) : (
            <select
              value={bdrValue}
              onChange={(e) => setBdr(e.target.value)}
              aria-label="Assign to BDR"
              className={SELECT_CLASS}
            >
              {users.map((u) => (
                <option key={u.id} value={u.id}>
                  {u.fullName ?? u.email}
                  {u.id === profile?.id ? " (You)" : ""}
                </option>
              ))}
            </select>
          )}
        </div>
        <div>
          <FieldLabel>Outreach sequence</FieldLabel>
          <select
            value={sequence}
            onChange={(e) => setSequence(e.target.value)}
            aria-label="Outreach sequence"
            className={SELECT_CLASS}
          >
            {SEQUENCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div className="mt-3.5">
        <FieldLabel>Marketing owner</FieldLabel>
        <input
          value={marketingOwner}
          onChange={(e) => setMarketingOwner(e.target.value)}
          placeholder="Jules Okafor"
          aria-label="Marketing owner"
          className={FIELD_CLASS}
        />
      </div>

      {showErr && anyMissing && (
        <div className="mt-4 flex items-center gap-1.5 text-xs text-[#C25A52]">
          <AlertTriangle size={14} className="shrink-0" aria-hidden />
          Fill in the required fields to continue.
        </div>
      )}
      {serverError && (
        <div className="mt-4 flex items-center gap-1.5 rounded-lg border border-[#F7C9C5] bg-[#FEF1F0] px-3 py-2 text-xs font-semibold text-[#C25A52]">
          <AlertTriangle size={14} className="shrink-0" aria-hidden />
          {serverError}
        </div>
      )}
    </LeadModalShell>
  );
}
