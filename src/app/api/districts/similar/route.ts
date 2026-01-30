import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";

export const dynamic = "force-dynamic";

// Metric key to database field mapping
type MetricKey =
  | "enrollment"
  | "locale"
  | "medianIncome"
  | "expenditurePerPupil"
  | "avgSalary"
  | "ellPercent"
  | "swdPercent"
  | "pocRate";

type ToleranceLevel = "tight" | "medium" | "loose";

// Tolerance percentages for each level
const TOLERANCE_MAP: Record<ToleranceLevel, number> = {
  tight: 0.15,   // ±15%
  medium: 0.30,  // ±30%
  loose: 0.50,   // ±50%
};

// Locale tolerance (categorical, ±N values)
const LOCALE_TOLERANCE: Record<ToleranceLevel, number> = {
  tight: 1,
  medium: 1,
  loose: 2,
};

interface SimilarDistrictResult {
  leaid: string;
  name: string;
  stateAbbrev: string;
  distanceScore: number;
  metrics: Record<string, { value: number | string | null; sourceValue: number | string | null }>;
  territoryPlanIds: string[];
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const leaid = searchParams.get("leaid");
    const metricsParam = searchParams.get("metrics");
    const tolerance = (searchParams.get("tolerance") || "medium") as ToleranceLevel;
    const limit = Math.min(parseInt(searchParams.get("limit") || "10"), 25);

    // Validate required params
    if (!leaid) {
      return NextResponse.json({ error: "leaid is required" }, { status: 400 });
    }
    if (!metricsParam) {
      return NextResponse.json({ error: "metrics is required" }, { status: 400 });
    }

    const metrics = metricsParam.split(",") as MetricKey[];
    if (metrics.length === 0 || metrics.length > 3) {
      return NextResponse.json(
        { error: "Must select 1-3 metrics" },
        { status: 400 }
      );
    }

    // Fetch source district - all data is now directly on the district
    const sourceDistrict = await prisma.district.findUnique({
      where: { leaid },
      include: {
        territoryPlans: { select: { planId: true } },
      },
    });

    if (!sourceDistrict) {
      return NextResponse.json({ error: "District not found" }, { status: 404 });
    }

    // Calculate source metric values
    const sourceMetrics = calculateMetrics(sourceDistrict);

    // Check if all requested metrics have values
    for (const metric of metrics) {
      if (sourceMetrics[metric] === null) {
        return NextResponse.json(
          { error: `Source district is missing data for metric: ${metric}` },
          { status: 400 }
        );
      }
    }

    // Get tolerance value
    const tolerancePercent = TOLERANCE_MAP[tolerance];
    const localeTolerance = LOCALE_TOLERANCE[tolerance];

    // Find similar districts in the same state
    // Limit candidates to avoid loading entire state into memory
    const candidates = await prisma.district.findMany({
      where: {
        stateAbbrev: sourceDistrict.stateAbbrev,
        leaid: { not: leaid }, // Exclude source district
      },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        enrollment: true,
        urbanCentricLocale: true,
        ellStudents: true,
        specEdStudents: true,
        medianHouseholdIncome: true,
        expenditurePerPupil: true,
        salariesTotal: true,
        staffTotalFte: true,
        totalEnrollment: true,
        enrollmentWhite: true,
        territoryPlans: { select: { planId: true } },
      },
      take: 500, // Limit to 500 candidates to avoid memory issues
    });

    // Filter and score candidates
    const results: SimilarDistrictResult[] = [];

    for (const candidate of candidates) {
      const candidateMetrics = calculateMetrics(candidate);
      let totalDistance = 0;
      let allMetricsMatch = true;
      const metricDetails: Record<string, { value: number | string | null; sourceValue: number | string | null }> = {};

      for (const metric of metrics) {
        const sourceValue = sourceMetrics[metric];
        const candidateValue = candidateMetrics[metric];

        // Skip if candidate is missing this metric
        if (candidateValue === null) {
          allMetricsMatch = false;
          break;
        }

        // Handle locale (categorical) differently
        if (metric === "locale") {
          const diff = Math.abs((sourceValue as number) - (candidateValue as number));
          if (diff > localeTolerance) {
            allMetricsMatch = false;
            break;
          }
          // Normalize locale distance to 0-1 range
          totalDistance += diff / 12; // 12 is max locale difference
          metricDetails[metric] = {
            value: candidateValue,
            sourceValue: sourceValue,
          };
        } else {
          // Numeric metric - check percentage difference
          const percentDiff = Math.abs((candidateValue as number) - (sourceValue as number)) / (sourceValue as number);
          if (percentDiff > tolerancePercent) {
            allMetricsMatch = false;
            break;
          }
          totalDistance += percentDiff;
          metricDetails[metric] = {
            value: candidateValue,
            sourceValue: sourceValue,
          };
        }
      }

      if (allMetricsMatch) {
        results.push({
          leaid: candidate.leaid,
          name: candidate.name,
          stateAbbrev: candidate.stateAbbrev || "",
          distanceScore: totalDistance / metrics.length, // Average distance
          metrics: metricDetails,
          territoryPlanIds: candidate.territoryPlans.map((tp) => tp.planId),
        });
      }
    }

    // Sort by distance (closest first) and limit
    results.sort((a, b) => a.distanceScore - b.distanceScore);
    const topResults = results.slice(0, limit);

    return NextResponse.json({
      results: topResults,
      sourceMetrics: Object.fromEntries(
        metrics.map((m) => [m, sourceMetrics[m]])
      ),
      total: results.length,
    });
  } catch (error) {
    console.error("Error finding similar districts:", error);
    return NextResponse.json(
      { error: "Failed to find similar districts" },
      { status: 500 }
    );
  }
}

// Helper to calculate all metrics for a district
// All data is now directly on the district model
function calculateMetrics(district: {
  enrollment: number | null;
  urbanCentricLocale: number | null;
  ellStudents: number | null;
  specEdStudents: number | null;
  medianHouseholdIncome: Decimal | null;
  expenditurePerPupil: Decimal | null;
  salariesTotal: Decimal | null;
  staffTotalFte: Decimal | null;
  totalEnrollment: number | null;
  enrollmentWhite: number | null;
}): Record<MetricKey, number | null> {
  // Calculate average salary (total salaries / total FTE)
  let avgSalary: number | null = null;
  if (district.salariesTotal && district.staffTotalFte) {
    const salaries = Number(district.salariesTotal);
    const fte = Number(district.staffTotalFte);
    if (fte > 0) {
      avgSalary = salaries / fte;
    }
  }

  // Calculate ELL percentage
  let ellPercent: number | null = null;
  if (district.ellStudents !== null && district.enrollment && district.enrollment > 0) {
    ellPercent = (district.ellStudents / district.enrollment) * 100;
  }

  // Calculate SWD percentage (Special Ed)
  let swdPercent: number | null = null;
  if (district.specEdStudents !== null && district.enrollment && district.enrollment > 0) {
    swdPercent = (district.specEdStudents / district.enrollment) * 100;
  }

  // Calculate POC rate (non-white / total)
  let pocRate: number | null = null;
  if (district.totalEnrollment && district.totalEnrollment > 0 && district.enrollmentWhite !== null) {
    const nonWhite = district.totalEnrollment - district.enrollmentWhite;
    pocRate = (nonWhite / district.totalEnrollment) * 100;
  }

  return {
    enrollment: district.enrollment,
    locale: district.urbanCentricLocale,
    medianIncome: district.medianHouseholdIncome ? Number(district.medianHouseholdIncome) : null,
    expenditurePerPupil: district.expenditurePerPupil ? Number(district.expenditurePerPupil) : null,
    avgSalary,
    ellPercent,
    swdPercent,
    pocRate,
  };
}
