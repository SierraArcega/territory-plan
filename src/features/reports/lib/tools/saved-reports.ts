import prisma from "@/lib/prisma";

export async function handleSearchSavedReports(
  query: string,
  userId: string,
): Promise<string> {
  const tokens = query
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter((t) => t.length >= 2);
  if (tokens.length === 0) {
    return "Provide a non-empty query.";
  }

  const reports = await prisma.savedReport.findMany({
    where: { userId },
    orderBy: { updatedAt: "desc" },
    take: 50,
  });

  const scored = reports
    .map((r) => {
      const hay = (
        r.title +
        " " +
        r.question +
        " " +
        JSON.stringify(r.summary ?? {})
      ).toLowerCase();
      const score = tokens.reduce(
        (acc, t) => acc + (hay.includes(t) ? 1 : 0),
        0,
      );
      return { report: r, score };
    })
    .filter((s) => s.score > 0)
    .sort((a, b) => b.score - a.score)
    .slice(0, 10);

  if (scored.length === 0) return `No saved reports match "${query}".`;

  return scored
    .map(
      ({ report }) =>
        `- id=${report.id} "${report.title}" (updated ${report.updatedAt.toISOString().slice(0, 10)}) — ${report.question}`,
    )
    .join("\n");
}

export async function handleGetSavedReport(
  id: number,
  userId: string,
): Promise<string> {
  const report = await prisma.savedReport.findUnique({ where: { id } });
  if (!report || report.userId !== userId) {
    return `Saved report ${id} not found.`;
  }
  return [
    `# ${report.title}`,
    `Question: ${report.question}`,
    `SQL: ${report.sql ?? "(not stored)"}`,
    `Summary: ${JSON.stringify(report.summary ?? {}, null, 2)}`,
  ].join("\n");
}
