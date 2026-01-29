import { NextRequest, NextResponse } from "next/server";
import { Pool } from "pg";
import { promises as fs } from "fs";
import path from "path";

// Use connection pool for tile requests
const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

export const dynamic = "force-dynamic";

// Cache for LEAIDs with revenue (loaded from CSV once)
let revenueLeaidsCache: Set<string> | null = null;

// Parse currency string like "$271,117.58" or "$0.00" to number
function parseCurrency(value: string): number {
  if (!value) return 0;
  const cleaned = value.replace(/[$,]/g, "");
  const num = parseFloat(cleaned);
  return isNaN(num) ? 0 : num;
}

// Load and parse the Fullmind CSV to get LEAIDs with revenue
async function getRevenueLeaids(): Promise<Set<string>> {
  if (revenueLeaidsCache) return revenueLeaidsCache;

  try {
    const csvPath = path.join(
      process.cwd(),
      "Data Files",
      "fullmind_district_data_by_year - Sheet3.csv"
    );
    const csvContent = await fs.readFile(csvPath, "utf-8");
    const lines = csvContent.split("\n");

    // Parse header to find column indices
    const header = lines[0].split(",");
    const leaidIdx = header.findIndex((h) => h.trim() === "LEAID");
    const fy25InvoicingIdx = header.findIndex((h) => h.trim() === "FY25 Net Invoicing");
    const fy26InvoicingIdx = header.findIndex((h) => h.trim() === "FY26 Net Invoicing");

    const leaidsWithRevenue = new Set<string>();

    // Parse data rows
    for (let i = 1; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line) continue;

      // Handle CSV with quoted fields containing commas
      const fields: string[] = [];
      let current = "";
      let inQuotes = false;
      for (const char of line) {
        if (char === '"') {
          inQuotes = !inQuotes;
        } else if (char === "," && !inQuotes) {
          fields.push(current.trim());
          current = "";
        } else {
          current += char;
        }
      }
      fields.push(current.trim());

      const leaid = fields[leaidIdx];
      if (!leaid) continue;

      const fy25Revenue = parseCurrency(fields[fy25InvoicingIdx]);
      const fy26Revenue = parseCurrency(fields[fy26InvoicingIdx]);

      // District has revenue if FY25 or FY26 invoicing > 0
      if (fy25Revenue > 0 || fy26Revenue > 0) {
        leaidsWithRevenue.add(leaid);
      }
    }

    console.log(`Loaded ${leaidsWithRevenue.size} LEAIDs with revenue from CSV`);
    revenueLeaidsCache = leaidsWithRevenue;
    return leaidsWithRevenue;
  } catch (error) {
    console.error("Error loading revenue CSV:", error);
    return new Set();
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ z: string; x: string; y: string }> }
) {
  try {
    const { z, x, y } = await params;
    const zoom = parseInt(z);
    const tileX = parseInt(x);
    // Remove .mvt extension if present
    const tileY = parseInt(y.replace(".mvt", ""));

    if (isNaN(zoom) || isNaN(tileX) || isNaN(tileY)) {
      return NextResponse.json(
        { error: "Invalid tile coordinates" },
        { status: 400 }
      );
    }

    // Get optional state filter from query params
    const { searchParams } = new URL(request.url);
    const stateFilter = searchParams.get("state");

    // Load LEAIDs with revenue from CSV
    const revenueLeaids = await getRevenueLeaids();
    const revenueLeaidArray = Array.from(revenueLeaids);

    // Determine parameter positions based on whether state filter is used
    const revenueParamIdx = stateFilter ? 5 : 4;

    // Build MVT query - filter by state if provided for better performance
    // Include has_revenue flag based on CSV data
    const query = `
      WITH tile_bounds AS (
        SELECT
          ST_TileEnvelope($1, $2, $3) AS envelope,
          ST_Transform(ST_TileEnvelope($1, $2, $3), 4326) AS envelope_4326
      ),
      tile_data AS (
        SELECT
          d.leaid,
          d.name,
          d.state_abbrev,
          d.leaid = ANY($${revenueParamIdx}::text[]) AS has_revenue,
          ST_AsMVTGeom(
            ST_Transform(d.geometry, 3857),
            (SELECT envelope FROM tile_bounds),
            4096,
            64,
            true
          ) AS geom
        FROM districts d
        WHERE d.geometry IS NOT NULL
          AND d.geometry && (SELECT envelope_4326 FROM tile_bounds)
          ${stateFilter ? "AND d.state_abbrev = $4" : ""}
      )
      SELECT ST_AsMVT(tile_data, 'districts', 4096, 'geom') AS mvt
      FROM tile_data
      WHERE geom IS NOT NULL
    `;

    // Build query parameters - include state filter and revenue LEAIDs
    const queryParams = stateFilter
      ? [zoom, tileX, tileY, stateFilter, revenueLeaidArray]
      : [zoom, tileX, tileY, revenueLeaidArray];

    const client = await pool.connect();
    try {
      const result = await client.query(query, queryParams);
      const mvt = result.rows[0]?.mvt;

      if (!mvt || mvt.length === 0) {
        // Return empty tile
        return new NextResponse(null, {
          status: 204,
          headers: {
            "Content-Type": "application/vnd.mapbox-vector-tile",
            "Cache-Control": "public, max-age=3600",
          },
        });
      }

      return new NextResponse(mvt, {
        status: 200,
        headers: {
          "Content-Type": "application/vnd.mapbox-vector-tile",
          "Cache-Control": "public, max-age=3600",
          "Content-Length": mvt.length.toString(),
        },
      });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error("Error generating tile:", error);
    return NextResponse.json(
      { error: "Failed to generate tile" },
      { status: 500 }
    );
  }
}
