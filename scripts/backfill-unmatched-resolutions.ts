/**
 * One-time backfill: auto-resolve unmatched_opportunities entries where the
 * LMS account → NCES district mapping is unambiguous (single result + name match).
 *
 * Run dry-run first (recommended):
 *   DRY_RUN=true npx tsx scripts/backfill-unmatched-resolutions.ts
 *
 * Run for real:
 *   npx tsx scripts/backfill-unmatched-resolutions.ts
 *
 * Conservative on purpose: anything ambiguous (multiple matches, name mismatch,
 * non-7-digit LEAID, missing account) stays in the queue for manual admin review.
 *
 * Spec: Docs/superpowers/specs/2026-04-30-leaderboard-fy-attribution-fix-design.md
 */
import prisma from "@/lib/prisma";
import {
  lookupNcesByLmsId,
  namesMatch,
} from "./backfill-unmatched-resolutions-helpers";

// ---------------------------------------------------------------------------
// Public types
// ---------------------------------------------------------------------------

export interface BackfillSummary {
  candidates: number;
  autoResolved: number;
  deferred: number;
  errors: number;
  dryRun: boolean;
}

export interface CandidateRow {
  id: string;
  account_lms_id: string;
  account_name: string;
}

export interface ResolutionDecision {
  oppId: string;
  accountName: string;
  decision: "resolve" | "defer";
  reason: string;
  ncesId?: string;
  matchedDistrictName?: string;
}

// ---------------------------------------------------------------------------
// Core logic
// ---------------------------------------------------------------------------

export async function backfillUnmatched(opts?: {
  dryRun?: boolean;
  logDecisions?: boolean;
}): Promise<BackfillSummary> {
  const dryRun = opts?.dryRun ?? process.env.DRY_RUN === "true";
  const logDecisions = opts?.logDecisions ?? true;

  const candidates = await prisma.$queryRaw<CandidateRow[]>`
    SELECT id, account_lms_id, account_name
    FROM unmatched_opportunities
    WHERE resolved = false
      AND account_lms_id IS NOT NULL
      AND account_name IS NOT NULL
  `;

  const summary: BackfillSummary = {
    candidates: candidates.length,
    autoResolved: 0,
    deferred: 0,
    errors: 0,
    dryRun,
  };

  const decisions: ResolutionDecision[] = [];

  for (const row of candidates) {
    try {
      const district = await lookupNcesByLmsId(row.account_lms_id);

      if (!district) {
        decisions.push({
          oppId: row.id,
          accountName: row.account_name,
          decision: "defer",
          reason: "no district matched in OpenSearch or non-7-digit LEAID",
        });
        summary.deferred++;
        continue;
      }

      if (!namesMatch(row.account_name, district.name)) {
        decisions.push({
          oppId: row.id,
          accountName: row.account_name,
          decision: "defer",
          reason: `name mismatch: opp="${row.account_name}" district="${district.name}"`,
          ncesId: district.ncesId,
          matchedDistrictName: district.name,
        });
        summary.deferred++;
        continue;
      }

      // Unambiguous match — auto-resolve.
      decisions.push({
        oppId: row.id,
        accountName: row.account_name,
        decision: "resolve",
        reason: "exact name match",
        ncesId: district.ncesId,
        matchedDistrictName: district.name,
      });

      if (!dryRun) {
        await prisma.$executeRaw`
          UPDATE unmatched_opportunities
          SET resolved = true,
              resolved_district_leaid = ${district.ncesId},
              resolved_at = now(),
              resolved_by = 'backfill-2026-04-30'
          WHERE id = ${row.id}
        `;
      }

      summary.autoResolved++;
    } catch (e) {
      decisions.push({
        oppId: row.id,
        accountName: row.account_name,
        decision: "defer",
        reason: `error: ${(e as Error).message}`,
      });
      summary.errors++;
    }
  }

  if (logDecisions) {
    console.log(`\nBackfill summary (dryRun=${dryRun}):`, summary);
    console.log(`Per-row decisions (first 50):`);
    for (const d of decisions.slice(0, 50)) {
      const districtSuffix = d.ncesId
        ? ` (→ ${d.ncesId} "${d.matchedDistrictName}")`
        : "";
      console.log(
        `  ${d.decision.toUpperCase()} ${d.oppId} "${d.accountName}" — ${d.reason}${districtSuffix}`
      );
    }
    if (decisions.length > 50) {
      console.log(`  ... and ${decisions.length - 50} more`);
    }
  }

  return summary;
}

// ---------------------------------------------------------------------------
// CLI entry point
// ---------------------------------------------------------------------------

if (require.main === module) {
  backfillUnmatched()
    .then((s) => process.exit(s.errors > 0 ? 1 : 0))
    .catch((e) => {
      console.error(e);
      process.exit(1);
    });
}
