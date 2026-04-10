import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const users = await prisma.userProfile.findMany({
      select: {
        id: true,
        fullName: true,
        email: true,
      },
      orderBy: { fullName: "asc" },
    });

    return NextResponse.json(users);
  } catch (error) {
    console.error("Error fetching sales executives:", error);
    return NextResponse.json(
      { error: "Failed to fetch sales executives" },
      { status: 500 }
    );
  }
}
