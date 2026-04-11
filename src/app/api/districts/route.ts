import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import { normalizeState } from "@/lib/states";
import {
  getFinancialValue,
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

function getFinancialLookup(metric: MetricType, year: FiscalYear): { fiscalYear: string; field: "totalRevenue" | "totalTake" | "sessionCount" | "closedWonBookings" | "invoicing" | "openPipeline" | "weightedPipeline" } {
  const fyMap: Record<FiscalYear, string> = { fy25: "FY25", fy26: "FY26", fy27: "FY27" };
  const fieldMap: Record<MetricType, "totalRevenue" | "totalTake" | "sessionCount" | "closedWonBookings" | "invoicing" | "openPipeline" | "weightedPipeline"> = {
    sessions_revenue: "totalRevenue",
    sessions_take: "totalTake",
    sessions_count: "sessionCount",
    closed_won_net_booking: "closedWonBookings",
    net_invoicing: "invoicing",
    open_pipeline: "openPipeline",
    open_pipeline_weighted: "weightedPipeline",
  };
  return { fiscalYear: fyMap[year], field: fieldMap[metric] };
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
    const lookup = getFinancialLookup(metric, year);
    const districtList = districts.map((d) => {
      const metricValue = getFinancialValue(d.districtFinancials, "fullmind", lookup.fiscalYear, lookup.field);

      return {
        leaid: d.leaid,
        name: d.name,
        stateAbbrev: d.stateAbbrev,
        isCustomer: d.isCustomer || false,
        hasOpenPipeline: d.hasOpenPipeline || false,
        accountType: d.accountType || "district",
        cityLocation: d.cityLocation,
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
