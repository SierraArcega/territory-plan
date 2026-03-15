import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

const VALID_OPPORTUNITY_TYPES = ["renewal", "expansion", "winback", "new_business"] as const;
type OpportunityType = (typeof VALID_OPPORTUNITY_TYPES)[number];

export interface Suggestion {
  activityType: string;
  title: string;
  districtLeaid: string | null;
  districtName: string | null;
  planId: string | null;
  planName: string | null;
  contractValue: number | null;
  lastContactDays: number | null;
  renewalWeeks: number | null;
  opportunityType: OpportunityType;
  reasoning: string;
  goalTags: string[];
  riskTags: string[];
}

function formatCurrency(n: number): string {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 }).format(n);
}

// Runs the priority-ordered rules engine and returns up to maxCount suggestions.
// Exported so it can be unit-tested independently.
export function buildSuggestions({
  userGoal,
  recentActivities,
  activePlans,
  today,
  maxCount = 3,
}: {
  userGoal: Record<string, unknown> | null;
  recentActivities: Array<{
    districtLeaid: string;
    lastActivityDate: string | null;
    lastRenewalDate: string | null;
  }>;
  activePlans: Array<{
    id: string;
    name: string;
    districts: Array<{
      districtLeaid: string;
      districtName: string;
      contractValue: number | null;
    }>;
  }>;
  today: string;
  maxCount?: number;
}): Suggestion[] {
  const todayMs = new Date(today).getTime();
  const seen = new Set<string>();
  const results: Suggestion[] = [];

  // Build a lookup from leaid → last contact info
  const contactMap = new Map<string, { lastActivityDate: string | null; lastRenewalDate: string | null }>();
  for (const a of recentActivities) {
    if (!contactMap.has(a.districtLeaid)) {
      contactMap.set(a.districtLeaid, { lastActivityDate: a.lastActivityDate, lastRenewalDate: a.lastRenewalDate });
    }
  }

  // Flatten all districts across plans
  const allDistricts = activePlans.flatMap((p) =>
    p.districts.map((d) => ({ ...d, planId: p.id, planName: p.name }))
  );

  function daysSince(dateStr: string | null | undefined): number | null {
    if (!dateStr) return null;
    return Math.floor((todayMs - new Date(dateStr).getTime()) / (1000 * 60 * 60 * 24));
  }

  function renewalWeeks(lastRenewalDate: string | null | undefined): number | null {
    if (!lastRenewalDate) return null;
    const elapsed = Math.floor((todayMs - new Date(lastRenewalDate).getTime()) / (1000 * 60 * 60 * 24 * 7));
    return Math.max(0, 52 - elapsed);
  }

  function addSuggestion(
    district: { districtLeaid: string; districtName: string; contractValue: number | null; planId: string; planName: string },
    opportunityType: OpportunityType,
    goalTags: string[],
    riskTags: string[],
    makeReasoning: (lastDays: number | null, rnwWeeks: number | null) => string
  ) {
    if (seen.has(district.districtLeaid) || results.length >= maxCount) return;
    seen.add(district.districtLeaid);
    const contact = contactMap.get(district.districtLeaid);
    const lastDays = daysSince(contact?.lastActivityDate);
    const rnwWeeks = renewalWeeks(contact?.lastRenewalDate);
    results.push({
      activityType: "call",
      title: `${opportunityType === "renewal" ? "Renewal Check-in" : opportunityType === "expansion" ? "Expansion Opportunity" : "Check In"} — ${district.districtName}`,
      districtLeaid: district.districtLeaid,
      districtName: district.districtName,
      planId: district.planId,
      planName: district.planName,
      contractValue: district.contractValue,
      lastContactDays: lastDays,
      renewalWeeks: rnwWeeks,
      opportunityType,
      reasoning: makeReasoning(lastDays, rnwWeeks),
      goalTags,
      riskTags,
    });
  }

  // Sort helper: contractValue DESC, then lastContactDays DESC
  function byPriority(a: typeof allDistricts[number], b: typeof allDistricts[number]): number {
    const aVal = a.contractValue ?? 0;
    const bVal = b.contractValue ?? 0;
    if (bVal !== aVal) return bVal - aVal;
    const aDays = daysSince(contactMap.get(a.districtLeaid)?.lastActivityDate) ?? 0;
    const bDays = daysSince(contactMap.get(b.districtLeaid)?.lastActivityDate) ?? 0;
    return bDays - aDays;
  }

  const renewalTarget = (userGoal?.renewalTarget as number) ?? 0;
  const renewalActual = (userGoal?.renewalActual as number) ?? 0;
  const pipelineTarget =
    ((userGoal?.renewalTarget as number) ?? 0) +
    ((userGoal?.winbackTarget as number) ?? 0) +
    ((userGoal?.expansionTarget as number) ?? 0) +
    ((userGoal?.newBusinessTarget as number) ?? 0);
  const pipelineActual = (userGoal?.pipelineActual as number) ?? 0;

  const notContactedIn30 = allDistricts.filter((d) => {
    const days = daysSince(contactMap.get(d.districtLeaid)?.lastActivityDate);
    return days === null || days >= 30;
  });

  // Rule 1: RENEWAL_BEHIND — renewal goal is significantly behind target
  if (userGoal && renewalTarget > 0 && renewalActual < renewalTarget * 0.9) {
    const gap = renewalTarget - renewalActual;
    const sorted = [...notContactedIn30].sort(byPriority);
    for (const d of sorted) {
      addSuggestion(d, "renewal", ["Renewal goal"], ["At risk"], (days, _weeks) => {
        const parts = [`Your renewal goal is ${formatCurrency(gap)} behind.`];
        if (d.contractValue) parts.push(`${d.districtName} (${formatCurrency(d.contractValue)}) is a key renewal.`);
        if (days !== null) parts.push(`Last contact was ${days} day${days === 1 ? "" : "s"} ago.`);
        return parts.join(" ");
      });
    }
  }

  // Rule 2: PIPELINE_BEHIND — overall pipeline is behind target
  if (results.length < maxCount && userGoal && pipelineTarget > 0 && pipelineActual < pipelineTarget * 0.9) {
    const gap = pipelineTarget - pipelineActual;
    const sorted = [...notContactedIn30].sort(byPriority);
    for (const d of sorted) {
      addSuggestion(d, "expansion", ["Pipeline goal"], ["Opportunity"], (days, _weeks) => {
        const parts = [`Your pipeline is ${formatCurrency(gap)} behind target.`];
        if (d.contractValue) parts.push(`${d.districtName} (${formatCurrency(d.contractValue)}) is an expansion opportunity.`);
        if (days !== null) parts.push(`Last contact was ${days} day${days === 1 ? "" : "s"} ago.`);
        return parts.join(" ");
      });
    }
  }

  // Rule 3: LONG_DORMANT — any district not contacted in 45+ days regardless of goals
  if (results.length < maxCount) {
    const dormant = allDistricts
      .filter((d) => {
        const days = daysSince(contactMap.get(d.districtLeaid)?.lastActivityDate);
        return days === null || days >= 45;
      })
      .sort(byPriority);
    for (const d of dormant) {
      addSuggestion(d, "renewal", [], ["Dormant"], (days, _weeks) => {
        const parts = [`${d.districtName} hasn't been contacted in ${days ?? "a long time"} days.`];
        if (d.contractValue) parts.push(`They have ${formatCurrency(d.contractValue)} in active value.`);
        return parts.join(" ");
      });
    }
  }

  // Rule 4: DEFAULT — top high-value districts not contacted in 14+ days (fills remaining slots)
  if (results.length < maxCount) {
    const defaultCandidates = allDistricts
      .filter((d) => {
        const days = daysSince(contactMap.get(d.districtLeaid)?.lastActivityDate);
        return days === null || days >= 14;
      })
      .sort(byPriority);
    for (const d of defaultCandidates) {
      addSuggestion(d, "renewal", [], [], (days, _weeks) => {
        if (days !== null) return `${d.districtName} hasn't been contacted in ${days} day${days === 1 ? "" : "s"}.`;
        return `${d.districtName} is in your active plan and due for a check-in.`;
      });
    }
  }

  return results;
}

export async function GET(_request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const today = new Date().toISOString().split("T")[0];
    const currentFiscalYear = new Date().getFullYear();

    const [userGoal, rawActivities, rawPlans] = await Promise.all([
      prisma.userGoal.findFirst({
        where: { userId: user.id, fiscalYear: currentFiscalYear },
      }),
      prisma.activity.findMany({
        where: { assignedToUserId: user.id },
        select: {
          type: true,
          startDate: true,
          districts: { select: { districtLeaid: true } },
        },
        orderBy: { startDate: "desc" },
        take: 200,
      }),
      prisma.territoryPlan.findMany({
        where: { ownerId: user.id },
        select: {
          id: true,
          name: true,
          districts: {
            select: {
              districtLeaid: true,
              district: { select: { name: true, leaid: true } },
            },
          },
        },
        take: 20,
      }),
    ]);

    // Build per-district last-contact and last-renewal lookups from activity history.
    // Activities come back sorted by startDate desc, so the first hit per leaid is the most recent.
    const lastContactByLeaid = new Map<string, string>();
    const lastRenewalByLeaid = new Map<string, string>();

    for (const act of rawActivities) {
      for (const d of act.districts) {
        const leaid = d.districtLeaid;
        if (!lastContactByLeaid.has(leaid) && act.startDate) {
          lastContactByLeaid.set(leaid, act.startDate.toISOString());
        }
        if (
          !lastRenewalByLeaid.has(leaid) &&
          act.startDate &&
          ["renewal_call", "renewal_meeting", "renewal"].includes(act.type)
        ) {
          lastRenewalByLeaid.set(leaid, act.startDate.toISOString());
        }
      }
    }

    // Shape data for the rules engine
    const recentActivities = Array.from(lastContactByLeaid.entries()).map(([leaid, lastDate]) => ({
      districtLeaid: leaid,
      lastActivityDate: lastDate,
      lastRenewalDate: lastRenewalByLeaid.get(leaid) ?? null,
    }));

    const activePlans = rawPlans.map((p) => ({
      id: p.id,
      name: p.name,
      districts: p.districts.map((d) => ({
        districtLeaid: d.districtLeaid,
        districtName: d.district.name,
        contractValue: null, // not in current schema
      })),
    }));

    const suggestions = buildSuggestions({
      userGoal: userGoal as Record<string, unknown> | null,
      recentActivities,
      activePlans,
      today,
    });

    return NextResponse.json({ suggestions });
  } catch (error) {
    console.error("Error computing lineup suggestions:", error);
    return NextResponse.json({ error: "Failed to fetch suggestions" }, { status: 500 });
  }
}
