// Proxies requests to the FastAPI district-profiles endpoint.
// The FastAPI server URL comes from FASTAPI_URL env var.
// Query params are forwarded as-is to the upstream endpoint.

import { NextRequest, NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export async function GET(request: NextRequest) {
  // Static data mode — serve snapshot file instead of proxying to FastAPI
  if (process.env.USE_STATIC_DATA === "true") {
    try {
      const filePath = path.join(process.cwd(), "data/snapshots/district-profiles.json");
      const raw = fs.readFileSync(filePath, "utf-8");
      return NextResponse.json(JSON.parse(raw));
    } catch {
      return NextResponse.json(
        { error: "Static data file not found. Run: npm run snapshot" },
        { status: 503 }
      );
    }
  }

  // Live mode — proxy to FastAPI
  const fastApiUrl = process.env.FASTAPI_URL;
  if (!fastApiUrl) {
    return NextResponse.json(
      { error: "FASTAPI_URL environment variable not configured" },
      { status: 503 }
    );
  }

  // Forward all query params to FastAPI
  const { searchParams } = new URL(request.url);
  const upstreamUrl = `${fastApiUrl}/api/reconciliation/district-profiles?${searchParams}`;

  try {
    const response = await fetch(upstreamUrl, {
      headers: { "Content-Type": "application/json" },
    });

    if (!response.ok) {
      const text = await response.text();
      console.error("FastAPI error:", response.status, text);
      return NextResponse.json(
        { error: `Upstream error: ${response.status}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Failed to fetch district profiles:", error);
    return NextResponse.json(
      { error: "Failed to connect to data service" },
      { status: 503 }
    );
  }
}
