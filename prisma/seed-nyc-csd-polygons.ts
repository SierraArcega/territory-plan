/**
 * One-shot import: populate `districts.geometry` (MultiPolygon) for the 32
 * NYC Community School Districts (CSDs) using polygon boundaries from NYC
 * Open Data ("School Districts" dataset, id 8ugf-3d8u).
 *
 * Why: before this import, the 32 Geographic Districts had only
 * `point_location` (geocoded centroids), so the `district_map_features` view
 * fell back to a 1-point geometry. That made them un-clickable on the map —
 * children's "polygons" were just invisible points, so clicking in NYC hit
 * only the NYC DOE rollup's polygon. With real polygons now, the map drill-
 * down designed in Tasks 5/6 works as intended: clicking in a borough
 * selects the specific CSD underneath, not the rollup.
 *
 * Scope: only the 32 Geographic Districts (1-32) get polygons from this
 * dataset. District 75 (NYC Special Schools, a citywide overlay) and the
 * 276 charter LEAIDs do not have admin-boundary polygons and stay as
 * point_location.
 *
 * District 10 appears twice in the source (two non-contiguous polygons);
 * this script merges them via ST_Collect + ST_Multi.
 *
 * Idempotent: re-running sets the same polygons. Safe to run multiple times.
 *
 * Run: `npx tsx prisma/seed-nyc-csd-polygons.ts`
 */
import { readFileSync } from "fs";
import { join } from "path";
import prisma from "@/lib/prisma";

interface GeoJSONFeature {
  type: "Feature";
  properties: { schooldist: string };
  geometry: { type: string; coordinates: unknown };
}

interface GeoJSONCollection {
  type: "FeatureCollection";
  features: GeoJSONFeature[];
}

async function main() {
  const fixturePath = join(__dirname, "fixtures", "nyc_csd_polygons.geojson");
  const raw = readFileSync(fixturePath, "utf-8");
  const collection = JSON.parse(raw) as GeoJSONCollection;
  console.log(`Loaded ${collection.features.length} features from ${fixturePath}`);

  // Group features by schooldist. District 10 has two non-contiguous parts.
  const byDist = new Map<number, GeoJSONFeature[]>();
  for (const f of collection.features) {
    const n = parseInt(f.properties.schooldist, 10);
    if (!byDist.has(n)) byDist.set(n, []);
    byDist.get(n)!.push(f);
  }
  console.log(`Unique district numbers: ${[...byDist.keys()].sort((a, b) => a - b).join(", ")}`);

  // Map leaid → district number from DB (match by name pattern)
  const rows = await prisma.$queryRaw<{ leaid: string; name: string }[]>`
    SELECT leaid, name
    FROM districts
    WHERE parent_leaid = '3620580' AND name ILIKE '%GEOGRAPHIC DISTRICT%'
    ORDER BY leaid;
  `;

  const leaidByDist = new Map<number, string>();
  for (const r of rows) {
    const m = r.name.match(/DISTRICT\s*#\s*(\d+)/i);
    if (!m) {
      console.warn(`No district number found in name: ${r.name} (${r.leaid})`);
      continue;
    }
    leaidByDist.set(parseInt(m[1], 10), r.leaid);
  }
  console.log(`Matched ${leaidByDist.size} leaids to district numbers`);

  let updated = 0;
  let missing: number[] = [];
  for (const [distNum, feats] of byDist) {
    const leaid = leaidByDist.get(distNum);
    if (!leaid) {
      missing.push(distNum);
      continue;
    }
    const geomJsonParts = feats.map((f) => JSON.stringify(f.geometry));
    // Build a scalar union expression (no aggregate). For single-part districts
    // that's just ST_Multi(ST_GeomFromGeoJSON(...)). For multi-part (e.g. NYC
    // District 10's two non-contiguous polygons) we chain ST_Union(a, b, ...)
    // using the two-argument scalar form.
    const leafs = geomJsonParts.map((_, i) => `ST_GeomFromGeoJSON($${i + 2}::text)`);
    let expr = leafs[0];
    for (let i = 1; i < leafs.length; i++) {
      expr = `ST_Union(${expr}, ${leafs[i]})`;
    }
    const sql = `
      UPDATE districts
      SET geometry = ST_Multi(${expr}),
          updated_at = NOW()
      WHERE leaid = $1::text;
    `;
    await prisma.$executeRawUnsafe(sql, leaid, ...geomJsonParts);
    updated++;
    console.log(`  District ${distNum.toString().padStart(2)} → ${leaid} (${feats.length} part${feats.length > 1 ? "s" : ""})`);
  }

  console.log(`\nUpdated ${updated} districts. Missing: ${missing.length ? missing.join(", ") : "none"}`);

  // Verify
  const check = await prisma.$queryRaw<any[]>`
    SELECT leaid, name, ST_GeometryType(geometry) AS geom_type, ST_NPoints(geometry) AS npts
    FROM districts
    WHERE parent_leaid = '3620580' AND name ILIKE '%GEOGRAPHIC DISTRICT%'
    ORDER BY leaid
    LIMIT 5;
  `;
  console.log("\nSample verification:");
  for (const r of check) {
    console.log(`  ${r.leaid} | ${r.name} | ${r.geom_type} | ${r.npts} pts`);
  }
}

main()
  .then(() => process.exit(0))
  .catch((e) => {
    console.error(e);
    process.exit(1);
  });
