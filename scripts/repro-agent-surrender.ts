// Direct invocation of the agent loop with the verbatim questions from the
// 5 surrender rows. Bypasses the HTTP route + auth so we can see exactly what
// the model returns.
//
// Run with: npx tsx scripts/repro-agent-surrender.ts
//
// USER_ID below is Sierra's; it only matters because saved_reports lookups
// require a userId. The agent loop doesn't fabricate auth.
import { getAnthropic } from "@/features/reports/lib/claude-client";
import { runAgentLoop } from "@/features/reports/lib/agent/agent-loop";

const USER_ID = process.env.REPRO_USER_ID ?? "00000000-0000-0000-0000-000000000000";

interface QItem {
  tag: string;
  q: string;
  priorTurns?: Array<{ question: string; sql: string | null; summary: null }>;
}

const QUESTIONS: QItem[] = [
  { tag: "row131-ysiad-1", q: "how much pipeline does each rep have for FY27?" },
  {
    tag: "row132-ysiad-2-with-prior",
    q: "how many districts are covered in FY27 territory plans? How many per rep?",
    priorTurns: [
      { question: "how much pipeline does each rep have for FY27?", sql: null, summary: null },
    ],
  },
  { tag: "row99-stage-90d", q: "can you show me all opps that have been in their current stage for more than 90 days? only open pipeline, please" },
  { tag: "row82-tx-pipeline", q: "Show me Texas districts with pipeline over $50K, top 20 by pipeline." },
];

async function runOne(item: QItem, attempt: number) {
  const { tag, q } = item;
  const startedAt = Date.now();
  try {
    const result = await runAgentLoop({
      anthropic: getAnthropic(),
      userMessage: q,
      priorTurns: (item.priorTurns ?? []).map((t) => ({
        ...t,
        createdAt: new Date(),
      })),
      userId: USER_ID,
    });
    const elapsedMs = Date.now() - startedAt;
    const summary =
      result.kind === "result"
        ? `rowCount=${result.rowCount}`
        : `text=${result.text.replace(/\s+/g, " ").slice(0, 220)}`;
    console.log(`[${tag} #${attempt}] ${result.kind}  ${elapsedMs}ms  ${summary}`);
    return result.kind;
  } catch (err) {
    console.log(`[${tag} #${attempt}] THREW: ${err instanceof Error ? err.message : String(err)}`);
    return "threw";
  }
}

async function main() {
  // Custom question mode: scripts/repro-agent-surrender.ts ask "<question>" [repeats]
  if (process.argv[2] === "ask") {
    const q = process.argv[3];
    if (!q) {
      console.error('usage: ... ask "<question>" [repeats]');
      process.exit(1);
    }
    const repeats = Number(process.argv[4] ?? "1");
    const item: QItem = { tag: "ask", q };
    const runs: Promise<string>[] = [];
    for (let i = 1; i <= repeats; i++) runs.push(runOne(item, i));
    await Promise.all(runs);
    return;
  }

  const filter = process.argv[2];
  const repeats = Number(process.argv[3] ?? "1");
  const counts: Record<string, Record<string, number>> = {};
  for (const item of QUESTIONS) {
    if (filter && !item.tag.includes(filter)) continue;
    counts[item.tag] = {};
    const runs: Promise<string>[] = [];
    for (let i = 1; i <= repeats; i++) {
      runs.push(runOne(item, i));
    }
    const kinds = await Promise.all(runs);
    for (const k of kinds) counts[item.tag][k] = (counts[item.tag][k] ?? 0) + 1;
  }
  console.log("\n=== summary ===");
  for (const [tag, kinds] of Object.entries(counts)) {
    console.log(`  ${tag}: ${JSON.stringify(kinds)}`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
