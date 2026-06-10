import { describe, expect, it } from "vitest";
import { parseCsv } from "@/features/shared/lib/csv";
import {
  ACTIVITY_FIELD_DEFS,
  LEAD_FIELD_DEFS,
  activityTemplateCsv,
  buildHeaderMapping,
  importErrorCopy,
  leadTemplateCsv,
  toActivityImportRows,
  toLeadImportRows,
} from "../import";

describe("buildHeaderMapping", () => {
  it("maps headers case- and punctuation-insensitively", () => {
    const mapping = buildHeaderMapping(
      ["EMAIL", "First Name", "last_name", "NCES-ID", "School/District"],
      LEAD_FIELD_DEFS,
    );
    expect(mapping.byField.email).toBe("EMAIL");
    expect(mapping.byField.first).toBe("First Name");
    expect(mapping.byField.last).toBe("last_name");
    expect(mapping.byField.leaid).toBe("NCES-ID");
    expect(mapping.byField.districtName).toBe("School/District");
    expect(mapping.missingRequired).toEqual([]);
  });

  it("reports missing required columns", () => {
    const mapping = buildHeaderMapping(["First Name"], LEAD_FIELD_DEFS);
    expect(mapping.missingRequired).toEqual(["Email"]);
  });

  it("lists unmapped headers so the UI can flag ignored columns", () => {
    const mapping = buildHeaderMapping(["Email", "Favorite Color"], LEAD_FIELD_DEFS);
    expect(mapping.unmapped).toEqual(["Favorite Color"]);
  });

  it("never claims the same header for two fields", () => {
    // "type" is an alias of both leadType (leads) and kind (activities) — within
    // one def list a header maps once.
    const mapping = buildHeaderMapping(["Type", "Lead Type"], LEAD_FIELD_DEFS);
    expect(mapping.byField.leadType).toBe("Lead Type");
    expect(mapping.unmapped).toEqual(["Type"]);
  });
});

describe("toLeadImportRows", () => {
  const csv = parseCsv(
    [
      "Email,First Name,Last Name,Title,District NCES ID,Lead Type,Engagement Score,Sequence",
      "k@x.org,Karen,Whitfield,Director,0802940,MQL,138,Superintendent — Special Ed",
      "t@y.org,Tom,Becker,,0410192,inbound,,",
    ].join("\n"),
  );
  const mapping = buildHeaderMapping(csv.headers, LEAD_FIELD_DEFS);

  it("converts cells, lowercases the lead type, and parses the score", () => {
    const rows = toLeadImportRows(csv, mapping, "me-1");
    expect(rows[0]).toMatchObject({
      email: "k@x.org",
      first: "Karen",
      last: "Whitfield",
      title: "Director",
      leaid: "0802940",
      leadType: "mql",
      score: 138,
      sequence: "Superintendent — Special Ed",
      assignedBdrId: "me-1",
    });
  });

  it("defaults the sequence to the General BDR Sequence and leaves blanks undefined", () => {
    const rows = toLeadImportRows(csv, mapping, undefined);
    expect(rows[1].sequence).toBe("General BDR Sequence");
    expect(rows[1].title).toBeUndefined();
    expect(rows[1].score).toBeUndefined();
    expect(rows[1].assignedBdrId).toBeUndefined();
  });
});

describe("toActivityImportRows", () => {
  const csv = parseCsv(
    [
      "Lead Email,Activity Type,Subject / Detail,Date,Points,School NCES",
      'k@x.org,Webinar,"Attended ""IEP staffing"" webinar",2026-05-29,40,410192002663',
      "t@y.org,email,Clicked pricing link,2026-05-30,,",
    ].join("\n"),
  );
  const mapping = buildHeaderMapping(csv.headers, ACTIVITY_FIELD_DEFS);

  it("converts cells with lowercased kind and numeric points", () => {
    const rows = toActivityImportRows(csv, mapping);
    expect(rows[0]).toMatchObject({
      email: "k@x.org",
      kind: "webinar",
      title: 'Attended "IEP staffing" webinar',
      occurredAt: "2026-05-29",
      points: 40,
      schoolNcessch: "410192002663",
    });
    expect(rows[1].points).toBeUndefined();
  });
});

describe("templates", () => {
  it("lead template parses back with every field header present", () => {
    const parsed = parseCsv(leadTemplateCsv());
    expect(parsed.headers).toEqual(LEAD_FIELD_DEFS.map((d) => d.label));
    const mapping = buildHeaderMapping(parsed.headers, LEAD_FIELD_DEFS);
    expect(mapping.missingRequired).toEqual([]);
    expect(Object.keys(mapping.byField)).toHaveLength(LEAD_FIELD_DEFS.length);
    expect(parsed.rows).toHaveLength(1);
  });

  it("activity template parses back with every field header present", () => {
    const parsed = parseCsv(activityTemplateCsv());
    expect(parsed.headers).toEqual(ACTIVITY_FIELD_DEFS.map((d) => d.label));
    const mapping = buildHeaderMapping(parsed.headers, ACTIVITY_FIELD_DEFS);
    expect(mapping.missingRequired).toEqual([]);
    expect(Object.keys(mapping.byField)).toHaveLength(ACTIVITY_FIELD_DEFS.length);
  });
});

describe("importErrorCopy", () => {
  it("translates known codes and passes unknown codes through", () => {
    expect(importErrorCopy("invalid_email")).toBe("Missing or invalid email");
    expect(importErrorCopy("contact_has_active_lead")).toBe(
      "Contact already has an active lead",
    );
    expect(importErrorCopy("weird_code")).toBe("weird_code");
  });
});
