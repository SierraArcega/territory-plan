import { NextResponse } from "next/server";
import fs from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

export async function GET() {
  if (process.env.USE_STATIC_DATA !== "true") {
    return NextResponse.json({ mode: "live" });
  }

  try {
    const filePath = path.join(process.cwd(), "data/snapshots/metadata.json");
    const raw = fs.readFileSync(filePath, "utf-8");
    const metadata = JSON.parse(raw);
    return NextResponse.json({ mode: "static", ...metadata });
  } catch {
    return NextResponse.json({ mode: "static", lastRefreshed: null });
  }
}
