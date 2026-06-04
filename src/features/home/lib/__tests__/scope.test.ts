import { describe, it, expect } from "vitest";
import { Prisma } from "@prisma/client";
import { resolveScope, emailFilterSql, emailInScope, type DashboardScope } from "../scope";

const reps = [
  { id: "me", email: "me@x", fullName: "Me", avatarUrl: null },
  { id: "u2", email: "u2@x", fullName: "U2", avatarUrl: null },
];
const caller = { id: "me", email: "me@x" };

describe("resolveScope", () => {
  it("defaults to the caller when rep param is absent", () => {
    expect(resolveScope(null, reps, caller)).toEqual({
      mode: "rep",
      rep: { id: "me", email: "me@x" },
      emails: ["me@x"],
    });
  });

  it("scopes to a specific other rep", () => {
    expect(resolveScope("u2", reps, caller)).toEqual({
      mode: "rep",
      rep: { id: "u2", email: "u2@x" },
      emails: ["u2@x"],
    });
  });

  it("returns team mode (whole book — no enumerated emails)", () => {
    expect(resolveScope("team", reps, caller)).toEqual({ mode: "team" });
  });

  it("resolves the caller even when they are not in the rep roster (admin viewing self)", () => {
    const admin = { id: "boss", email: "boss@x" };
    expect(resolveScope(null, reps, admin)).toEqual({
      mode: "rep",
      rep: { id: "boss", email: "boss@x" },
      emails: ["boss@x"],
    });
  });

  it("returns null for an unknown rep id", () => {
    expect(resolveScope("ghost", reps, caller)).toBeNull();
  });
});

const repScope: DashboardScope = { mode: "rep", rep: { id: "u2", email: "u2@x" }, emails: ["u2@x"] };
const teamScope: DashboardScope = { mode: "team" };

describe("emailFilterSql", () => {
  it("rep mode restricts to the subject email via ANY", () => {
    const sql = emailFilterSql(repScope, Prisma.sql`o.sales_rep_email`);
    // The fragment carries the email array as a bound parameter (parameterized, not inlined).
    expect(sql.values).toEqual([["u2@x"]]);
    expect(sql.sql).toContain("= ANY");
  });

  it("team mode is the whole book — no email restriction, just non-null", () => {
    const sql = emailFilterSql(teamScope, Prisma.sql`o.sales_rep_email`);
    expect(sql.values).toEqual([]);
    expect(sql.sql).toContain("IS NOT NULL");
  });
});

describe("emailInScope", () => {
  it("rep mode matches only the subject email", () => {
    expect(emailInScope(repScope, "u2@x")).toBe(true);
    expect(emailInScope(repScope, "me@x")).toBe(false);
    expect(emailInScope(repScope, null)).toBe(false);
  });

  it("team mode matches every non-null email", () => {
    expect(emailInScope(teamScope, "anyone@x")).toBe(true);
    expect(emailInScope(teamScope, "former-rep@x")).toBe(true);
    expect(emailInScope(teamScope, null)).toBe(false);
  });
});
