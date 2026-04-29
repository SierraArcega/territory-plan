import { TABLE_REGISTRY, SEMANTIC_CONTEXT } from "@/lib/district-column-metadata";

interface Match {
  source: "column" | "concept" | "warning" | "format_mismatch";
  location: string;
  text: string;
  score: number;
}

function tokenize(s: string): string[] {
  return s
    .toLowerCase()
    .split(/[^a-z0-9]+/)
    .filter(Boolean);
}

function scoreText(haystack: string, queryTokens: string[]): number {
  const h = haystack.toLowerCase();
  let score = 0;
  for (const q of queryTokens) {
    if (q.length < 2) continue;
    const matches = (h.match(new RegExp(`\\b${q}`, "g")) ?? []).length;
    score += matches * (q.length >= 5 ? 2 : 1);
  }
  return score;
}

export async function handleSearchMetadata(query: string): Promise<string> {
  const tokens = tokenize(query);
  if (tokens.length === 0) {
    return "Provide a non-empty query.";
  }
  const matches: Match[] = [];

  for (const table of Object.values(TABLE_REGISTRY)) {
    for (const col of table.columns) {
      const hay = `${col.column} ${col.label ?? ""} ${col.description}`;
      const score = scoreText(hay, tokens);
      if (score > 0) {
        matches.push({
          source: "column",
          location: `${table.table}.${col.column}`,
          text: col.description,
          score,
        });
      }
    }
  }

  for (const [key, mapping] of Object.entries(SEMANTIC_CONTEXT.conceptMappings)) {
    const hay = `${key} ${mapping.aggregated ?? ""} ${mapping.dealLevel ?? ""} ${mapping.note ?? ""}`;
    const score = scoreText(hay, tokens);
    if (score > 0) {
      matches.push({
        source: "concept",
        location: key,
        text: [
          mapping.aggregated && `aggregated: ${mapping.aggregated}`,
          mapping.dealLevel && `dealLevel: ${mapping.dealLevel}`,
          mapping.note && `note: ${mapping.note}`,
        ]
          .filter(Boolean)
          .join(" | "),
        score: score + 1,
      });
    }
  }

  for (const warning of SEMANTIC_CONTEXT.warnings) {
    const score = scoreText(warning.message, tokens);
    if (score > 0) {
      matches.push({
        source: "warning",
        location: warning.triggerTables.join(","),
        text: `[${warning.severity}] ${warning.message}`,
        score,
      });
    }
  }

  for (const fm of SEMANTIC_CONTEXT.formatMismatches) {
    const hay = `${fm.concept} ${fm.note ?? ""}`;
    const score = scoreText(hay, tokens);
    if (score > 0) {
      matches.push({
        source: "format_mismatch",
        location: fm.concept,
        text: fm.note ?? "",
        score,
      });
    }
  }

  if (matches.length === 0) {
    return `No matches for "${query}". Try different terms or call list_tables / describe_table.`;
  }

  matches.sort((a, b) => b.score - a.score);
  const top = matches.slice(0, 25);

  const grouped: Record<string, Match[]> = {};
  for (const m of top) {
    grouped[m.source] ??= [];
    grouped[m.source].push(m);
  }

  const out: string[] = [`Matches for "${query}" (top ${top.length}):`, ""];
  for (const [source, arr] of Object.entries(grouped)) {
    out.push(`## ${source}s`);
    for (const m of arr) {
      out.push(`  - ${m.location}: ${m.text}`);
    }
    out.push("");
  }
  return out.join("\n").trim();
}
