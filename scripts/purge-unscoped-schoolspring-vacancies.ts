/**
 * Purge vacancies that were mis-attributed to districts whose
 * job_board_url is on the unscoped main domain www.schoolspring.com.
 *
 * Modes:
 *   npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts            # dry-run
 *   npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --apply    # delete
 *   npx tsx scripts/purge-unscoped-schoolspring-vacancies.ts --rescan   # delete + re-scan
 *
 * Preserves rows where vacancies.district_verified = true.
 */
import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import { runScan } from "../src/features/vacancies/lib/scan-runner";

const prisma = new PrismaClient();

const URL_PATTERN = "^https?://www\\.schoolspring\\.com";

type AffectedDistrict = {
  leaid: string;
  name: string;
  state_abbrev: string;
  job_board_url: string;
  to_delete: number;
  preserved_verified: number;
};

type SampleRow = {
  district: string;
  state: string;
  title: string;
  school_name: string | null;
  source_url: string | null;
};

async function selectAffected(): Promise<AffectedDistrict[]> {
  return prisma.$queryRawUnsafe<AffectedDistrict[]>(`
    SELECT
      d.leaid,
      d.name,
      d.state_abbrev,
      d.job_board_url,
      COUNT(*) FILTER (WHERE v.district_verified = false)::int AS to_delete,
      COUNT(*) FILTER (WHERE v.district_verified = true)::int  AS preserved_verified
    FROM districts d
    JOIN vacancies v ON v.leaid = d.leaid
    WHERE d.job_board_platform = 'schoolspring'
      AND d.job_board_url ~* '${URL_PATTERN}'
    GROUP BY d.leaid, d.name, d.state_abbrev, d.job_board_url
    ORDER BY to_delete DESC
  `);
}

async function sampleRows(): Promise<SampleRow[]> {
  return prisma.$queryRawUnsafe<SampleRow[]>(`
    SELECT d.name AS district, d.state_abbrev AS state,
           v.title, v.school_name, v.source_url
    FROM vacancies v
    JOIN districts d ON d.leaid = v.leaid
    WHERE d.job_board_platform = 'schoolspring'
      AND d.job_board_url ~* '${URL_PATTERN}'
      AND v.district_verified = false
    ORDER BY random()
    LIMIT 5
  `);
}

function reportPlan(districts: AffectedDistrict[], sample: SampleRow[]) {
  const totalDelete = districts.reduce((s, d) => s + d.to_delete, 0);
  const totalPreserved = districts.reduce((s, d) => s + d.preserved_verified, 0);

  console.log(`\n=== AFFECTED DISTRICTS: ${districts.length} ===`);
  console.log(`Vacancies to delete:   ${totalDelete}`);
  console.log(`Vacancies preserved (verified): ${totalPreserved}\n`);

  console.log("Per-district breakdown:");
  for (const d of districts) {
    console.log(
      `  [${d.state_abbrev}] ${d.name} (${d.leaid}): -${d.to_delete} delete, ${d.preserved_verified} preserved`
    );
  }

  console.log("\nSample rows that would be deleted:");
  for (const r of sample) {
    console.log(
      `  • ${r.district} (${r.state}) | ${r.title} | school_name=${r.school_name ?? "null"}`
    );
    console.log(`    ${r.source_url ?? "(no url)"}`);
  }
}

async function main() {
  const args = new Set(process.argv.slice(2));
  const apply = args.has("--apply") || args.has("--rescan");
  const rescan = args.has("--rescan");

  console.log(
    `[purge-unscoped-schoolspring] mode=${rescan ? "RESCAN" : apply ? "APPLY" : "DRY-RUN"}`
  );

  const districts = await selectAffected();
  const sample = await sampleRows();
  reportPlan(districts, sample);

  if (!apply) {
    console.log("\nDry-run only. Re-run with --apply to delete.");
    return;
  }

  const deleted = await prisma.$executeRawUnsafe(`
    DELETE FROM vacancies v
    USING districts d
    WHERE v.leaid = d.leaid
      AND d.job_board_platform = 'schoolspring'
      AND d.job_board_url ~* '${URL_PATTERN}'
      AND v.district_verified = false
  `);
  console.log(`\n[apply] Deleted ${deleted} vacancy rows.`);

  if (!rescan) return;

  console.log(`\n[rescan] Re-scanning ${districts.length} districts via runScan()...`);

  let recovered = 0;
  let skipped = 0;
  let errored = 0;

  for (const d of districts) {
    try {
      const scan = await prisma.vacancyScan.create({
        data: {
          leaid: d.leaid,
          status: "pending",
          triggeredBy: "purge-unscoped-schoolspring-vacancies",
        },
      });
      await runScan(scan.id);

      const updated = await prisma.vacancyScan.findUnique({
        where: { id: scan.id },
        select: { status: true, vacancyCount: true },
      });

      const found = updated?.vacancyCount ?? 0;
      if (found > 0) {
        recovered++;
        console.log(`  ✓ ${d.name} (${d.state_abbrev}, ${d.leaid}): ${found} vacancies`);
      } else {
        skipped++;
        console.log(`  · ${d.name} (${d.state_abbrev}, ${d.leaid}): 0 (recovery failed or no jobs)`);
      }
    } catch (err) {
      errored++;
      console.error(`  ✗ ${d.name} (${d.state_abbrev}, ${d.leaid}):`, err);
    }
  }

  console.log(
    `\n[rescan] Done: ${recovered} recovered, ${skipped} skipped, ${errored} errored.`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
