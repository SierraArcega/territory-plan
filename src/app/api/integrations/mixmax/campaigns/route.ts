// GET  /api/integrations/mixmax/campaigns — List active Mixmax sequences
// POST /api/integrations/mixmax/campaigns — Add a contact to a Mixmax sequence
//
// GET returns: { sequences: Array<{ _id, name, numStages }> }
// POST body: { sequenceId: string, contactEmail: string }
// POST returns: { success: true }

import { NextResponse } from "next/server";
import { getUser } from "@/lib/supabase/server";
import prisma from "@/lib/prisma";
import { decrypt } from "@/features/integrations/lib/encryption";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    // Get the user's Mixmax integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "mixmax" } },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Mixmax is not connected" },
        { status: 400 }
      );
    }

    const apiKey = decrypt(integration.accessToken);

    // Fetch active (non-archived) sequences
    const res = await fetch(
      "https://api.mixmax.com/v1/sequences?archived=false",
      {
        headers: {
          "X-API-Token": apiKey,
        },
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Mixmax API error: ${text}` },
        { status: res.status }
      );
    }

    const data = await res.json();

    // Normalize the response — Mixmax returns { results: [...] }
    const sequences = (data.results || data || []).map(
      (seq: { _id: string; name: string; stages?: unknown[] }) => ({
        _id: seq._id,
        name: seq.name,
        numStages: Array.isArray(seq.stages) ? seq.stages.length : 0,
      })
    );

    return NextResponse.json({ sequences });
  } catch (error) {
    console.error("Mixmax campaigns GET error:", error);
    return NextResponse.json(
      { error: "Failed to fetch Mixmax sequences" },
      { status: 500 }
    );
  }
}

export async function POST(request: Request) {
  try {
    const user = await getUser();
    if (!user) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await request.json();
    const { sequenceId, contactEmail } = body as {
      sequenceId: string;
      contactEmail: string;
    };

    if (!sequenceId || !contactEmail) {
      return NextResponse.json(
        { error: "Missing required fields: sequenceId, contactEmail" },
        { status: 400 }
      );
    }

    // Get the user's Mixmax integration
    const integration = await prisma.userIntegration.findUnique({
      where: { userId_service: { userId: user.id, service: "mixmax" } },
    });

    if (!integration || integration.status !== "connected") {
      return NextResponse.json(
        { error: "Mixmax is not connected" },
        { status: 400 }
      );
    }

    const apiKey = decrypt(integration.accessToken);

    // Add the contact to the sequence
    const res = await fetch(
      `https://api.mixmax.com/v1/sequences/${sequenceId}/recipients`,
      {
        method: "POST",
        headers: {
          "X-API-Token": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          recipients: [{ email: contactEmail }],
        }),
      }
    );

    if (!res.ok) {
      const text = await res.text();
      return NextResponse.json(
        { error: `Mixmax API error: ${text}` },
        { status: res.status }
      );
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Mixmax campaigns POST error:", error);
    return NextResponse.json(
      { error: "Failed to add contact to sequence" },
      { status: 500 }
    );
  }
}
