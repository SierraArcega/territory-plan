import prisma from "@/lib/prisma";

async function main() {
  const surrenders = await prisma.queryLog.findMany({
    where: { error: "agent_surrender_no_sql_error" },
    orderBy: { createdAt: "asc" },
    select: {
      id: true,
      conversationId: true,
      userId: true,
      createdAt: true,
      question: true,
      sql: true,
      error: true,
      params: true,
      user: { select: { fullName: true, email: true } },
    },
  });

  console.log(`=== ${surrenders.length} surrender rows ===\n`);
  for (const s of surrenders) {
    const who = s.user?.fullName ?? s.user?.email ?? s.userId;
    console.log(`#${s.id}  ${s.createdAt.toISOString()}  ${who}`);
    console.log(`  conv=${s.conversationId}`);
    console.log(`  Q: ${s.question}`);
    console.log();
  }

  const convIds = Array.from(
    new Set(surrenders.map((s) => s.conversationId).filter(Boolean) as string[]),
  );
  console.log(`=== ${convIds.length} unique conversations — full chronological dump ===\n`);

  for (const convId of convIds) {
    const turns = await prisma.queryLog.findMany({
      where: { conversationId: convId },
      orderBy: { createdAt: "asc" },
      select: {
        id: true,
        createdAt: true,
        question: true,
        sql: true,
        error: true,
        params: true,
        user: { select: { fullName: true, email: true } },
      },
    });
    const who = turns[0]?.user?.fullName ?? turns[0]?.user?.email ?? "?";
    console.log(`--- conversation ${convId} (${who}, ${turns.length} turns) ---`);
    for (const t of turns) {
      const surrendered = t.error === "agent_surrender_no_sql_error";
      const marker = surrendered ? "** SURRENDER **" : t.sql ? "ran SQL" : "no-sql";
      console.log(
        `  [#${t.id}] ${t.createdAt.toISOString()}  ${marker}${t.error && !surrendered ? `  err=${t.error.slice(0, 60)}` : ""}`,
      );
      console.log(`     Q: ${t.question.replace(/\s+/g, " ").slice(0, 200)}`);
      if (t.sql) {
        console.log(`     SQL: ${t.sql.replace(/\s+/g, " ").slice(0, 200)}`);
      }
      const paramsKeys =
        t.params && typeof t.params === "object" ? Object.keys(t.params as object) : [];
      if (paramsKeys.length) {
        const summary =
          (t.params as { summary?: { source?: string } } | null)?.summary?.source;
        console.log(`     params keys: [${paramsKeys.join(",")}]${summary ? `  summary.source="${summary}"` : ""}`);
      }
    }
    console.log();
  }

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
