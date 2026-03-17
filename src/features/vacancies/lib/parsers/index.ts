import type { RawVacancy } from "./types";
import { parseApplitrack } from "./applitrack";
import { parseOlas } from "./olas";
import { parseSchoolSpring } from "./schoolspring";

type ParserFn = (url: string) => Promise<RawVacancy[]>;

const parserMap: Record<string, ParserFn> = {
  applitrack: parseApplitrack,
  olas: parseOlas,
  schoolspring: parseSchoolSpring,
};

/**
 * Returns the parser function for a given platform identifier,
 * or null for unknown platforms (which should use the Claude fallback).
 */
export function getParser(platform: string): ParserFn | null {
  return parserMap[platform] ?? null;
}

export { parseWithClaude } from "./claude-fallback";
export type { RawVacancy } from "./types";
