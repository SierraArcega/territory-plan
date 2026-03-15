import { NextRequest, NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import { encrypt } from "@/features/integrations/lib/encryption";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

export async function POST(request: NextRequest) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { apiKey } = await request.json();
    if (!apiKey || typeof apiKey !== "string") {
      return NextResponse.json({ error: "API key is required" }, { status: 400 });
    }

    // Validate the key against Mixmax API
    const validateRes = await fetch("https://api.mixmax.com/v1/users/me", {
      headers: { "X-API-Token": apiKey },
    });

    if (!validateRes.ok) {
      return NextResponse.json({ error: "Invalid Mixmax API key" }, { status: 400 });
    }

    const mixmaxUser = await validateRes.json();

    await prisma.userIntegration.upsert({
      where: { userId_service: { userId: user.id, service: "mixmax" } },
      update: {
        accountEmail: mixmaxUser.email || null,
        accountName: mixmaxUser.name || null,
        accessToken: encrypt(apiKey),
        status: "connected",
      },
      create: {
        userId: user.id,
        service: "mixmax",
        accountEmail: mixmaxUser.email || null,
        accountName: mixmaxUser.name || null,
        accessToken: encrypt(apiKey),
        status: "connected",
        syncEnabled: true,
      },
    });

    return NextResponse.json({
      success: true,
      accountEmail: mixmaxUser.email,
      accountName: mixmaxUser.name,
    });
  } catch (error) {
    console.error("Mixmax connect error:", error);
    return NextResponse.json({ error: "Failed to connect Mixmax" }, { status: 500 });
  }
}
