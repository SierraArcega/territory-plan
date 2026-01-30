import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { Decimal } from "@prisma/client/runtime/library";
import { Prisma } from "@prisma/client";

export const dynamic = "force-dynamic";

// Helper to convert Decimal to number
function toNumber(val: Decimal | null | undefined): number | null {
  return val != null ? Number(val) : null;
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ code: string }> }
) {
  try {
    const { code } = await params;
    const stateCode = code.toUpperCase();

    const searchParams = request.nextUrl.searchParams;
    const search = searchParams.get("search") || "";
    const status = searchParams.get("status") || "all"; // "all" | "customer" | "pipeline" | "customer_pipeline"
    const limit = parseInt(searchParams.get("limit") || "50", 10);
    const offset = parseInt(searchParams.get("offset") || "0", 10);

    // Build where clause
    const where: Prisma.DistrictWhereInput = {
      stateAbbrev: stateCode,
    };

    // Add search filter
    if (search) {
      where.name = {
        contains: search,
        mode: "insensitive",
      };
    }

    // Add status filter
    if (status === "customer") {
      where.isCustomer = true;
    } else if (status === "pipeline") {
      where.hasOpenPipeline = true;
      where.isCustomer = { not: true };
    } else if (status === "customer_pipeline") {
      where.OR = [
        { isCustomer: true },
        { hasOpenPipeline: true },
      ];
    }

    // Get total count
    const total = await prisma.district.count({ where });

    // Get districts with relevant fields
    const districts = await prisma.district.findMany({
      where,
      select: {
        leaid: true,
        name: true,
        enrollment: true,
        isCustomer: true,
        hasOpenPipeline: true,
        salesExecutive: true,
        fy26NetInvoicing: true,
        fy26OpenPipeline: true,
        fy27OpenPipeline: true,
        districtTags: {
          select: {
            tag: { select: { id: true, name: true, color: true } },
          },
          take: 3, // Limit tags for list view
        },
      },
      orderBy: [
        { isCustomer: "desc" },
        { hasOpenPipeline: "desc" },
        { enrollment: "desc" },
      ],
      skip: offset,
      take: limit,
    });

    const response = {
      districts: districts.map((d) => ({
        leaid: d.leaid,
        name: d.name,
        enrollment: d.enrollment,
        isCustomer: d.isCustomer ?? false,
        hasOpenPipeline: d.hasOpenPipeline ?? false,
        salesExecutive: d.salesExecutive,
        fy26NetInvoicing: toNumber(d.fy26NetInvoicing) ?? 0,
        fy26OpenPipeline: toNumber(d.fy26OpenPipeline) ?? 0,
        fy27OpenPipeline: toNumber(d.fy27OpenPipeline) ?? 0,
        tags: d.districtTags.map((dt) => ({
          id: dt.tag.id,
          name: dt.tag.name,
          color: dt.tag.color,
        })),
      })),
      total,
      limit,
      offset,
    };

    return NextResponse.json(response);
  } catch (error) {
    console.error("Error fetching state districts:", error);
    return NextResponse.json(
      { error: "Failed to fetch districts" },
      { status: 500 }
    );
  }
}
