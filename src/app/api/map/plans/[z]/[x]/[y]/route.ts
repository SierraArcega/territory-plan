import { NextRequest, NextResponse } from "next/server";
import pool from "@/lib/db";

export const dynamic = "force-dynamic";

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const { z, x, y } = await params;
    const zoom = parseInt(z);
    const tileX = parseInt(x);
    const tileY = parseInt(y.replace(".mvt", ""));

    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return NextResponse.json(
        { error: "Invalid tile coordinates" },
        { status: 400 }
      );
    }

    // TODO: filter parsing + SQL — added in subsequent tasks.
    const client = await pool.connect();
    try {
      const result = await client.query("SELECT NULL::bytea AS mvt", [zoom, tileX, tileY]);
      const mvt = result.rows[0]?.mvt;
      if (!mvt || mvt.length === 0) {
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=300",
          },
        });
      }
      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": "public, max-age=300",
          "Content-Length": mvt.length.toString(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating plans tile:", error);
    return NextResponse.json(
      { error: "Failed to generate tile" },
      { status: 500 }
    );
  }
}
