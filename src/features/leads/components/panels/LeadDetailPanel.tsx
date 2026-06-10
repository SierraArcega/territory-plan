"use client";

// Lead detail panel — right slide-in (min(640px, 100vw-24px), full-width sheet
// < 640px) over a plum/28% backdrop. Sections per handoff §5: header (badges,
// name, title), status-aware action zone, linked-opportunity card, engagement
// score, contact block (Contact record / School / District rows), qualification
// fields, and the merged activity timeline. Esc closes unless a record panel
// is stacked above (escDisabled). Pixels per LeadDetailPanel.jsx.
//
// Modal slots (L8): onLogOutcome / onDisqualify / onLinkOpportunity /
// onScheduleMeeting only flip LeadsView's `modal` state — the modals
// themselves land in L8. Accept, Sales-qualify, lead-type and BDR assignment
// PATCH directly (with optimistic status + toast via useUpdateLeadMutation).

import { useState, type ReactNode } from "react";
import {
  ArrowRight,
  Briefcase,
  Calendar,
  Check,
  CheckCircle2,
  Clock,
  GraduationCap,
  Link2,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Plus,
  School,
  Target,
  X,
  Zap,
} from "lucide-react";
import { useToast } from "@/features/shared/components/Toast";
import UserAvatar from "@/features/shared/components/UserAvatar";
import { useUsers } from "@/features/shared/lib/queries";
import { fmtDate } from "@/features/shared/lib/date-utils";
import { useUpdateLeadMutation } from "@/features/leads/lib/queries";
import {
  LEAD_TYPES,
  LEAD_TYPE_ORDER,
  OPP_ADVANCED_MESSAGE,
  SEQUENCES,
  fmtMoney,
  leadTypeConfig,
  oppStageFromString,
} from "@/features/leads/lib/status-config";
import { BTN_PRIMARY } from "../modals/modal-chrome";
import { slaState, type SlaState } from "@/features/leads/lib/sla";
import type { Lead, LeadOpportunity, RecordRef } from "@/features/leads/lib/types";
import StatusBadge from "../bits/StatusBadge";
import LeadTypeBadge from "../bits/LeadTypeBadge";
import SlaBadge from "../bits/SlaBadge";
import ScorePill from "../bits/ScorePill";
import MicroLabel from "../bits/MicroLabel";
import LeadActivityTimeline from "../LeadActivityTimeline";
import {
  PANEL_SLIDE_ANIMATION,
  PanelBackdrop,
  PanelKeyframes,
  useEscapeKey,
} from "./panel-chrome";

const SELECT_CLASS =
  "w-full cursor-pointer rounded-lg border border-[#C2BBD4] bg-white px-3 py-[9px] text-[13px] text-[#403770] outline-none focus:border-[#403770]";

export interface LeadDetailPanelProps {
  lead: Lead;
  currentUserId: string | null;
  onClose: () => void;
  /** True while a record panel is stacked above — Esc belongs to it then. */
  escDisabled?: boolean;
  /** Push a record panel (Contact / School / District) onto the stack. */
  onOpenRecord: (ref: RecordRef) => void;
  /** L8 modal slots — set LeadsView's `modal`; render nothing until L8. */
  onLogOutcome: () => void;
  onDisqualify: () => void;
  onLinkOpportunity: () => void;
  onScheduleMeeting: () => void;
  /** Injectable clock for tests. */
  now?: Date;
}

export default function LeadDetailPanel({
  lead,
  currentUserId,
  onClose,
  escDisabled = false,
  onOpenRecord,
  onLogOutcome,
  onDisqualify,
  onLinkOpportunity,
  onScheduleMeeting,
  now,
}: LeadDetailPanelProps) {
  const updateLead = useUpdateLeadMutation();
  const { showToast } = useToast();
  // Transient UI — LeadsView keys this panel by lead.id, so switching leads
  // remounts the panel and resets this naturally.
  const [reassignOpen, setReassignOpen] = useState(false);

  useEscapeKey(onClose, !escDisabled);

  const contactName = lead.contact?.name ?? "Lead";
  const sla = lead.status === "new" ? slaState(lead.assignedAt, now) : null;

  const accept = () => {
    updateLead.mutate(
      { id: lead.id, status: "working" },
      {
        onSuccess: () =>
          showToast(`Lead accepted · ${lead.district?.name ?? contactName}`, {
            tone: "success",
          }),
      },
    );
  };

  const salesQualify = () => {
    updateLead.mutate(
      { id: lead.id, status: "sales_qualified" },
      {
        onSuccess: () =>
          showToast(
            lead.opportunity
              ? OPP_ADVANCED_MESSAGE
              : `${contactName} → Sales Qualified Lead`,
            { tone: "success" },
          ),
      },
    );
  };

  const setLeadType = (leadType: string) => {
    updateLead.mutate(
      { id: lead.id, leadType },
      {
        onSuccess: () =>
          showToast(`Type · ${leadTypeConfig(leadType).label}`, { tone: "success" }),
      },
    );
  };

  const assignBdr = (assignedBdrId: string, bdrName: string) => {
    updateLead.mutate(
      { id: lead.id, assignedBdrId },
      { onSuccess: () => showToast(`Assigned to ${bdrName}`, { tone: "success" }) },
    );
  };

  // Route an unassigned New lead to a BDR — the server restarts the SLA clock
  // (assignedAt) on this first assignment; sequence rides along when changed.
  const routeToBdr = (assignedBdrId: string, bdrName: string, sequence: string) => {
    updateLead.mutate(
      {
        id: lead.id,
        assignedBdrId,
        ...(sequence !== lead.sequence ? { sequence } : {}),
      },
      {
        onSuccess: () =>
          showToast(`Assigned to ${bdrName} · SLA started`, { tone: "success" }),
      },
    );
  };

  const canDisqualify = ["new", "working", "meeting_scheduled"].includes(lead.status);
  const editable = canDisqualify; // terminal statuses are read-only

  return (
    <>
      <PanelKeyframes />
      <PanelBackdrop onClick={onClose} zIndex={40} />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={`Lead: ${contactName}`}
        className="absolute inset-y-0 right-0 z-[41] flex w-full flex-col border-l border-[#D4CFE2] bg-white shadow-[-10px_0_28px_-8px_rgba(64,55,112,0.22)] sm:w-[min(640px,calc(100vw-24px))]"
        style={{ animation: PANEL_SLIDE_ANIMATION }}
      >
        {/* Header */}
        <div className="border-b border-[#EFEDF5] px-[22px] pb-4 pt-[18px]">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="mb-1.5 flex flex-wrap items-center gap-2">
                <StatusBadge status={lead.status} size="sm" />
                <LeadTypeBadge type={lead.leadType} size="sm" />
                {sla && <SlaBadge assignedAt={lead.assignedAt} compact now={now} />}
              </div>
              <h2 className="text-xl font-bold tracking-[-0.01em] text-[#403770] [overflow-wrap:anywhere]">
                {contactName}
              </h2>
              {lead.contact?.title && (
                <div className="mt-0.5 text-[13px] text-[#8A80A8]">
                  {lead.contact.title}
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close lead panel"
              className="flex shrink-0 rounded-lg p-1.5 text-[#8A80A8] transition-colors duration-[120ms] hover:bg-[#EFEDF5] hover:text-[#403770]"
            >
              <X size={18} aria-hidden />
            </button>
          </div>
        </div>

        {/* Body */}
        <div className="min-h-0 flex-1 overflow-y-auto px-[22px] pb-7 pt-5 [touch-action:pan-y]">
          <ActionZone
            lead={lead}
            sla={sla}
            now={now}
            currentUserId={currentUserId}
            reassignOpen={reassignOpen}
            onToggleReassign={() => setReassignOpen((v) => !v)}
            onAccept={accept}
            onSalesQualify={salesQualify}
            onAssignBdr={assignBdr}
            onRoute={routeToBdr}
            onLogOutcome={onLogOutcome}
            onLinkOpportunity={onLinkOpportunity}
            onScheduleMeeting={onScheduleMeeting}
          />

          {/* Disqualify — history is preserved on the records (modal in L8) */}
          {canDisqualify && (
            <div className="-mt-2 mb-[18px] flex justify-end">
              <button
                type="button"
                onClick={onDisqualify}
                className="inline-flex items-center gap-[5px] whitespace-nowrap py-0.5 text-xs font-semibold text-[#9E97B8] transition-colors duration-[120ms] hover:text-[#C25A52]"
              >
                <X size={13} aria-hidden />
                Disqualify lead
              </button>
            </div>
          )}

          {/* Linked opportunity */}
          {lead.opportunity && <OppCard opp={lead.opportunity} now={now} />}

          {/* Engagement score */}
          <div className="mb-[18px] mt-1 flex items-center justify-between rounded-[10px] border border-[#EDEAF4] bg-[#FAF8FC] px-3.5 py-3">
            <div>
              <MicroLabel>Engagement score</MicroLabel>
              <div className="mt-[5px]">
                <ScorePill score={lead.score} withBar />
              </div>
            </div>
            <div className="text-right text-[11px] text-[#8A80A8]">
              <span className="whitespace-nowrap">MQL threshold</span>
              <br />
              <span className="whitespace-nowrap font-bold tabular-nums text-[#403770]">
                100 pts
              </span>
            </div>
          </div>

          {/* Contact block */}
          <div className="mb-3 flex items-center justify-between">
            <MicroLabel>Contact</MicroLabel>
            {lead.contact && (
              <button
                type="button"
                onClick={() =>
                  onOpenRecord({
                    type: "contact",
                    id: lead.contact!.id,
                    label: lead.contact!.name,
                  })
                }
                className="inline-flex items-center gap-1 whitespace-nowrap text-[11.5px] font-bold text-[#6EA3BE] hover:text-[#4D7285]"
              >
                Contact record
                <ArrowRight size={12} aria-hidden />
              </button>
            )}
          </div>
          <div className="mb-[22px] grid grid-cols-1 gap-4 sm:grid-cols-2">
            {lead.school && (
              <div className="flex items-start gap-2.5">
                <GraduationCap size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />
                <div className="min-w-0">
                  <MicroLabel>School</MicroLabel>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRecord({
                        type: "school",
                        id: lead.school!.ncessch,
                        label: lead.school!.name ?? "School",
                      })
                    }
                    className="mt-0.5 inline-flex items-center gap-1 text-left text-[13.5px] font-semibold text-[#6EA3BE] [overflow-wrap:anywhere] hover:text-[#4D7285]"
                  >
                    {lead.school.name ?? lead.school.ncessch}
                    <ArrowRight size={12} className="shrink-0" aria-hidden />
                  </button>
                </div>
              </div>
            )}
            {lead.district && (
              <div className="flex items-start gap-2.5">
                <School size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />
                <div className="min-w-0">
                  <MicroLabel>{`District · NCES ${lead.district.leaid}`}</MicroLabel>
                  <button
                    type="button"
                    onClick={() =>
                      onOpenRecord({
                        type: "district",
                        id: lead.district!.leaid,
                        label: lead.district!.name,
                      })
                    }
                    className="mt-0.5 inline-flex items-center gap-1 text-left text-[13.5px] font-semibold text-[#6EA3BE] [overflow-wrap:anywhere] hover:text-[#4D7285]"
                  >
                    {lead.district.name}
                    <ArrowRight size={12} className="shrink-0" aria-hidden />
                  </button>
                  {!lead.school && (
                    <div className="mt-px text-[11px] text-[#A69DC0]">District office</div>
                  )}
                </div>
              </div>
            )}
            <Field
              icon={<MapPin size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />}
              label="Location"
              value={
                lead.district?.city
                  ? `${lead.district.city}, ${lead.district.stateAbbrev ?? ""}`.replace(/, $/, "")
                  : "—"
              }
            />
            <Field
              icon={<Mail size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />}
              label="Email"
              value={lead.contact?.email ?? "—"}
            />
            <Field
              icon={<Phone size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />}
              label="Phone"
              value={lead.contact?.phone ?? "—"}
              mono
            />
          </div>

          {/* Qualification */}
          <MicroLabel className="mb-3">Qualification</MicroLabel>
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2">
            <div>
              <MicroLabel>Lead type</MicroLabel>
              {editable ? (
                <select
                  value={lead.leadType ?? "other"}
                  onChange={(e) => setLeadType(e.target.value)}
                  aria-label="Lead type"
                  className={`${SELECT_CLASS} mt-1 w-auto min-w-[130px] px-2.5 py-1.5`}
                >
                  {LEAD_TYPE_ORDER.map((k) => (
                    <option key={k} value={k}>
                      {LEAD_TYPES[k].label}
                    </option>
                  ))}
                </select>
              ) : (
                <div className="mt-1.5">
                  <LeadTypeBadge type={lead.leadType} />
                </div>
              )}
            </div>
            <Field
              icon={<Calendar size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />}
              label="Created"
              value={fmtDate(lead.createdAt, now)}
            />
            {lead.district && (
              <Field
                icon={<School size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />}
                label="NCES ID"
                value={lead.district.leaid}
                mono
              />
            )}
            <div>
              <MicroLabel>Assigned BDR</MicroLabel>
              {editable ? (
                <BdrSelect
                  value={lead.assignedBdr?.id ?? null}
                  currentUserId={currentUserId}
                  onAssign={assignBdr}
                  className="mt-1"
                />
              ) : (
                <div className="mt-0.5 inline-flex items-center gap-[7px] text-[13.5px] text-[#403770]">
                  {lead.assignedBdr ? (
                    <>
                      <UserAvatar
                        name={lead.assignedBdr.fullName}
                        avatarUrl={lead.assignedBdr.avatarUrl}
                        size={20}
                      />
                      <span className="whitespace-nowrap">{lead.assignedBdr.fullName}</span>
                    </>
                  ) : (
                    "Unassigned"
                  )}
                </div>
              )}
            </div>
            <Field
              icon={
                <MessageSquare size={15} className="mt-0.5 shrink-0 text-[#A69DC0]" aria-hidden />
              }
              label="Sequence"
              value={lead.sequence ?? "—"}
            />
            <Field label="Marketing owner" value={lead.marketingOwner ?? "—"} />
          </div>

          {/* Activity & engagement */}
          <div className="mb-1.5 flex items-center justify-between">
            <MicroLabel>Activity &amp; engagement</MicroLabel>
            {(lead.status === "working" || lead.status === "meeting_scheduled") && (
              <button
                type="button"
                onClick={onLogOutcome}
                className="inline-flex items-center gap-[5px] whitespace-nowrap text-xs font-bold text-[#F37167] hover:text-[#e25f55]"
              >
                <Plus size={13} aria-hidden />
                Log activity
              </button>
            )}
          </div>
          <div className="mb-3 flex items-start gap-1.5 text-[11px] leading-[1.4] text-[#9E97B8]">
            <Link2 size={12} className="mt-px shrink-0 text-[#C2BBD4]" aria-hidden />
            Shared with the contact and district records — kept if this lead is
            disqualified or sales-qualified.
          </div>
          <LeadActivityTimeline leadId={lead.id} now={now} />
        </div>
      </aside>
    </>
  );
}

// ---- Pieces -------------------------------------------------------------------

function Field({
  icon,
  label,
  value,
  mono = false,
}: {
  icon?: ReactNode;
  label: string;
  value: ReactNode;
  mono?: boolean;
}) {
  return (
    <div className="flex items-start gap-2.5">
      {icon}
      <div className="min-w-0">
        <MicroLabel>{label}</MicroLabel>
        <div
          className={`mt-0.5 text-[13.5px] text-[#403770] [overflow-wrap:anywhere] ${
            mono ? "tabular-nums" : ""
          }`}
        >
          {value}
        </div>
      </div>
    </div>
  );
}

/** BDR assignment select — options from useUsers(); disabled placeholder while loading. */
function BdrSelect({
  value,
  currentUserId,
  onAssign,
  className = "",
}: {
  value: string | null;
  currentUserId: string | null;
  onAssign: (id: string, name: string) => void;
  className?: string;
}) {
  const { data: users, isLoading } = useUsers();
  if (isLoading || !users) {
    return (
      <select disabled aria-label="Assigned BDR" className={`${SELECT_CLASS} ${className} text-[#A69DC0]`}>
        <option>Loading…</option>
      </select>
    );
  }
  // Default sensibly: the saved BDR, else the current user (UX rule).
  const selected = value ?? currentUserId ?? "";
  return (
    <select
      value={selected}
      aria-label="Assigned BDR"
      onChange={(e) => {
        const u = users.find((x) => x.id === e.target.value);
        if (u) onAssign(u.id, u.fullName ?? u.email);
      }}
      className={`${SELECT_CLASS} ${className}`}
    >
      {!selected && <option value="">Unassigned</option>}
      {users.map((u) => (
        <option key={u.id} value={u.id}>
          {u.fullName ?? u.email}
          {u.id === currentUserId ? " (You)" : ""}
        </option>
      ))}
    </select>
  );
}

/** Linked-opportunity summary card (OppCard in the handoff). */
function OppCard({ opp, now }: { opp: LeadOpportunity; now?: Date }) {
  const stage = oppStageFromString(opp.stage);
  return (
    <div className="mb-[22px] overflow-hidden rounded-xl border border-[#E2DEEC]">
      <div className="flex items-center gap-[9px] border-b border-[#EDEAF4] bg-[#FAF8FC] px-3.5 py-[11px]">
        <Briefcase size={15} className="shrink-0 text-[#7A6FD0]" aria-hidden />
        <MicroLabel>Linked opportunity</MicroLabel>
        <span className="ml-auto">
          {stage ? (
            <span
              title={`Stage ${stage.n} · ${stage.label} — ${stage.definition}`}
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
              {opp.stage ?? "—"}
            </span>
          )}
        </span>
      </div>
      <div className="px-3.5 pb-3.5 pt-[13px]">
        <div className="mb-[13px] text-sm font-bold tracking-[-0.01em] text-[#403770] [overflow-wrap:anywhere]">
          {opp.name ?? "Opportunity"}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <OppMeta label="Amount" value={fmtMoney(opp.amount)} />
          <OppMeta
            label="Close"
            value={opp.closeDate ? fmtDate(opp.closeDate, now) : "—"}
          />
          <OppMeta label="Win prob." value={stage ? `${stage.prob}%` : "—"} />
        </div>
      </div>
    </div>
  );
}

function OppMeta({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <div className="whitespace-nowrap text-[10px] font-bold uppercase tracking-[0.07em] text-[#A69DC0]">
        {label}
      </div>
      <div className="mt-[3px] whitespace-nowrap text-[13px] font-semibold tabular-nums text-[#403770]">
        {value}
      </div>
    </div>
  );
}

// ---- Action zone ----------------------------------------------------------------

const BTN_CORAL =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg bg-[#F37167] px-4 py-2 text-sm font-medium text-white transition-colors duration-[120ms] hover:bg-[#e25f55]";
const BTN_SECONDARY =
  "inline-flex items-center gap-1.5 whitespace-nowrap rounded-lg border border-[#D4CFE2] bg-white px-3.5 py-2 text-[13px] font-semibold text-[#403770] transition-colors duration-[120ms] hover:bg-[#F7F5FA]";

function ZoneCard({ children, tone }: { children: ReactNode; tone?: "alert" }) {
  return (
    <div
      data-testid="action-zone"
      className="mb-5 rounded-xl border p-3.5"
      style={
        tone === "alert"
          ? { borderColor: "#F7C9C5", background: "#FEF6F5" }
          : { borderColor: "#E2DEEC", background: "#FFFCFA" }
      }
    >
      {children}
    </div>
  );
}

/**
 * Routing branch for an unassigned New lead (prototype LeadDetailPanel.jsx):
 * Marketing routes to a BDR + sequence; assignment starts the acceptance SLA.
 */
function RouteZone({
  lead,
  currentUserId,
  onRoute,
}: {
  lead: Lead;
  currentUserId: string | null;
  onRoute: (id: string, name: string, sequence: string) => void;
}) {
  const { data: users, isLoading } = useUsers();
  const [bdrId, setBdrId] = useState(currentUserId ?? "");
  const [sequence, setSequence] = useState(lead.sequence ?? SEQUENCES[0]);
  const labelClass = "mb-[5px] block whitespace-nowrap text-[11px] font-semibold text-[#6E6390]";
  return (
    <ZoneCard>
      <div className="mb-2.5 flex items-center gap-2">
        <Zap size={16} className="shrink-0 text-[#9A7B3F]" aria-hidden />
        <span className="whitespace-nowrap text-[13px] font-bold text-[#403770]">
          Route to a BDR
        </span>
      </div>
      <div className="mb-3 text-xs text-[#8A80A8]">
        New {leadTypeConfig(lead.leadType).label} lead, unassigned. Routing to a
        BDR starts the 2-business-day acceptance SLA.
      </div>
      <label className={labelClass} htmlFor="route-bdr">
        Assign to BDR
      </label>
      {isLoading || !users ? (
        <select id="route-bdr" disabled className={`${SELECT_CLASS} text-[#A69DC0]`}>
          <option>Loading…</option>
        </select>
      ) : (
        <select
          id="route-bdr"
          value={bdrId}
          onChange={(e) => setBdrId(e.target.value)}
          className={SELECT_CLASS}
        >
          {users.map((u) => (
            <option key={u.id} value={u.id}>
              {u.fullName ?? u.email}
              {u.id === currentUserId ? " (You)" : ""}
            </option>
          ))}
        </select>
      )}
      <label className={`${labelClass} mt-3`} htmlFor="route-sequence">
        Outreach sequence
      </label>
      <select
        id="route-sequence"
        value={sequence}
        onChange={(e) => setSequence(e.target.value)}
        className={SELECT_CLASS}
      >
        {SEQUENCES.map((s) => (
          <option key={s} value={s}>
            {s}
          </option>
        ))}
        {lead.sequence && !(SEQUENCES as readonly string[]).includes(lead.sequence) && (
          <option value={lead.sequence}>{lead.sequence}</option>
        )}
      </select>
      <div className="mt-3.5">
        <button
          type="button"
          disabled={!bdrId}
          onClick={() => {
            const u = users?.find((x) => x.id === bdrId);
            if (u) onRoute(u.id, u.fullName ?? u.email, sequence);
          }}
          className={BTN_PRIMARY}
        >
          <ArrowRight size={15} aria-hidden />
          Assign &amp; start SLA
        </button>
      </div>
    </ZoneCard>
  );
}

interface ActionZoneProps {
  lead: Lead;
  sla: SlaState | null;
  now?: Date;
  currentUserId: string | null;
  reassignOpen: boolean;
  onToggleReassign: () => void;
  onAccept: () => void;
  onSalesQualify: () => void;
  onAssignBdr: (id: string, name: string) => void;
  onRoute: (id: string, name: string, sequence: string) => void;
  onLogOutcome: () => void;
  onLinkOpportunity: () => void;
  onScheduleMeeting: () => void;
}

function ActionZone({
  lead,
  sla,
  now,
  currentUserId,
  reassignOpen,
  onToggleReassign,
  onAccept,
  onSalesQualify,
  onAssignBdr,
  onRoute,
  onLogOutcome,
  onLinkOpportunity,
  onScheduleMeeting,
}: ActionZoneProps) {
  // NEW + unassigned — Marketing routes to a BDR (starts the SLA).
  if (lead.status === "new" && !lead.assignedBdr) {
    return <RouteZone lead={lead} currentUserId={currentUserId} onRoute={onRoute} />;
  }

  // NEW — SLA banner + Accept (+ reassign control).
  if (lead.status === "new") {
    return (
      <ZoneCard tone={sla?.overdue ? "alert" : undefined}>
        <div className="mb-2 flex items-center gap-2">
          <Clock
            size={16}
            className="shrink-0"
            style={{ color: sla?.overdue ? "#C25A52" : "#9A7B3F" }}
            aria-hidden
          />
          <span className="whitespace-nowrap text-[13px] font-bold text-[#403770]">
            {sla?.overdue ? "Acceptance overdue" : "Awaiting acceptance"}
          </span>
          <span className="ml-auto">
            <SlaBadge assignedAt={lead.assignedAt} compact now={now} />
          </span>
        </div>
        <div className="mb-3 text-xs text-[#8A80A8]">
          SLA: accept within 2 business days, review engagement history, then begin
          the assigned sequence.
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onAccept} className={BTN_CORAL}>
            <Check size={15} aria-hidden />
            Accept &amp; start working
          </button>
          <button type="button" onClick={onToggleReassign} className={BTN_SECONDARY}>
            Reassign
          </button>
        </div>
        {reassignOpen && (
          <div className="mt-3">
            <BdrSelect
              value={lead.assignedBdr?.id ?? null}
              currentUserId={currentUserId}
              onAssign={onAssignBdr}
            />
          </div>
        )}
      </ZoneCard>
    );
  }

  // MEETING SCHEDULED without a linked opp (e.g. dragged in) — opp required.
  if (lead.status === "meeting_scheduled" && !lead.opportunity) {
    return (
      <ZoneCard tone="alert">
        <div className="mb-2 flex items-center gap-2">
          <Briefcase size={16} className="shrink-0 text-[#C25A52]" aria-hidden />
          <span className="whitespace-nowrap text-[13px] font-bold text-[#403770]">
            Opportunity required
          </span>
        </div>
        <div className="mb-3 text-xs text-[#8A80A8]">
          Meeting Scheduled needs a linked opportunity. Create a Stage 0 opp to
          complete the handoff.
        </div>
        <button type="button" onClick={onLinkOpportunity} className={BTN_CORAL}>
          <Link2 size={15} aria-hidden />
          Link opportunity
        </button>
      </ZoneCard>
    );
  }

  // MEETING SCHEDULED — meeting date + Sales-qualify + log outcome.
  if (lead.status === "meeting_scheduled") {
    return (
      <ZoneCard>
        <div className="mb-2 flex items-center gap-2">
          <Calendar size={16} className="shrink-0 text-[#7A6FD0]" aria-hidden />
          <span className="whitespace-nowrap text-[13px] font-bold text-[#403770]">
            Meeting scheduled
          </span>
          {lead.meetingAt && (
            <span className="ml-auto whitespace-nowrap text-xs font-semibold tabular-nums text-[#5A4F9E]">
              {fmtDate(new Date(lead.meetingAt), now)}
            </span>
          )}
        </div>
        <div className="mb-3 text-xs text-[#8A80A8]">
          Run the meeting, log the outcome — or qualify for sales to advance the
          Stage 0 opportunity to Stage 1 · Discovery and hand it to a rep.
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onLogOutcome} className={BTN_CORAL}>
            <MessageSquare size={15} aria-hidden />
            Log activity &amp; outcome
          </button>
          <button type="button" onClick={onSalesQualify} className={BTN_SECONDARY}>
            <CheckCircle2 size={15} className="text-[#56792F]" aria-hidden />
            Mark Sales Qualified
          </button>
        </div>
      </ZoneCard>
    );
  }

  // WORKING — log an outcome; schedule-meeting / link-opp affordances.
  if (lead.status === "working") {
    return (
      <ZoneCard>
        <div className="mb-2.5 flex items-center gap-2">
          <Target size={16} className="shrink-0 text-[#6EA3BE]" aria-hidden />
          <span className="whitespace-nowrap text-[13px] font-bold text-[#403770]">
            Log engagement outcome
          </span>
        </div>
        <div className="mb-3 text-xs text-[#8A80A8]">
          Logs a call, email, or meeting to the activity timeline with notes — then
          set the resulting lead status.
        </div>
        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={onLogOutcome} className={BTN_CORAL}>
            <MessageSquare size={15} aria-hidden />
            Log activity &amp; outcome
          </button>
          <button type="button" onClick={onScheduleMeeting} className={BTN_SECONDARY}>
            <Calendar size={15} aria-hidden />
            Schedule meeting
          </button>
          {!lead.opportunity && (
            <button type="button" onClick={onLinkOpportunity} className={BTN_SECONDARY}>
              <Link2 size={15} aria-hidden />
              Link opportunity
            </button>
          )}
        </div>
      </ZoneCard>
    );
  }

  // SALES QUALIFIED — terminal. updatedAt ≈ qualification time (terminal
  // status means the last write was the qualifying transition).
  if (lead.status === "sales_qualified") {
    return (
      <ZoneCard>
        <div className="flex items-center gap-2.5">
          <CheckCircle2 size={18} className="shrink-0 text-[#56792F]" aria-hidden />
          <div className="text-[13px] font-semibold text-[#403770]">
            Sales Qualified Lead
            {` · ${fmtDate(lead.updatedAt, now)}`}
            {lead.opportunity ? " · opportunity in the sales pipeline" : ""}
          </div>
        </div>
      </ZoneCard>
    );
  }

  // UNQUALIFIED — terminal (the server requires a reason at disqualify time).
  return (
    <ZoneCard>
      <div className="flex items-center gap-2.5">
        <X size={16} className="shrink-0 text-[#9A93B0]" aria-hidden />
        <div className="text-[13px] text-[#5C5277]">
          Unqualified
          {lead.unqualifiedReason && (
            <>
              {" · "}
              <strong className="font-bold text-[#403770]">
                {lead.unqualifiedReason}
              </strong>
            </>
          )}
        </div>
      </div>
    </ZoneCard>
  );
}
