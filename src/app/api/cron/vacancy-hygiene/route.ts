import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";
export const maxDuration = 60;

const CRON_SECRET = process.env.CRON_SECRET;

/** Close open vacancies when a district's vacancy/enrollment ratio exceeds this. */
const RATIO_THRESHOLD = 0.3;

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
 * vacancy-to-enrollment ratios (>0.3) and closes those vacancies.
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

  try {
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
      vacanciesClosed: number;
      ratio: number;
    }[] = [];

    for (const district of flagged) {
      // Close all open vacancies for this district
      const result = await prisma.vacancy.updateMany({
        where: { leaid: district.leaid, status: "open" },
        data: { status: "closed" },
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
              `Hygiene cleanup: ${result.count} vacancies closed ` +
              `(ratio ${district.ratio} exceeded ${RATIO_THRESHOLD} threshold, ` +
              `enrollment: ${district.enrollment})`,
          },
        });
      }

      cleaned.push({
        leaid: district.leaid,
        name: district.name,
        enrollment: district.enrollment,
        vacanciesClosed: result.count,
        ratio: district.ratio,
      });
    }

    const totalClosed = cleaned.reduce((s, d) => s + d.vacanciesClosed, 0);

    console.log(
      `[vacancy-hygiene] Cleaned ${totalClosed} vacancies from ${cleaned.length} districts`
    );

    return NextResponse.json({
      cleaned: totalClosed,
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
