import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  const rows = await prisma.competitorSpend.findMany({
    select: { fiscalYear: true },
    distinct: ["fiscalYear"],
    orderBy: { fiscalYear: "asc" },
  });

  const fiscalYears = rows.map((r) => r.fiscalYear.toLowerCase());

  return NextResponse.json({ fiscalYears });
}
