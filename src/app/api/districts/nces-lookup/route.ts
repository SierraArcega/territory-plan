import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Suggests an NCES ID for a district by searching the districts database
 * by name and state. Tries exact match first, then contains, then
 * normalized name (stripped of common suffixes).
 *
 * GET /api/districts/nces-lookup?name=Richland+School+District+Two&state=SC
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const state = searchParams.get("state");

    if (!name) {
      return NextResponse.json(
        { error: "name parameter is required" },
        { status: 400 }
      );
    }

    const where = state ? { stateAbbrev: state } : {};

    // 1. Try exact match (case-insensitive)
    const exact = await prisma.district.findFirst({
      where: {
        ...where,
        name: { equals: name, mode: "insensitive" },
      },
      select: { leaid: true, name: true, stateAbbrev: true },
    });

    if (exact) {
      return NextResponse.json({
        match: { leaid: exact.leaid, name: exact.name, state: exact.stateAbbrev },
        confidence: "exact",
      });
    }

    // 2. Try contains match
    const contains = await prisma.district.findFirst({
      where: {
        ...where,
        name: { contains: name, mode: "insensitive" },
      },
      select: { leaid: true, name: true, stateAbbrev: true },
      orderBy: { name: "asc" },
    });

    if (contains) {
      return NextResponse.json({
        match: { leaid: contains.leaid, name: contains.name, state: contains.stateAbbrev },
        confidence: "partial",
      });
    }

    // 3. Try normalized name — strip common district suffixes and search
    const normalized = name
      .replace(
        /\s*(School District|Public Schools|Unified School District|City Schools|County Schools|Schools|District)\s*/gi,
        " "
      )
      .trim();

    if (normalized !== name) {
      const fuzzy = await prisma.district.findFirst({
        where: {
          ...where,
          name: { contains: normalized, mode: "insensitive" },
        },
        select: { leaid: true, name: true, stateAbbrev: true },
        orderBy: { name: "asc" },
      });

      if (fuzzy) {
        return NextResponse.json({
          match: { leaid: fuzzy.leaid, name: fuzzy.name, state: fuzzy.stateAbbrev },
          confidence: "partial",
        });
      }
    }

    // No match found
    return NextResponse.json({ match: null, confidence: "none" });
  } catch (error) {
    console.error("NCES lookup error:", error);
    return NextResponse.json(
      { error: "Failed to look up NCES ID" },
      { status: 500 }
    );
  }
}
