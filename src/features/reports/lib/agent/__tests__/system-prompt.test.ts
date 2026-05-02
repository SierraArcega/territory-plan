import { describe, it, expect } from "vitest";
import { buildSystemPrompt, extractTablesFromSql } from "../system-prompt";
import type { PriorTurn } from "../conversation";
import { SEMANTIC_CONTEXT } from "@/lib/district-column-metadata";

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

  it("with no prior turns, omits the 'already explored' section header", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt).not.toContain("# Tables already explored in this conversation");
  });

  it("with a prior turn that queried districts, includes the 'already explored' section", async () => {
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
    expect(prompt).toContain("# Tables already explored in this conversation");
    expect(prompt).toContain("# districts");
  });

  it("states the default-revenue rule (subscription fold-in)", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.toLowerCase()).toMatch(/default[\s\S]{0,50}revenue/);
    expect(prompt).toMatch(/COALESCE|fold[\s-]?in|subscription/i);
  });

  it("requires the agent to narrate what's shown including caveats", async () => {
    const prompt = await buildSystemPrompt();
    expect(prompt.toLowerCase()).toMatch(/caveat|surface|explain what/);
  });

  it("forbids text-only SQL output (anti-ghost-report)", async () => {
    const prompt = await buildSystemPrompt();
    // Anchor on the named failure mode 'ghost report' — most stable phrase
    // that survives reasonable rule rewordings.
    expect(prompt.toLowerCase()).toMatch(/ghost.?report/);
    expect(prompt.toLowerCase()).toMatch(/must invoke[\s\S]{0,10}run_sql/);
  });

  it("instructs the agent to keep currency tokens in column aliases", async () => {
    const prompt = await buildSystemPrompt();
    // Pin the rule heading so the rule itself can't be silently removed.
    expect(prompt.toLowerCase()).toMatch(/keep currency tokens in column aliases/);
    // Spot-check that the enumerated token list survives — pick a less-common
    // token (`bookings`) so a future trim that drops half the list still fails.
    expect(prompt).toMatch(/`bookings`/);
  });

  it("dedupes tables across prior turns and skips unknown ones", async () => {
    const prior: PriorTurn[] = [
      {
        question: "Q1",
        sql: "SELECT * FROM districts d JOIN unknown_made_up_table u ON u.id = d.leaid",
        summary: null,
        assistantText: null,
        createdAt: new Date(),
      },
      {
        question: "Q2",
        sql: "SELECT * FROM districts WHERE state_abbrev = 'CA'",
        summary: null,
        assistantText: null,
        createdAt: new Date(),
      },
    ];
    const prompt = await buildSystemPrompt(prior);
    // districts schema appears exactly once
    expect(prompt.match(/^# districts$/gm)?.length).toBe(1);
    expect(prompt).not.toContain("unknown_made_up_table");
  });
});

describe("SEMANTIC_CONTEXT", () => {
  it("exposes default_revenue concept for the agent", () => {
    const ctx = SEMANTIC_CONTEXT.conceptMappings.default_revenue;
    expect(ctx).toBeDefined();
    expect(ctx.dealLevel).toMatch(/COALESCE/);
    expect(ctx.aggregated).toMatch(/district_opportunity_actuals|district_financials/);
    expect(ctx.note).toMatch(/session_vs_subscription_revenue/);
  });

  it("session_vs_subscription_revenue points back to default_revenue for the combined default", () => {
    const ctx = SEMANTIC_CONTEXT.conceptMappings.session_vs_subscription_revenue;
    expect(ctx).toBeDefined();
    expect(ctx.note).toMatch(/default_revenue/);
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
