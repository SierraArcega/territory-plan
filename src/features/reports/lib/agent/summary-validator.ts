import type { QuerySummary } from "./types";
import { MAX_LIMIT } from "./types";

export interface ValidationResult {
  valid: boolean;
  errors: string[];
}

/** Count top-level SELECT columns in a SQL string. Handles nested parens + quoted commas. */
function countSelectColumns(sql: string): number | null {
  const clean = sql.replace(/--.*$/gm, "").replace(/\/\*[\s\S]*?\*\//g, "");

  const selectMatch = /\bselect\b([\s\S]*?)\bfrom\b/i.exec(clean);
  if (!selectMatch) return null;

  const body = selectMatch[1]!;
  let depth = 0;
  let inSingle = false;
  let inDouble = false;
  let commas = 0;
  for (let i = 0; i < body.length; i++) {
    const c = body[i]!;
    const prev = body[i - 1];
    if (c === "'" && prev !== "\\" && !inDouble) inSingle = !inSingle;
    if (c === '"' && prev !== "\\" && !inSingle) inDouble = !inDouble;
    if (inSingle || inDouble) continue;
    if (c === "(") depth++;
    else if (c === ")") depth--;
    else if (c === "," && depth === 0) commas++;
  }
  return commas + 1;
}

function findLimit(sql: string): number | null {
  const m = /\blimit\s+(\d+)\b/i.exec(sql);
  return m ? Number(m[1]) : null;
}

/** Extract literal values from the SQL (quoted strings + numeric comparands). */
function extractLiterals(sql: string): string[] {
  const literals: string[] = [];
  const singleQuoted = sql.match(/'([^']*)'/g) ?? [];
  for (const s of singleQuoted) literals.push(s.slice(1, -1));
  return literals;
}

/** Normalize for comparison: lowercase + strip punctuation + whitespace. */
function norm(s: string): string {
  return s.toLowerCase().replace(/[\s\-_.,$]/g, "");
}

export function validateSummary(
  sql: string,
  summary: QuerySummary,
): ValidationResult {
  const errors: string[] = [];

  const limit = findLimit(sql);
  if (limit == null) {
    errors.push("SQL is missing a LIMIT clause.");
  } else if (limit > MAX_LIMIT) {
    errors.push(`SQL LIMIT ${limit} exceeds MAX_LIMIT ${MAX_LIMIT}.`);
  } else if (summary.limit !== limit) {
    errors.push(
      `summary.limit (${summary.limit}) does not match SQL LIMIT (${limit}).`,
    );
  }

  const selectCount = countSelectColumns(sql);
  if (selectCount == null) {
    errors.push("Could not parse SELECT list from SQL.");
  } else if (selectCount !== summary.columns.length) {
    errors.push(
      `summary.columns has ${summary.columns.length} entries but SQL SELECT has ${selectCount}.`,
    );
  }

  const literals = extractLiterals(sql);
  const haystack = norm(sql + " " + literals.join(" "));
  for (const f of summary.filters) {
    const needle = norm(f.value);
    if (needle.length < 2) continue;
    const hit =
      haystack.includes(needle) ||
      literals.some((lit) => {
        const n = norm(lit);
        return n.includes(needle) || needle.includes(n);
      });
    if (!hit) {
      errors.push(
        `Filter "${f.label}: ${f.value}" does not appear in SQL literals.`,
      );
    }
  }

  return { valid: errors.length === 0, errors };
}
