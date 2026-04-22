import { describe, it, expect } from "vitest";
import { buildSystemPrompt } from "../system-prompt";

describe("buildSystemPrompt", () => {
  it("includes the never-show-SQL rule", () => {
    const prompt = buildSystemPrompt();
    expect(prompt.toLowerCase()).toContain("never");
    expect(prompt.toLowerCase()).toContain("sql");
  });

  it("includes the no-IDs rule", () => {
    const prompt = buildSystemPrompt();
    expect(prompt.toLowerCase()).toMatch(/id column|primary[- ]key/);
  });

  it("instructs to ask clarifying questions when ambiguous", () => {
    const prompt = buildSystemPrompt();
    expect(prompt.toLowerCase()).toContain("clarifying");
  });

  it("lists registered tables (at least districts)", () => {
    const prompt = buildSystemPrompt();
    expect(prompt).toContain("districts");
  });

  it("mentions the terminal nature of run_sql", () => {
    const prompt = buildSystemPrompt();
    expect(prompt.toLowerCase()).toContain("run_sql");
    expect(prompt.toLowerCase()).toMatch(/terminal|ends the turn|once per turn/);
  });
});
