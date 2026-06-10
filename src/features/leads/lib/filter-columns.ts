// FilterBuilder / SortDropdown column config for leads — mirrors the
// prototype's buildLeadColumns (Docs/design_handoff_leads/design_files/
// LeadsFilters.jsx): the same filterable columns, groups, and operator types.
// Enum values for State / Owner are derived from the live leads so imports
// show up; Status / Type / Sequence / SLA come from static config.

import type { FilterColumn } from "@/features/shared/components/filters/filter-builder-utils";
import {
  LEAD_TYPES,
  LEAD_TYPE_ORDER,
  SEQUENCES,
  STATUS_CONFIG,
  STATUS_ORDER,
  leadTypeConfig,
} from "./status-config";
import { slaState } from "./sla";
import type { Lead } from "./types";

const UNASSIGNED = "Unassigned";

function slaLabel(lead: Lead, now: Date): string {
  if (lead.status !== "new" || !lead.assignedAt) return "Not applicable";
  const s = slaState(lead.assignedAt, now);
  if (!s) return "Not applicable";
  return s.urgency === "overdue"
    ? "Overdue"
    : s.urgency === "due-soon"
      ? "Due soon"
      : "On track";
}

const asOptions = (values: readonly string[]) =>
  values.map((v) => ({ value: v, label: v }));

/**
 * Build the lead filter/sort columns. `leads` feeds the derived enum value
 * lists (states, BDR names); `now` pins SLA evaluation (injectable for tests).
 */
export function buildLeadFilterColumns(
  leads: Lead[],
  now: Date = new Date(),
): FilterColumn<Lead>[] {
  const states = [
    ...new Set(leads.map((l) => l.district?.stateAbbrev).filter(Boolean) as string[]),
  ].sort();
  const bdrNames = [
    ...new Set(leads.map((l) => l.assignedBdr?.fullName).filter(Boolean) as string[]),
  ].sort();

  return [
    {
      key: "name",
      label: "Name",
      group: "Lead",
      type: "text",
      accessor: (l) => l.contact?.name ?? "",
    },
    {
      key: "status",
      label: "Status",
      group: "Lead",
      type: "enum",
      options: STATUS_ORDER.map((k) => ({
        value: STATUS_CONFIG[k].label,
        label: STATUS_CONFIG[k].label,
      })),
      accessor: (l) => STATUS_CONFIG[l.status].label,
      sortAccessor: (l) => STATUS_ORDER.indexOf(l.status),
    },
    {
      key: "type",
      label: "Lead type",
      group: "Lead",
      type: "enum",
      options: LEAD_TYPE_ORDER.map((k) => ({
        value: LEAD_TYPES[k].label,
        label: LEAD_TYPES[k].label,
      })),
      accessor: (l) => leadTypeConfig(l.leadType).label,
    },
    {
      key: "score",
      label: "Engagement score",
      group: "Lead",
      type: "number",
      accessor: (l) => l.score,
    },
    {
      key: "bdr",
      label: "Owner (BDR)",
      group: "Lead",
      type: "enum",
      options: asOptions([...bdrNames, UNASSIGNED]),
      accessor: (l) => l.assignedBdr?.fullName ?? UNASSIGNED,
    },
    {
      key: "sequence",
      label: "Sequence",
      group: "Lead",
      type: "enum",
      options: asOptions(SEQUENCES),
      accessor: (l) => l.sequence ?? "",
    },
    {
      key: "org",
      label: "District",
      group: "Account",
      type: "text",
      accessor: (l) => l.district?.name ?? "",
    },
    {
      key: "school",
      label: "School",
      group: "Account",
      type: "text",
      accessor: (l) => l.school?.name ?? "District office",
    },
    {
      key: "state",
      label: "State",
      group: "Account",
      type: "enum",
      options: asOptions(states),
      accessor: (l) => l.district?.stateAbbrev ?? "",
    },
    {
      key: "hasOpp",
      label: "Has opportunity",
      group: "Account",
      type: "boolean",
      accessor: (l) => l.opportunity != null,
    },
    {
      key: "amount",
      label: "Opportunity value",
      group: "Account",
      type: "number",
      accessor: (l) => l.opportunity?.amount ?? null,
    },
    {
      key: "sla",
      label: "SLA status",
      group: "Timeline",
      type: "enum",
      options: asOptions(["On track", "Due soon", "Overdue", "Not applicable"]),
      accessor: (l) => slaLabel(l, now),
    },
    {
      key: "created",
      label: "Created",
      group: "Timeline",
      type: "date",
      accessor: (l) => l.createdAt,
    },
  ];
}
