import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

/** Delete open vacancies when a district's vacancy/enrollment ratio exceeds this. */
const RATIO_THRESHOLD = 0.1;

/** Only check districts with at least this many open vacancies (skip noise). */
const MIN_VACANCIES = 10;

interface FlaggedDistrict {
  leaid: string;
  name: string;
  enrollment: number;
  open_vacancies: number;
  ratio: number;
}

/**
 * GET /api/cron/vacancy-hygiene
 *
 * Scheduled cleanup that finds districts with suspiciously high
 * vacancy-to-enrollment ratios (>10%) and deletes those vacancies.
 * Flags the latest scan as completed_partial so the admin dashboard
 * shows what happened.
 *
 * Runs daily. Auth: CRON_SECRET via Bearer token or query param.
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get("authorization");
  const { searchParams } = new URL(request.url);
  const secretParam = searchParams.get("secret");

  if (
    CRON_SECRET &&
    authHeader !== `Bearer ${CRON_SECRET}` &&
    secretParam !== CRON_SECRET
  ) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const mode = searchParams.get("mode");

  try {
    // --- Mode: purge redistributed vacancies (vacancy.leaid != scan.leaid) ---
    if (mode === "redistributed") {
      return purgeRedistributed();
    }

    // --- Mode: purge all closed vacancies (leftover from old close-based cleanup) ---
    if (mode === "purge-closed") {
      const result = await prisma.vacancy.deleteMany({ where: { status: "closed" } });
      console.log(`[vacancy-hygiene] Purge closed: deleted ${result.count} closed vacancies`);
      return NextResponse.json({ deleted: result.count, mode: "purge-closed" });
    }

    // --- Mode: purge vacancies from unscoped shared AppliTrack boards ---
    if (mode === "shared-applitrack") {
      return purgeUnscopedSharedAppliTrack();
    }

    // Find districts where open vacancy count / enrollment > threshold
    const flagged: FlaggedDistrict[] = await prisma.$queryRaw`
      SELECT
        d.leaid,
        d.name,
        d.enrollment,
        COUNT(v.id)::int AS open_vacancies,
        ROUND((COUNT(v.id)::numeric / d.enrollment), 3)::float AS ratio
      FROM districts d
      JOIN vacancies v ON v.leaid = d.leaid AND v.status = 'open'
      WHERE d.enrollment > 0
      GROUP BY d.leaid, d.name, d.enrollment
      HAVING COUNT(v.id) >= ${MIN_VACANCIES}
        AND (COUNT(v.id)::numeric / d.enrollment) > ${RATIO_THRESHOLD}
      ORDER BY (COUNT(v.id)::numeric / d.enrollment) DESC
    `;

    if (flagged.length === 0) {
      return NextResponse.json({
        cleaned: 0,
        districts: [],
        message: "No districts above threshold",
      });
    }

    const cleaned: {
      leaid: string;
      name: string;
      enrollment: number;
      vacanciesDeleted: number;
      ratio: number;
    }[] = [];

    for (const district of flagged) {
      // Delete all open vacancies for this district
      const result = await prisma.vacancy.deleteMany({
        where: { leaid: district.leaid, status: "open" },
      });

      // Flag the most recent scan as completed_partial
      const latestScan = await prisma.vacancyScan.findFirst({
        where: { leaid: district.leaid },
        orderBy: { startedAt: "desc" },
        select: { id: true },
      });

      if (latestScan) {
        await prisma.vacancyScan.update({
          where: { id: latestScan.id },
          data: {
            status: "completed_partial",
            errorMessage:
              `Hygiene cleanup: ${result.count} vacancies deleted ` +
              `(ratio ${district.ratio} exceeded ${RATIO_THRESHOLD} threshold, ` +
              `enrollment: ${district.enrollment})`,
          },
        });
      }

      cleaned.push({
        leaid: district.leaid,
        name: district.name,
        enrollment: district.enrollment,
        vacanciesDeleted: result.count,
        ratio: district.ratio,
      });
    }

    const totalDeleted = cleaned.reduce((s, d) => s + d.vacanciesDeleted, 0);

    console.log(
      `[vacancy-hygiene] Deleted ${totalDeleted} vacancies from ${cleaned.length} districts`
    );

    return NextResponse.json({
      deleted: totalDeleted,
      districts: cleaned,
    });
  } catch (error) {
    console.error("[vacancy-hygiene] Failed:", error);
    return NextResponse.json(
      { error: "Vacancy hygiene job failed" },
      { status: 500 }
    );
  }
}

/**
 * Purge all open vacancies that were redistributed from statewide board scans.
 * Redistributed vacancies are identified by vacancy.leaid != scan.leaid —
 * the vacancy belongs to a different district than the one that triggered the scan.
 */
async function purgeRedistributed() {
  const result: { deleted: number }[] = await prisma.$queryRaw`
    WITH redistributed AS (
      SELECT v.id, v.leaid AS vacancy_district, vs.leaid AS scan_district
      FROM vacancies v
      JOIN vacancy_scans vs ON v.scan_id = vs.id
      WHERE v.status = 'open'
        AND v.leaid != vs.leaid
    ),
    deleted AS (
      DELETE FROM vacancies
      WHERE id IN (SELECT id FROM redistributed)
      RETURNING id
    )
    SELECT COUNT(*)::int AS deleted FROM deleted
  `;

  const count = result[0]?.deleted ?? 0;

  console.log(`[vacancy-hygiene] Redistributed purge: deleted ${count} vacancies`);

  return NextResponse.json({
    deleted: count,
    mode: "redistributed",
    description: "Deleted open vacancies where vacancy.leaid != scan.leaid (redistributed from statewide boards)",
  });
}

/**
 * Purge all open vacancies from districts on shared AppliTrack instances
 * whose URLs lack applitrackclient scoping params. These districts pull
 * the entire statewide board and redistribute via fuzzy matching, inflating
 * vacancy counts across the state.
 */
async function purgeUnscopedSharedAppliTrack() {
  // Step 1: Find shared AppliTrack instances (2+ districts share the same base path)
  const sharedInstances: { instance: string }[] = await prisma.$queryRaw`
    SELECT LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)')) as instance
    FROM districts
    WHERE job_board_url LIKE '%applitrack.com%'
    GROUP BY LOWER(SUBSTRING(job_board_url FROM 'applitrack.com/([^/]+)'))
    HAVING COUNT(*) > 1
  `;

  const sharedNames = new Set(sharedInstances.map((r) => r.instance).filter(Boolean));

  // Step 2: Find districts on those shared instances WITHOUT applitrackclient param
  const allAppliTrack = await prisma.district.findMany({
    where: { jobBoardUrl: { contains: "applitrack.com" } },
    select: { leaid: true, name: true, jobBoardUrl: true },
  });

  const unscopedLeaids: string[] = [];
  for (const d of allAppliTrack) {
    if (!d.jobBoardUrl) continue;
    try {
      const url = new URL(d.jobBoardUrl);
      const pathMatch = url.pathname.toLowerCase().match(/^\/([^/]+)\//);
      const instance = pathMatch?.[1];
      if (instance && sharedNames.has(instance) && !url.searchParams.has("applitrackclient")) {
        unscopedLeaids.push(d.leaid);
      }
    } catch {
      continue;
    }
  }

  if (unscopedLeaids.length === 0) {
    return NextResponse.json({
      deleted: 0,
      districtsAffected: 0,
      message: "No unscoped shared AppliTrack districts found",
    });
  }

  // Step 3: Delete all open vacancies for these districts
  const result = await prisma.vacancy.deleteMany({
    where: {
      leaid: { in: unscopedLeaids },
      status: "open",
    },
  });

  console.log(
    `[vacancy-hygiene] Shared AppliTrack purge: deleted ${result.count} vacancies from ${unscopedLeaids.length} districts`
  );

  return NextResponse.json({
    deleted: result.count,
    districtsAffected: unscopedLeaids.length,
    sharedInstances: [...sharedNames],
  });
}
