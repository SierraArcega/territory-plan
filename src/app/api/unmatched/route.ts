import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const state = searchParams.get("state");
    const limit = parseInt(searchParams.get("limit") || "100");
    const offset = parseInt(searchParams.get("offset") || "0");

    const where = state ? { stateAbbrev: state } : {};

    const [accounts, total] = await Promise.all([
      prisma.unmatchedAccount.findMany({
        where,
        take: limit,
        skip: offset,
        orderBy: [
          { fy26NetInvoicing: "desc" },
          { accountName: "asc" },
        ],
      }),
      prisma.unmatchedAccount.count({ where }),
    ]);

    return NextResponse.json({
      accounts: accounts.map((a) => ({
        id: a.id,
        accountName: a.accountName,
        salesExecutive: a.salesExecutive,
        stateAbbrev: a.stateAbbrev,
        lmsid: a.lmsid,
        leaidRaw: a.leaidRaw,
        matchFailureReason: a.matchFailureReason,
        fy25NetInvoicing: Number(a.fy25NetInvoicing),
        fy26NetInvoicing: Number(a.fy26NetInvoicing),
        fy26OpenPipeline: Number(a.fy26OpenPipeline),
        fy27OpenPipeline: Number(a.fy27OpenPipeline),
        isCustomer: a.isCustomer,
        hasOpenPipeline: a.hasOpenPipeline,
      })),
      total,
    });
  } catch (error) {
    console.error("Error fetching unmatched accounts:", error);
    return NextResponse.json(
      { error: "Failed to fetch unmatched accounts" },
      { status: 500 }
    );
  }
}
