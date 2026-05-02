import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

// Anthropic pricing for Claude Opus 4.x ($/MTok)
const PRICE = {
  input: 15.0,
  output: 75.0,
  cacheWrite: 18.75, // 1.25x input
  cacheRead: 1.5, // 0.10x input
};

function cost(t: {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
}): number {
  const i = t.inputTokens ?? 0;
  const o = t.outputTokens ?? 0;
  const cw = t.cacheCreationInputTokens ?? 0;
  const cr = t.cacheReadInputTokens ?? 0;
  return (
    (i * PRICE.input) / 1_000_000 +
    (o * PRICE.output) / 1_000_000 +
    (cw * PRICE.cacheWrite) / 1_000_000 +
    (cr * PRICE.cacheRead) / 1_000_000
  );
}

async function main() {
  const turns = await prisma.queryLog.findMany({
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      conversationId: true,
      userId: true,
      question: true,
      sql: true,
      params: true,
      rowCount: true,
      executionTimeMs: true,
      inputTokens: true,
      outputTokens: true,
      cacheCreationInputTokens: true,
      cacheReadInputTokens: true,
      error: true,
      createdAt: true,
    },
  });

  const billed = turns.filter(
    (t) => t.inputTokens != null || t.outputTokens != null,
  );

  console.log(`=== ALL-TIME (${turns.length} turns total, ${billed.length} with token data) ===\n`);

  // Aggregate
  const sum = billed.reduce(
    (acc, t) => {
      acc.input += t.inputTokens ?? 0;
      acc.output += t.outputTokens ?? 0;
      acc.cw += t.cacheCreationInputTokens ?? 0;
      acc.cr += t.cacheReadInputTokens ?? 0;
      acc.cost += cost(t);
      return acc;
    },
    { input: 0, output: 0, cw: 0, cr: 0, cost: 0 },
  );

  console.log(`Total input  : ${(sum.input / 1000).toFixed(1)}k tokens`);
  console.log(`Total output : ${(sum.output / 1000).toFixed(1)}k tokens`);
  console.log(`Cache write  : ${(sum.cw / 1000).toFixed(1)}k tokens`);
  console.log(`Cache read   : ${(sum.cr / 1000).toFixed(1)}k tokens`);
  console.log(`TOTAL COST   : $${sum.cost.toFixed(2)}`);
  console.log(`Avg / turn   : $${(sum.cost / billed.length).toFixed(4)}`);
  console.log(
    `Cache hit %  : ${((sum.cr / (sum.input + sum.cr)) * 100).toFixed(1)}% of input tokens served from cache\n`,
  );

  // By turn position in conversation
  const byConvo = new Map<string, typeof billed>();
  for (const t of billed) {
    const k = t.conversationId ?? `solo-${t.id}`;
    if (!byConvo.has(k)) byConvo.set(k, []);
    byConvo.get(k)!.push(t);
  }

  console.log(`=== COST BY TURN POSITION (cold start vs follow-up) ===`);
  const byPos = new Map<number, { count: number; cost: number; inp: number; out: number; cw: number; cr: number }>();
  for (const ts of byConvo.values()) {
    ts.sort((a, b) => a.createdAt.getTime() - b.createdAt.getTime());
    ts.forEach((t, i) => {
      const pos = i + 1;
      if (!byPos.has(pos)) byPos.set(pos, { count: 0, cost: 0, inp: 0, out: 0, cw: 0, cr: 0 });
      const b = byPos.get(pos)!;
      b.count++;
      b.cost += cost(t);
      b.inp += t.inputTokens ?? 0;
      b.out += t.outputTokens ?? 0;
      b.cw += t.cacheCreationInputTokens ?? 0;
      b.cr += t.cacheReadInputTokens ?? 0;
    });
  }
  console.log(
    `pos | n   | avg cost | avg input | avg output | avg cache-write | avg cache-read`,
  );
  for (const [pos, b] of [...byPos.entries()].sort((a, b) => a[0] - b[0]).slice(0, 10)) {
    console.log(
      `${String(pos).padStart(3)} | ${String(b.count).padStart(3)} | $${(b.cost / b.count).toFixed(4).padStart(7)} | ${Math.round(b.inp / b.count).toString().padStart(9)} | ${Math.round(b.out / b.count).toString().padStart(10)} | ${Math.round(b.cw / b.count).toString().padStart(15)} | ${Math.round(b.cr / b.count).toString().padStart(14)}`,
    );
  }

  // Most expensive single turns
  console.log(`\n=== TOP 10 MOST EXPENSIVE TURNS ===`);
  const ranked = [...billed]
    .map((t) => ({ t, c: cost(t) }))
    .sort((a, b) => b.c - a.c)
    .slice(0, 10);
  for (const { t, c } of ranked) {
    const params = (t.params as { events?: unknown[] } | null) ?? null;
    const evtCount = Array.isArray(params?.events) ? params.events.length : 0;
    console.log(
      `$${c.toFixed(4)} | i=${t.inputTokens} o=${t.outputTokens} cw=${t.cacheCreationInputTokens} cr=${t.cacheReadInputTokens} | events=${evtCount} rows=${t.rowCount}${t.error ? " ERR" : ""} | ${t.question.slice(0, 90)}`,
    );
  }

  // Most expensive conversations
  console.log(`\n=== TOP 10 MOST EXPENSIVE CONVERSATIONS ===`);
  const convoCosts: Array<{ id: string; turns: number; cost: number; inp: number; out: number; firstQ: string }> = [];
  for (const [id, ts] of byConvo.entries()) {
    const c = ts.reduce((s, t) => s + cost(t), 0);
    const inp = ts.reduce((s, t) => s + (t.inputTokens ?? 0), 0);
    const out = ts.reduce((s, t) => s + (t.outputTokens ?? 0), 0);
    convoCosts.push({ id, turns: ts.length, cost: c, inp, out, firstQ: ts[0].question.slice(0, 100) });
  }
  convoCosts.sort((a, b) => b.cost - a.cost);
  for (const c of convoCosts.slice(0, 10)) {
    console.log(
      `$${c.cost.toFixed(4)} | ${c.turns}t | i=${c.inp} o=${c.out} | ${c.firstQ}`,
    );
  }

  // Failed-turn cost (turns with error or no SQL produced)
  const failed = billed.filter((t) => t.error || (!t.sql && t.rowCount == null));
  const failedCost = failed.reduce((s, t) => s + cost(t), 0);
  console.log(
    `\n=== WASTED ON FAILED TURNS ===\n${failed.length} failed turns cost $${failedCost.toFixed(2)} (${((failedCost / sum.cost) * 100).toFixed(1)}% of total)`,
  );

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
