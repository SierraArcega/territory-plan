/**
 * Backfill District.jobBoardPlatform from current jobBoardUrl using
 * detectPlatform(). Idempotent — only writes when the detected platform
 * differs from what's currently stored.
 *
 * Usage:
 *   npx tsx scripts/backfill-job-board-platform.ts            # dry run
 *   npx tsx scripts/backfill-job-board-platform.ts --commit   # actually write
 */
import { config } from "dotenv";
config();

import prisma from "@/lib/prisma";
import { detectPlatform } from "@/features/vacancies/lib/platform-detector";

async function main() {
  const commit = process.argv.includes("--commit");

  const districts = await prisma.district.findMany({
    where: { jobBoardUrl: { not: null } },
    select: { leaid: true, jobBoardUrl: true, jobBoardPlatform: true },
  });

  console.log(`[backfill] inspecting ${districts.length} districts`);

  const transitions = new Map<string, number>(); // "from→to" → count
  const updates: { leaid: string; from: string | null; to: string }[] = [];

  for (const d of districts) {
    if (!d.jobBoardUrl) continue;
    const detected = detectPlatform(d.jobBoardUrl);
    if (detected === d.jobBoardPlatform) continue;
    const key = `${d.jobBoardPlatform ?? "(unset)"} → ${detected}`;
    transitions.set(key, (transitions.get(key) ?? 0) + 1);
    updates.push({ leaid: d.leaid, from: d.jobBoardPlatform, to: detected });
  }

  console.log(`[backfill] ${updates.length} districts need an update`);
  for (const [key, n] of [...transitions.entries()].sort((a, b) => b[1] - a[1])) {
    console.log(`  ${key}: ${n}`);
  }

  if (!commit) {
    console.log("[backfill] dry run — pass --commit to apply");
    return;
  }

  let written = 0;
  for (const u of updates) {
    await prisma.district.update({
      where: { leaid: u.leaid },
      data: { jobBoardPlatform: u.to },
    });
    written++;
    if (written % 500 === 0) console.log(`[backfill] wrote ${written}/${updates.length}`);
  }
  console.log(`[backfill] done, wrote ${written}`);
}

main()
  .catch((err) => {
    console.error(err);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
