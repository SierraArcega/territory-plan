import { describe, expect, it } from "vitest";
import {
  buildFilterPredicate,
  buildComparator,
} from "@/features/shared/components/filters/filter-builder-utils";
import { buildLeadFilterColumns } from "../filter-columns";
import { leadKeys } from "../queries";
import type { Lead } from "../types";

const NOW = new Date("2026-06-02T10:30:00");

function makeLead(overrides: Partial<Lead> = {}): Lead {
  return {
    id: "l1",
    status: "new",
    score: 120,
    leadType: "mql",
    sequence: "General BDR Sequence",
    marketingOwner: "Jules Okafor",
    unqualifiedReason: null,
    assignedAt: new Date("2026-06-02T03:30:00").toISOString(),
    acceptedAt: null,
    createdAt: new Date("2026-05-22T09:00:00").toISOString(),
    updatedAt: new Date("2026-06-01T09:00:00").toISOString(),
    contact: {
      id: 1,
      name: "Karen Whitfield",
      title: "Director of Special Education",
      email: "kw@example.org",
      phone: null,
    },
    school: null,
    district: {
      leaid: "0802940",
      name: "Mesa Valley USD 51",
      city: "Grand Junction",
      stateAbbrev: "CO",
    },
    assignedBdr: { id: "u1", fullName: "Alex Rivera", avatarUrl: null },
    opportunity: null,
    ...overrides,
  };
}

describe("leadKeys", () => {
  it("produces stable, primitive-only query keys", () => {
    expect(leadKeys.list("mine")).toEqual(leadKeys.list("mine"));
    expect(leadKeys.list("mine")).toEqual(["leads", "list", "mine"]);
    expect(leadKeys.list("team")).toEqual(["leads", "list", "team"]);
    for (const part of leadKeys.list("mine")) {
      expect(typeof part).toBe("string");
    }
  });
});

describe("buildLeadFilterColumns", () => {
  const leads = [
    makeLead(),
    makeLead({
      id: "l2",
      status: "working",
      score: 90,
      leadType: "inbound",
      district: { leaid: "4101920", name: "Beaverton SD 48J", city: "Beaverton", stateAbbrev: "OR" },
      assignedBdr: { id: "u2", fullName: "Priya Shah", avatarUrl: null },
      opportunity: { id: "o1", name: "Opp", stage: "0 - Meeting Booked", amount: 75000, closeDate: null },
    }),
    makeLead({ id: "l3", assignedBdr: null }),
  ];
  const columns = buildLeadFilterColumns(leads, NOW);

  it("derives State and Owner enum options from the live leads", () => {
    const state = columns.find((c) => c.key === "state")!;
    expect(state.options!.map((o) => o.value)).toEqual(["CO", "OR"]);
    const bdr = columns.find((c) => c.key === "bdr")!;
    expect(bdr.options!.map((o) => o.value)).toEqual([
      "Alex Rivera",
      "Priya Shah",
      "Unassigned",
    ]);
  });

  it("filters by status label via the predicate", () => {
    const predicate = buildFilterPredicate(
      [{ id: "f1", column: "status", op: "eq", value: "Working" }],
      columns,
    );
    expect(leads.filter(predicate).map((l) => l.id)).toEqual(["l2"]);
  });

  it("filters by SLA status with the injected now", () => {
    const overdueLead = makeLead({
      id: "l4",
      // Assigned Thu May 28 → due Mon Jun 1 → overdue at NOW (Jun 2).
      assignedAt: new Date("2026-05-28T11:00:00").toISOString(),
    });
    const predicate = buildFilterPredicate(
      [{ id: "f1", column: "sla", op: "eq", value: "Overdue" }],
      buildLeadFilterColumns([...leads, overdueLead], NOW),
    );
    expect([...leads, overdueLead].filter(predicate).map((l) => l.id)).toEqual(["l4"]);
  });

  it("treats non-new leads as Not applicable for SLA", () => {
    const sla = columns.find((c) => c.key === "sla")!;
    expect(sla.accessor!(leads[1])).toBe("Not applicable");
  });

  it("sorts status by pipeline order, not alphabetically", () => {
    const cmp = buildComparator([{ key: "status", dir: "asc" }], columns);
    const sorted = [...leads].sort(cmp);
    expect(sorted[0].status).toBe("new");
    expect(sorted[sorted.length - 1].status).toBe("working");
  });

  it("reads opportunity flags and amounts", () => {
    const hasOpp = columns.find((c) => c.key === "hasOpp")!;
    expect(hasOpp.accessor!(leads[0])).toBe(false);
    expect(hasOpp.accessor!(leads[1])).toBe(true);
    const amount = columns.find((c) => c.key === "amount")!;
    expect(amount.accessor!(leads[1])).toBe(75000);
  });
});
