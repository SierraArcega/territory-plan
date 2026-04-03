import { describe, it, expect } from "vitest";
import {
  resolveMergeFields,
  extractMergeFieldKeys,
  hasUnresolvedFields,
} from "../merge-fields";

describe("extractMergeFieldKeys", () => {
  it("extracts merge field keys from template text", () => {
    const text =
      "Hi {{contact.first_name}}, your district {{district.name}} has {{district.enrollment}} students.";
    const keys = extractMergeFieldKeys(text);
    expect(keys).toEqual([
      "contact.first_name",
      "district.name",
      "district.enrollment",
    ]);
  });

  it("returns empty array for text with no merge fields", () => {
    expect(extractMergeFieldKeys("Hello world")).toEqual([]);
  });

  it("handles duplicate keys", () => {
    const text = "{{contact.first_name}} and {{contact.first_name}} again";
    const keys = extractMergeFieldKeys(text);
    expect(keys).toEqual(["contact.first_name"]);
  });
});

describe("resolveMergeFields", () => {
  const context = {
    contact: {
      first_name: "Jane",
      last_name: "Smith",
      full_name: "Jane Smith",
      title: "Superintendent",
      email: "jane@lincoln.edu",
      phone: "(555) 123-4567",
    },
    district: {
      name: "Lincoln Unified",
      state: "CA",
      city: "Sacramento",
      enrollment: "14200",
      leaid: "0612345",
      pipeline: "$50,000",
      bookings: "$25,000",
      invoicing: "$10,000",
      sessions_revenue: "$8,000",
    },
    sender: {
      name: "Aston Furious",
      email: "aston@fullmind.com",
      title: "Account Executive",
    },
    date: {
      today: "April 3, 2026",
      current_month: "April",
      current_year: "2026",
    },
    custom: {
      talking_point: "budget season priorities",
    },
  };

  it("resolves system merge fields", () => {
    const template =
      "Hi {{contact.first_name}}, I'm {{sender.name}} from Fullmind.";
    const result = resolveMergeFields(template, context);
    expect(result).toBe("Hi Jane, I'm Aston Furious from Fullmind.");
  });

  it("resolves custom merge fields", () => {
    const template = "Let's discuss {{talking_point}}.";
    const result = resolveMergeFields(template, context);
    expect(result).toBe("Let's discuss budget season priorities.");
  });

  it("leaves unresolved fields as-is", () => {
    const template = "Hi {{contact.first_name}}, about {{unknown_field}}.";
    const result = resolveMergeFields(template, context);
    expect(result).toBe("Hi Jane, about {{unknown_field}}.");
  });

  it("handles empty template", () => {
    expect(resolveMergeFields("", context)).toBe("");
  });
});

describe("hasUnresolvedFields", () => {
  it("returns true when unresolved fields exist", () => {
    expect(hasUnresolvedFields("Hi {{contact.first_name}}")).toBe(true);
  });

  it("returns false when no merge fields", () => {
    expect(hasUnresolvedFields("Hi Jane")).toBe(false);
  });
});
