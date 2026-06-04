import { describe, it, expect } from "vitest";
import { resolveScope } from "../scope";

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

  it("returns team mode with every rep email", () => {
    expect(resolveScope("team", reps, caller)).toEqual({
      mode: "team",
      emails: ["me@x", "u2@x"],
    });
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
