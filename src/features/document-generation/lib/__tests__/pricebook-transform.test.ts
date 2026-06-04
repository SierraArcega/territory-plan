import { describe, it, expect } from "vitest";

import {
  parseCsv,
  stripHtml,
  deriveFiscalYear,
  parseNum,
  deriveUnit,
  isExcluded,
  toProduct,
  buildFlatProducts,
  buildVolumeProducts,
} from "../pricebook-transform";

describe("parseCsv", () => {
  it("parses quoted fields with embedded commas and escaped quotes", () => {
    const csv =
      '"Name","SKU","Price"\n' +
      '"Whole Class, Grade 5","WC-5","168.83"\n' +
      '"He said ""hi""","Q-1","0.0"\n';
    const rows = parseCsv(csv);
    expect(rows).toHaveLength(2);
    expect(rows[0]).toMatchObject({ Name: "Whole Class, Grade 5", SKU: "WC-5", Price: "168.83" });
    expect(rows[1].Name).toBe('He said "hi"');
  });

  it("ignores trailing blank lines", () => {
    expect(parseCsv('"A"\n"x"\n\n')).toHaveLength(1);
  });
});

describe("stripHtml", () => {
  it("strips tags and decodes common entities, collapsing whitespace", () => {
    expect(stripHtml("<p>1 Hour of Collaboration</p>")).toBe("1 Hour of Collaboration");
    expect(stripHtml("Staffed &gt;5 Years &amp; Certified")).toBe("Staffed >5 Years & Certified");
    expect(stripHtml("")).toBe("");
  });
});

describe("deriveFiscalYear", () => {
  it("reads the FY token from the category", () => {
    expect(deriveFiscalYear("FY27 BOCES Pricing")).toBe("FY27");
    expect(deriveFiscalYear("FY26 Hybrid Staffing/Active")).toBe("FY26");
    expect(deriveFiscalYear("")).toBeNull();
  });
});

describe("parseNum", () => {
  it("tolerates currency formatting and blanks", () => {
    expect(parseNum("168.83")).toBe(168.83);
    expect(parseNum("$62,285.44 ")).toBe(62285.44);
    expect(parseNum("")).toBeNull();
    expect(parseNum("n/a")).toBeNull();
  });
});

describe("deriveUnit", () => {
  it("prefers Charged Per, then hourly, then annual", () => {
    expect(deriveUnit({ "Charged Per": "Session" })).toBe("Session");
    expect(deriveUnit({ "Price per Hour": "53.06" })).toBe("Hour");
    expect(deriveUnit({ "Full Year (190 Days)": "$59,007.26 " })).toBe("Year");
    expect(deriveUnit({})).toBeNull();
  });
});

describe("isExcluded", () => {
  it("excludes the Allocation custom line item and blank-category rows", () => {
    expect(isExcluded({ Name: "Allocation", Category: "" })).toBe(true);
    expect(isExcluded({ Name: "Anything", Category: "" })).toBe(true);
    expect(isExcluded({ Name: "Homebound 1:1", Category: "FY27 BOCES Pricing" })).toBe(false);
  });
});

describe("toProduct", () => {
  it("maps a flat row, dropping Cost and stripping HTML", () => {
    const p = toProduct({
      Name: "Educator Prep Fee ",
      SKU: "BOC27-EDPREP",
      Category: "FY27 BOCES Pricing",
      Price: "79.59",
      Cost: "10.0",
      Description: "<p>1 hour of prep for 4 hours</p>",
      "Price per Hour": "",
      "Charged Per": "",
    });
    expect(p).toMatchObject({
      sku: "BOC27-EDPREP",
      name: "Educator Prep Fee",
      category: "FY27 BOCES Pricing",
      fiscalYear: "FY27",
      listRate: 79.59,
      description: "1 hour of prep for 4 hours",
    });
    expect(p).not.toHaveProperty("cost");
  });

  it("keeps $0 placeholder rows with listRate 0", () => {
    const p = toProduct({ Name: "Program Coordinator", SKU: "PGC-2027", Category: "FY27 EK12 Pricebook", Price: "0.0" });
    expect(p.listRate).toBe(0);
    expect(p.fiscalYear).toBe("FY27");
  });
});

describe("buildFlatProducts", () => {
  it("drops excluded rows", () => {
    const rows = [
      { Name: "Allocation", SKU: "268084859150", Category: "", Price: "0.0" },
      { Name: "Homebound 1:1", SKU: "BOC27-HB11", Category: "FY27 BOCES Pricing", Price: "53.06" },
    ];
    const out = buildFlatProducts(rows);
    expect(out).toHaveLength(1);
    expect(out[0].sku).toBe("BOC27-HB11");
  });
});

describe("buildVolumeProducts", () => {
  it("groups tiers per SKU, ascending by minQty", () => {
    const rows = [
      { Name: "Tier 1", SKU: "EK12-T1", Category: "FY27 EK12 Pricebook", "Tier Quantity Min": "2", Price: "5035.0" },
      { Name: "Tier 1", SKU: "EK12-T1", Category: "FY27 EK12 Pricebook", "Tier Quantity Min": "1", Price: "2641.0" },
    ];
    const out = buildVolumeProducts(rows);
    expect(out).toHaveLength(1);
    expect(out[0]).toMatchObject({ sku: "EK12-T1", fiscalYear: "FY27" });
    expect(out[0].tiers).toEqual([
      { minQty: 1, price: 2641 },
      { minQty: 2, price: 5035 },
    ]);
  });
});
