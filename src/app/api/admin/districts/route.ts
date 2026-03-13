import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

// State abbreviation → FIPS code mapping
const STATE_FIPS: Record<string, string> = {
  AL: "01", AK: "02", AZ: "04", AR: "05", CA: "06", CO: "08", CT: "09",
  DE: "10", DC: "11", FL: "12", GA: "13", HI: "15", ID: "16", IL: "17",
  IN: "18", IA: "19", KS: "20", KY: "21", LA: "22", ME: "23", MD: "24",
  MA: "25", MI: "26", MN: "27", MS: "28", MO: "29", MT: "30", NE: "31",
  NV: "32", NH: "33", NJ: "34", NM: "35", NY: "36", NC: "37", ND: "38",
  OH: "39", OK: "40", OR: "41", PA: "42", PR: "72", RI: "44", SC: "45",
  SD: "46", TN: "47", TX: "48", UT: "49", VT: "50", VA: "51", WA: "53",
  WV: "54", WI: "55", WY: "56",
};

// POST /api/admin/districts — create a new district and return it
export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Authentication required" }, { status: 401 });
    }

    const body = await request.json();
    const { leaid, name, stateAbbrev, cityLocation } = body as {
      leaid?: string;
      name?: string;
      stateAbbrev?: string;
      cityLocation?: string;
    };

    // Validate required fields
    if (!leaid || typeof leaid !== "string" || !/^\d{7}$/.test(leaid)) {
      return NextResponse.json(
        { error: "leaid is required and must be a 7-digit NCES ID" },
        { status: 400 },
      );
    }

    if (!name || typeof name !== "string" || name.trim().length === 0) {
      return NextResponse.json({ error: "name is required" }, { status: 400 });
    }

    if (!stateAbbrev || typeof stateAbbrev !== "string" || stateAbbrev.length !== 2) {
      return NextResponse.json({ error: "stateAbbrev is required (2-letter code)" }, { status: 400 });
    }

    const upperState = stateAbbrev.toUpperCase();
    const stateFips = STATE_FIPS[upperState];

    if (!stateFips) {
      return NextResponse.json({ error: "Invalid state abbreviation" }, { status: 400 });
    }

    // Check for duplicate
    const existing = await prisma.district.findUnique({ where: { leaid } });
    if (existing) {
      return NextResponse.json(
        { error: "A district with this LEAID already exists", existing },
        { status: 409 },
      );
    }

    const district = await prisma.district.create({
      data: {
        leaid,
        name: name.trim(),
        stateFips,
        stateAbbrev: upperState,
        cityLocation: cityLocation?.trim() || null,
      },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        enrollment: true,
        cityLocation: true,
      },
    });

    return NextResponse.json(district, { status: 201 });
  } catch (error) {
    console.error("Error creating district:", error);
    return NextResponse.json({ error: "Failed to create district" }, { status: 500 });
  }
}
