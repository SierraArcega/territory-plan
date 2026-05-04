import { describe, it, expect } from "vitest";
import { categorizeFailure } from "../failure-reasons";

describe("categorizeFailure — explicit context", () => {
  it.each([
    ["no_job_board_url", "no_job_board_url"],
    ["scan_timeout", "scan_timeout"],
    ["statewide_unattributable", "statewide_unattributable"],
    ["enrollment_ratio_skip", "enrollment_ratio_skip"],
    ["claude_fallback_empty", "claude_fallback_failed"],
  ] as const)("context %s -> %s", (context, expected) => {
    expect(categorizeFailure({ errorMessage: "anything", context })).toBe(expected);
  });
});

describe("categorizeFailure — string match (thrown_error)", () => {
  const cases: Array<[string, string]> = [
    ["Scan timed out", "scan_timeout"],
    ["Scan timed out (stale recovery)", "scan_timeout"],
    ["AbortError: aborted", "scan_timeout"],
    ["Anthropic API error: 529 overloaded", "claude_fallback_failed"],
    ["Claude API rate limit exceeded", "claude_fallback_failed"],
    ["Skipped: statewide board returned 412 vacancies", "statewide_unattributable"],
    ["Skipped: 200 vacancies looks like a regional aggregator", "enrollment_ratio_skip"],
    ["District has no job board URL", "no_job_board_url"],
    ["Request failed with status 404", "http_4xx"],
    ["403 Forbidden", "http_4xx"],
    ["Page Not Found", "http_4xx"],
    ["410 Gone", "http_4xx"],
    ["Server returned 500", "http_5xx"],
    ["502 Bad Gateway", "http_5xx"],
    ["503 Service Unavailable", "http_5xx"],
    ["fetch failed", "network_timeout"],
    ["ECONNREFUSED", "network_timeout"],
    ["getaddrinfo ENOTFOUND example.com", "network_timeout"],
    ["Some weird error nobody saw before", "unknown_error"],
    ["", "unknown_error"],
  ];

  it.each(cases)("%s -> %s", (errorMessage, expected) => {
    expect(categorizeFailure({ errorMessage, context: "thrown_error" })).toBe(expected);
  });

  it("defaults to thrown_error when context is omitted", () => {
    expect(categorizeFailure({ errorMessage: "Scan timed out" })).toBe("scan_timeout");
  });
});

describe("categorizeFailure — first-match-wins ordering", () => {
  it("scan_timeout beats http_4xx when both could match", () => {
    expect(
      categorizeFailure({ errorMessage: "Scan timed out: 404", context: "thrown_error" }),
    ).toBe("scan_timeout");
  });

  it("claude_fallback_failed beats http_5xx when both could match", () => {
    expect(
      categorizeFailure({
        errorMessage: "Anthropic API error: 503 service unavailable",
        context: "thrown_error",
      }),
    ).toBe("claude_fallback_failed");
  });
});

describe("categorizeFailure — bounded patterns reject numeric false-positives", () => {
  it.each([
    ["took 500ms to load", "unknown_error"],
    ["processed 4000 records", "unknown_error"],
    ["1500 items found", "unknown_error"],
    ["port 4444 unreachable", "unknown_error"],
    ["long gone session", "unknown_error"],
    ["social network failure", "unknown_error"],
  ] as const)("%s -> %s", (errorMessage, expected) => {
    expect(categorizeFailure({ errorMessage, context: "thrown_error" })).toBe(expected);
  });
});
