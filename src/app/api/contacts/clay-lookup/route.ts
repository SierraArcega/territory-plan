import { NextRequest, NextResponse } from "next/server";
import prisma from "@/lib/prisma";

export const dynamic = "force-dynamic";

/**
 * Trigger a Clay lookup for contacts at a specific district.
 *
 * This endpoint sends district data (name, state, leaid) to Clay's webhook URL.
 * Clay will process the data, find and enrich contacts, then send the results
 * back to our /api/webhooks/clay endpoint.
 *
 * Flow:
 * 1. User clicks "Find Contacts" button
 * 2. This endpoint receives the leaid
 * 3. We fetch district data and POST to Clay webhook
 * 4. Clay enriches data and POSTs back to /api/webhooks/clay
 * 5. Webhook endpoint saves contacts to database
 * 6. Frontend refetches and displays new contacts
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { leaid } = body;

    if (!leaid) {
      return NextResponse.json(
        { error: "leaid is required" },
        { status: 400 }
      );
    }

    // Fetch district data to send to Clay
    const district = await prisma.district.findUnique({
      where: { leaid },
      select: {
        leaid: true,
        name: true,
        stateAbbrev: true,
        cityLocation: true,
      },
    });

    if (!district) {
      return NextResponse.json(
        { error: "District not found" },
        { status: 404 }
      );
    }

    // Get Clay webhook URL from environment
    const clayWebhookUrl = process.env.CLAY_WEBHOOK_URL;

    if (!clayWebhookUrl) {
      return NextResponse.json(
        { error: "Clay webhook not configured. Please add CLAY_WEBHOOK_URL to environment variables." },
        { status: 500 }
      );
    }

    // Send district data to Clay webhook
    // Clay will process this and send enriched contacts back to /api/webhooks/clay
    const clayResponse = await fetch(clayWebhookUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        // Data Clay needs to find contacts at this district
        leaid: district.leaid,
        district_name: district.name,
        state: district.stateAbbrev,
        city: district.cityLocation,
        // Include our webhook URL for Clay to send results back
        callback_url: `${process.env.NEXT_PUBLIC_SITE_URL || "https://plan.fullmindlearning.com"}/api/webhooks/clay`,
      }),
    });

    if (!clayResponse.ok) {
      const errorText = await clayResponse.text();
      console.error("Clay webhook error:", errorText);
      return NextResponse.json(
        { error: "Failed to trigger Clay lookup" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      message: "Clay lookup triggered. Contacts will appear shortly after Clay processes the request.",
      district: {
        leaid: district.leaid,
        name: district.name,
        state: district.stateAbbrev,
      },
    });
  } catch (error) {
    console.error("Error triggering Clay lookup:", error);
    return NextResponse.json(
      { error: "Failed to trigger Clay lookup" },
      { status: 500 }
    );
  }
}
