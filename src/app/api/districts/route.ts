import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";

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

function getMetricColumn(metric: MetricType, year: FiscalYear): string {
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

    const state = searchParams.get("state");
    const status = (searchParams.get("status") || "all") as StatusFilter;
    const salesExec = searchParams.get("salesExec");
    const search = searchParams.get("search");
    const metric = (searchParams.get("metric") || "net_invoicing") as MetricType;
    const year = (searchParams.get("year") || "fy26") as FiscalYear;
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    // Build where clause
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

    // Status filter requires joining with fullmind_data
    if (status !== "all") {
      switch (status) {
        case "customer":
          where.fullmindData = { isCustomer: true };
          break;
        case "pipeline":
          where.fullmindData = { hasOpenPipeline: true };
          break;
        case "customer_pipeline":
          where.fullmindData = { isCustomer: true, hasOpenPipeline: true };
          break;
        case "no_data":
          where.fullmindData = null;
          break;
      }
    }

    if (salesExec) {
      const existingFullmindFilter = where.fullmindData as Prisma.FullmindDataWhereInput | null | undefined;
      if (existingFullmindFilter && typeof existingFullmindFilter === 'object') {
        where.fullmindData = {
          ...existingFullmindFilter,
          salesExecutive: salesExec,
        };
      } else {
        where.fullmindData = { salesExecutive: salesExec };
      }
    }

    // Get total count
    const total = await prisma.district.count({ where });

    // Get districts with fullmind data
    const districts = await prisma.district.findMany({
      where,
      include: {
        fullmindData: {
          select: {
            isCustomer: true,
            hasOpenPipeline: true,
            fy25SessionsRevenue: true,
            fy25SessionsTake: true,
            fy25SessionsCount: true,
            fy26SessionsRevenue: true,
            fy26SessionsTake: true,
            fy26SessionsCount: true,
            fy25ClosedWonNetBooking: true,
            fy25NetInvoicing: true,
            fy26ClosedWonNetBooking: true,
            fy26NetInvoicing: true,
            fy26OpenPipeline: true,
            fy26OpenPipelineWeighted: true,
            fy27OpenPipeline: true,
            fy27OpenPipelineWeighted: true,
          },
        },
      },
      take: limit,
      skip: offset,
      orderBy: { name: "asc" },
    });

    // Transform to list items
    const metricColumn = getMetricColumn(metric, year);
    const districtList = districts.map((d) => {
      const fm = d.fullmindData;
      const metricValue = fm
        ? Number(fm[metricColumn as keyof typeof fm] || 0)
        : 0;

      return {
        leaid: d.leaid,
        name: d.name,
        stateAbbrev: d.stateAbbrev,
        isCustomer: fm?.isCustomer || false,
        hasOpenPipeline: fm?.hasOpenPipeline || false,
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
