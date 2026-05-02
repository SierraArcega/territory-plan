// Anthropic Claude Opus 4.x pricing ($/MTok). Update if the report-tool model changes.
export const PRICE = {
  input: 15.0,
  output: 75.0,
  cacheWrite: 18.75, // 1.25× input
  cacheRead: 1.5, // 0.10× input
} as const;

export interface TurnTokens {
  inputTokens: number | null;
  outputTokens: number | null;
  cacheCreationInputTokens: number | null;
  cacheReadInputTokens: number | null;
}

export function turnCost(t: TurnTokens): number {
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

export type WindowScope = "7d" | "30d" | "90d" | "all";

export function scopeToSinceDate(scope: WindowScope): Date | null {
  if (scope === "all") return null;
  const days = scope === "7d" ? 7 : scope === "30d" ? 30 : 90;
  const d = new Date();
  d.setUTCDate(d.getUTCDate() - days);
  return d;
}

export function parseScope(raw: string | null): WindowScope {
  return raw === "7d" || raw === "90d" || raw === "all" ? raw : "30d";
}
