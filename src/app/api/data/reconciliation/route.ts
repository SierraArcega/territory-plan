import { NextRequest, NextResponse } from "next/server";

const FASTAPI_URL = process.env.FASTAPI_URL || "http://localhost:8000";

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const type = searchParams.get("type");
  const state = searchParams.get("state");
  const salesExec = searchParams.get("salesExec");
  const limit = searchParams.get("limit") || "500";

  if (!type || !["unmatched", "fragmented"].includes(type)) {
    return NextResponse.json(
      { error: "Invalid type. Must be 'unmatched' or 'fragmented'" },
      { status: 400 }
    );
  }

  const endpoint = type === "unmatched"
    ? "/api/reconciliation/unmatched"
    : "/api/reconciliation/fragmented";

  const params = new URLSearchParams();
  params.set("limit", limit);
  if (state) params.set("state", state);
  if (salesExec && type === "unmatched") params.set("sales_exec", salesExec);

  try {
    const response = await fetch(`${FASTAPI_URL}${endpoint}?${params}`, {
      headers: {
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const error = await response.text();
      console.error(`FastAPI error: ${response.status} - ${error}`);
      return NextResponse.json(
        { error: "Failed to fetch reconciliation data" },
        { status: response.status }
      );
    }

    const data = await response.json();
    return NextResponse.json(data);
  } catch (error) {
    console.error("Error proxying to FastAPI:", error);
    return NextResponse.json(
      { error: "Failed to connect to reconciliation service" },
      { status: 503 }
    );
  }
}
