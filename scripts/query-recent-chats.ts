import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const turns = await prisma.queryLog.findMany({
    orderBy: { createdAt: "desc" },
    take: 80,
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
      error: true,
      action: true,
      actionSuccess: true,
      createdAt: true,
    },
  });

  // Group by conversation
  const convos = new Map<string, typeof turns>();
  for (const t of turns) {
    const k = t.conversationId ?? "(none)";
    if (!convos.has(k)) convos.set(k, []);
    convos.get(k)!.push(t);
  }

  console.log(`=== ${turns.length} recent turns across ${convos.size} conversations ===\n`);

  let cIdx = 0;
  for (const [convoId, ts] of convos) {
    cIdx++;
    if (cIdx > 25) break;
    const ordered = [...ts].reverse(); // oldest first
    console.log(`\n--- Convo ${cIdx} [${convoId.slice(0, 8)}] ${ordered.length} turns, ${ordered[0].createdAt.toISOString().slice(0, 16)} ---`);
    for (const t of ordered) {
      const params: any = t.params ?? {};
      const summary = params?.summary?.source ?? params?.summary ?? "";
      const assistantText = (params?.assistantText ?? "").slice(0, 200);
      const events = Array.isArray(params?.events) ? params.events : [];
      const toolCalls = events.filter((e: any) => e?.type === "tool_use" || e?.toolName).map((e: any) => e?.toolName ?? e?.name).filter(Boolean);
      const eventTypes = events.map((e: any) => e?.type ?? e?.kind).filter(Boolean);
      console.log(`  Q: ${(t.question ?? "").slice(0, 220)}`);
      if (assistantText) console.log(`  A: ${assistantText.replace(/\n/g, " ")}`);
      if (summary) console.log(`  src: ${typeof summary === "string" ? summary : JSON.stringify(summary).slice(0, 200)}`);
      console.log(`  tools: [${toolCalls.slice(0, 12).join(", ")}] events:${eventTypes.length} rows:${t.rowCount} ms:${t.executionTimeMs} tok:${t.inputTokens}/${t.outputTokens}${t.error ? " ERR:" + t.error.slice(0, 120) : ""}${t.action ? " action:" + t.action + (t.actionSuccess === false ? "(fail)" : "") : ""}`);
      if (t.sql) console.log(`  sql: ${t.sql.replace(/\s+/g, " ").slice(0, 240)}`);
    }
  }

  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
