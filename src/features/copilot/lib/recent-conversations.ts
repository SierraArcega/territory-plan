import type { PrismaClient } from "@prisma/client";

type Db = Pick<PrismaClient, "copilotTurn">;

export interface RecentConversation {
  conversationId: string;
  title: string;       // first question of the thread
  updatedAt: string;   // latest turn time (ISO)
}

/** Most-recent conversations for a rep, titled by their opening question. */
export async function loadRecentConversations(
  db: Db,
  userId: string,
  limit: number,
): Promise<RecentConversation[]> {
  const rows = await db.copilotTurn.findMany({
    where: { userId },
    orderBy: { createdAt: "desc" },
    take: 200,
    select: { conversationId: true, question: true, createdAt: true },
  });

  const byConv = new Map<string, { title: string; firstAt: number; lastAt: number }>();
  for (const r of rows) {
    const t = r.createdAt.getTime();
    const cur = byConv.get(r.conversationId);
    if (!cur) {
      byConv.set(r.conversationId, { title: r.question, firstAt: t, lastAt: t });
    } else {
      if (t < cur.firstAt) { cur.firstAt = t; cur.title = r.question; }
      if (t > cur.lastAt) cur.lastAt = t;
    }
  }

  return [...byConv.entries()]
    .map(([conversationId, v]) => ({
      conversationId,
      title: v.title,
      updatedAt: new Date(v.lastAt).toISOString(),
    }))
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt))
    .slice(0, limit);
}
