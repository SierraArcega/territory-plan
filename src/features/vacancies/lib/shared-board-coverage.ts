/**
 * When the cron scans a shared job board (one URL covering multiple districts),
 * it creates a single `VacancyScan` record for the "representative" district
 * that is actually fetched. Vacancies for sibling districts are redistributed
 * via `groupByDistrict` but no scan record is written for them — which makes
 * the coverage metric undercount shared-board scans.
 *
 * This builds the sibling `VacancyScan` rows so that each district whose board
 * was successfully checked this run gets counted as covered. Returns empty when
 * the representative scan did not succeed (we don't claim coverage on failure).
 */

export interface SiblingCoverageInput {
  districts: Array<{ leaid: string }>;
  representativeLeaid: string;
  representativeScan: {
    status: string;
    platform: string | null;
    startedAt: Date;
    completedAt: Date | null;
  };
  batchId: string;
}

export interface SiblingCoverageRecord {
  leaid: string;
  status: string;
  platform: string | null;
  startedAt: Date;
  completedAt: Date | null;
  triggeredBy: string;
  batchId: string;
}

export function buildSiblingCoverageRecords(
  input: SiblingCoverageInput
): SiblingCoverageRecord[] {
  const { status } = input.representativeScan;
  if (status !== "completed" && status !== "completed_partial") return [];

  return input.districts
    .filter((d) => d.leaid !== input.representativeLeaid)
    .map((d) => ({
      leaid: d.leaid,
      status,
      platform: input.representativeScan.platform,
      startedAt: input.representativeScan.startedAt,
      completedAt: input.representativeScan.completedAt,
      triggeredBy: "cron",
      batchId: input.batchId,
    }));
}
