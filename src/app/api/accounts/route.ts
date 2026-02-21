import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { ACCOUNT_TYPES } from "@/lib/account-types";
import { geocodeAddress } from "@/features/map/lib/geocode";

export const dynamic = "force-dynamic";

const VALID_ACCOUNT_TYPES = ACCOUNT_TYPES.map((t) => t.value);

// Look up state FIPS code from abbreviation
async function getStateFips(abbrev: string): Promise<string> {
  const state = await prisma.state.findUnique({
    where: { abbrev: abbrev.toUpperCase() },
    select: { fips: true },
  });
  return state?.fips || "00";
}

// POST — create a new non-district account
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const {
      name,
      accountType,
      stateAbbrev,
      street,
      city,
      state,
      zip,
      salesExecutive,
      phone,
      websiteUrl,
    } = body;

    // Validate required fields
    if (!name || typeof name !== "string" || !name.trim()) {
      return NextResponse.json(
        { error: "Name is required" },
        { status: 400 }
      );
    }

    if (!accountType || !VALID_ACCOUNT_TYPES.includes(accountType)) {
      return NextResponse.json(
        { error: `Invalid accountType. Must be one of: ${VALID_ACCOUNT_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Generate synthetic leaid: M000001, M000002, etc.
    const maxResult = await prisma.$queryRaw<{ max_id: string | null }[]>`
      SELECT MAX(leaid) as max_id FROM districts WHERE leaid LIKE 'M%'
    `;
    const maxId = maxResult[0]?.max_id;
    let nextNum = 1;
    if (maxId) {
      const parsed = parseInt(maxId.slice(1), 10);
      if (!isNaN(parsed)) {
        nextNum = parsed + 1;
      }
    }
    const leaid = `M${String(nextNum).padStart(6, "0")}`;

    // Resolve state FIPS from abbreviation
    const resolvedStateAbbrev = stateAbbrev || state || null;
    const stateFips = resolvedStateAbbrev
      ? await getStateFips(resolvedStateAbbrev)
      : "00";

    // Geocode address if any address fields provided
    const hasAddress = street || city || state || zip;
    const coords = hasAddress
      ? await geocodeAddress({ street, city, state, zip })
      : null;

    // Create the base record with Prisma
    const newAccount = await prisma.district.create({
      data: {
        leaid,
        name: name.trim(),
        accountType,
        stateAbbrev: resolvedStateAbbrev,
        stateFips,
        streetLocation: street || null,
        cityLocation: city || null,
        stateLocation: state || null,
        zipLocation: zip || null,
        salesExecutive: salesExecutive || null,
        phone: phone || null,
        websiteUrl: websiteUrl || null,
      },
    });

    // Set point_location geometry if geocoding succeeded
    if (coords) {
      await prisma.$executeRaw`
        UPDATE districts
        SET point_location = ST_SetSRID(ST_MakePoint(${coords.lng}::float, ${coords.lat}::float), 4326)
        WHERE leaid = ${leaid}
      `;
    }

    return NextResponse.json(
      {
        leaid: newAccount.leaid,
        name: newAccount.name,
        accountType: newAccount.accountType,
      },
      { status: 201 }
    );
  } catch (error) {
    console.error("Error creating account:", error);
    return NextResponse.json(
      { error: "Failed to create account" },
      { status: 500 }
    );
  }
}

// GET — duplicate check: search existing districts/accounts by name
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const name = searchParams.get("name");
    const state = searchParams.get("state");

    if (!name || name.trim().length < 2) {
      return NextResponse.json(
        { error: "Name query parameter is required (min 2 characters)" },
        { status: 400 }
      );
    }

    const where: Record<string, unknown> = {
      name: {
        contains: name.trim(),
        mode: "insensitive",
      },
    };

    if (state) {
      where.stateAbbrev = state.toUpperCase();
    }

    const matches = await prisma.district.findMany({
      where,
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        accountType: true,
        isCustomer: true,
      },
      take: 5,
      orderBy: { name: "asc" },
    });

    return NextResponse.json(matches);
  } catch (error) {
    console.error("Error checking duplicates:", error);
    return NextResponse.json(
      { error: "Failed to search accounts" },
      { status: 500 }
    );
  }
}
