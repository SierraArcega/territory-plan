import { describe, it, expect } from "vitest";
import { buildSystemPrompt, extractTablesFromSql } from "../system-prompt";
import type { PriorTurn } from "../conversation";

describe("buildSystemPrompt", () => {
  it("includes the never-show-SQL rule", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.toLowerCase()).toContain("never");
    expect(prompt.toLowerCase()).toContain("sql");
  });

  it("includes the no-IDs rule", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.toLowerCase()).toMatch(/id column|primary[- ]key/);
  });

  it("instructs to ask clarifying questions when ambiguous", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.toLowerCase()).toContain("clarifying");
  });

  it("lists registered tables (at least districts)", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain("districts");
  });

  it("mentions the terminal nature of run_sql", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.toLowerCase()).toContain("run_sql");
    expect(prompt.toLowerCase()).toMatch(/terminal|ends the turn|once per turn/);
  });

  it("always includes the pre-loaded schemas section (covers districts, opportunities, etc.)", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).toContain("# Pre-loaded table schemas");
    expect(prompt).toContain("## districts");
    expect(prompt).toContain("## opportunities");
  });

  it("with no prior turns, omits the 'other tables explored' section header", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).not.toContain("# Other tables already explored in this conversation");
  });

  it("with a prior turn that queried a non-pre-baked table, includes the explored section for that table", async () => {
    const prior: PriorTurn[] = [
      {
        question: "Show me tasks for the rep",
        sql: "SELECT id, title FROM tasks WHERE owner_id = '1' LIMIT 100",
        summary: null,
        assistantText: null,
        createdAt: new Date(),
      },
    ];
    const prompt = await buildSystemPrompt(prior);
    expect(prompt).toContain("# Other tables already explored in this conversation");
    expect(prompt).toContain("# tasks");
  });

  it("with a prior turn that queried only pre-baked tables, omits the explored section (no duplication)", async () => {
    const prior: PriorTurn[] = [
      {
        question: "Show me districts in Texas",
        sql: "SELECT name FROM districts WHERE state_abbrev = 'TX' LIMIT 100",
        summary: null,
        assistantText: null,
        createdAt: new Date(),
      },
    ];
    const prompt = await buildSystemPrompt(prior);
    expect(prompt).not.toContain("# Other tables already explored in this conversation");
    // districts compact schema still appears (in pre-baked section), exactly once
    expect(prompt.match(/^## districts —/gm)?.length).toBe(1);
  });

  it("dedupes tables across prior turns and skips unknown ones", async () => {
    const prior: PriorTurn[] = [
      {
        question: "Q1",
        sql: "SELECT * FROM tasks t JOIN unknown_made_up_table u ON u.id = t.id",
        summary: null,
        assistantText: null,
        createdAt: new Date(),
      },
      {
        question: "Q2",
        sql: "SELECT * FROM tasks WHERE owner_id = 'abc'",
        summary: null,
        assistantText: null,
        createdAt: new Date(),
      },
    ];
    const prompt = await buildSystemPrompt(prior);
    // tasks full schema (from describe_table) appears exactly once in the explored section
    expect(prompt.match(/^# tasks$/gm)?.length).toBe(1);
    expect(prompt).not.toContain("unknown_made_up_table");
  });
});

describe("extractTablesFromSql", () => {
  it("pulls tables from FROM and JOIN clauses, case-insensitive", () => {
    const sql =
      "SELECT * FROM Districts d LEFT JOIN opportunities o ON o.leaid = d.leaid INNER JOIN states s ON s.abbreviation = d.state_abbrev";
    const tables = extractTablesFromSql(sql);
    expect(tables.sort()).toEqual(["districts", "opportunities", "states"]);
  });

  it("strips quoted/backticked identifiers", () => {
    const sql = `SELECT * FROM "districts" JOIN \`opportunities\` ON true`;
    expect(extractTablesFromSql(sql).sort()).toEqual(["districts", "opportunities"]);
  });

  it("returns [] for SQL with no FROM/JOIN", () => {
    expect(extractTablesFromSql("SELECT 1")).toEqual([]);
  });
});
