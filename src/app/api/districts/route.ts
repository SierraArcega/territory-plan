import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { normalizeState } from "@/lib/states";
import {
  extractFullmindFinancials,
  FULLMIND_FINANCIALS_SELECT,
} from "@/features/shared/lib/financial-helpers";

export const dynamic = "force-dynamic";

type StatusFilter = "all" | "customer" | "pipeline" | "customer_pipeline" | "no_data";
type MetricType =
  | "sessions_revenue"
  | "sessions_take"
  | "sessions_count"
  | "closed_won_net_booking"
  | "net_invoicing"
  | "open_pipeline"
  | "open_pipeline_weighted";
type FiscalYear = "fy25" | "fy26" | "fy27";

// Maps metric + year to the key in extractFullmindFinancials output
function getFinancialKey(metric: MetricType, year: FiscalYear): string {
  const metricMap: Record<MetricType, Record<FiscalYear, string>> = {
    sessions_revenue: {
      fy25: "fy25SessionsRevenue",
      fy26: "fy26SessionsRevenue",
      fy27: "fy26SessionsRevenue", // FY27 sessions not tracked
    },
    sessions_take: {
      fy25: "fy25SessionsTake",
      fy26: "fy26SessionsTake",
      fy27: "fy26SessionsTake",
    },
    sessions_count: {
      fy25: "fy25SessionsCount",
      fy26: "fy26SessionsCount",
      fy27: "fy26SessionsCount",
    },
    closed_won_net_booking: {
      fy25: "fy25ClosedWonNetBooking",
      fy26: "fy26ClosedWonNetBooking",
      fy27: "fy26ClosedWonNetBooking", // FY27 closed won not tracked
    },
    net_invoicing: {
      fy25: "fy25NetInvoicing",
      fy26: "fy26NetInvoicing",
      fy27: "fy26NetInvoicing",
    },
    open_pipeline: {
      fy25: "fy26OpenPipeline", // FY25 pipeline not tracked
      fy26: "fy26OpenPipeline",
      fy27: "fy27OpenPipeline",
    },
    open_pipeline_weighted: {
      fy25: "fy26OpenPipelineWeighted",
      fy26: "fy26OpenPipelineWeighted",
      fy27: "fy27OpenPipelineWeighted",
    },
  };
  return metricMap[metric]?.[year] || "fy26NetInvoicing";
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);

    const rawState = searchParams.get("state");
    const state = rawState ? normalizeState(rawState) : null;
    const status = (searchParams.get("status") || "all") as StatusFilter;
    const salesExec = searchParams.get("salesExec");
    const search = searchParams.get("search");
    const metric = (searchParams.get("metric") || "net_invoicing") as MetricType;
    const year = (searchParams.get("year") || "fy26") as FiscalYear;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause - all filters are now directly on the district
    const where: Prisma.DistrictWhereInput = {};

    if (state) {
      where.stateAbbrev = state;
    }

    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Status filter - now directly on district columns
    if (status !== "all") {
      switch (status) {
        case "customer":
          where.isCustomer = true;
          break;
        case "pipeline":
          where.hasOpenPipeline = true;
          break;
        case "customer_pipeline":
          where.isCustomer = true;
          where.hasOpenPipeline = true;
          break;
        case "no_data":
          where.isCustomer = null;
          break;
      }
    }

    // Sales executive filter - now uses FK column
    if (salesExec) {
      where.salesExecutiveId = salesExec;
    }

    // Get total count
    const total = await prisma.district.count({ where });

    // Get districts with financial data from districtFinancials relation
    const districts = await prisma.district.findMany({
      where,
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        isCustomer: true,
        hasOpenPipeline: true,
        accountType: true,
        cityLocation: true,
        stateLocation: true,
        districtFinancials: {
          where: { vendor: "fullmind" },
          select: FULLMIND_FINANCIALS_SELECT,
        },
      },
      take: limit,
      skip: offset,
      orderBy: { name: "asc" },
    });

    // Transform to list items
    const financialKey = getFinancialKey(metric, year);
    const districtList = districts.map((d) => {
      const fin = extractFullmindFinancials(d.districtFinancials);
      const metricValue = Number(fin[financialKey as keyof typeof fin] || 0);

      return {
        leaid: d.leaid,
        name: d.name,
        stateAbbrev: d.stateAbbrev,
        isCustomer: d.isCustomer || false,
        hasOpenPipeline: d.hasOpenPipeline || false,
        accountType: d.accountType || "district",
        cityLocation: d.cityLocation,
        stateLocation: d.stateLocation,
        metricValue,
      };
    });

    return NextResponse.json({
      districts: districtList,
      total,
    });
  } catch (error) {
    console.error("Error fetching districts:", error);
    return NextResponse.json(
      { error: "Failed to fetch districts" },
      { status: 500 }
    );
  }
}
