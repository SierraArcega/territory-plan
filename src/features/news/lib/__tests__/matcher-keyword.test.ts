import { describe, it, expect } from "vitest";
import {
  matchArticleKeyword,
  type DistrictCandidate,
  type SchoolCandidate,
  type ContactCandidate,
} from "../matcher-keyword";

function makeInput(override: Partial<Parameters<typeof matchArticleKeyword>[0]> = {}) {
  const districtsByState = new Map<string, DistrictCandidate[]>();
  const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
  const contactsByLeaid = new Map<string, ContactCandidate[]>();
  return {
    articleText: "",
    stateAbbrevs: [],
    districtsByState,
    schoolsByLeaid,
    contactsByLeaid,
    ...override,
  };
}

describe("matchArticleKeyword — Tier 1 auto-confirm", () => {
  it("auto-confirms a district by full-name literal scoped to its state", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("GA", [
      { leaid: "1301200", name: "Cobb County School District", stateAbbrev: "GA", cityLocation: null, countyName: "Cobb County", accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "Cobb County School District superintendent resigned.",
        stateAbbrevs: ["GA"],
        districtsByState,
      })
    );
    expect(result.confirmedDistricts).toHaveLength(1);
    expect(result.confirmedDistricts[0].leaid).toBe("1301200");
    expect(result.ambiguous).toHaveLength(0);
  });

  it("auto-confirms by acronym when state is confirmed", () => {
    const result = matchArticleKeyword(
      makeInput({
        articleText: "CPS teachers will strike Monday.",
        stateAbbrevs: ["IL"],
      })
    );
    expect(result.confirmedDistricts[0]?.leaid).toBe("1709930");
  });

  it("does NOT auto-confirm acronym when state is wrong", () => {
    const result = matchArticleKeyword(
      makeInput({
        articleText: "CPS teachers will strike Monday.",
        stateAbbrevs: ["CA"],
      })
    );
    expect(result.confirmedDistricts).toHaveLength(0);
  });

  it("auto-confirms contact only when district confirmed AND role keyword present", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("IL", [
      { leaid: "1709930", name: "Chicago Public Schools", stateAbbrev: "IL", cityLocation: "Chicago", countyName: "Cook County", accountName: null },
    ]);
    const contactsByLeaid = new Map<string, ContactCandidate[]>();
    contactsByLeaid.set("1709930", [
      { id: 1, leaid: "1709930", name: "Pedro Martinez", title: "Superintendent" },
    ]);

    const withRole = matchArticleKeyword(
      makeInput({
        articleText: "Chicago Public Schools superintendent Pedro Martinez resigned.",
        stateAbbrevs: ["IL"],
        districtsByState,
        contactsByLeaid,
      })
    );
    expect(withRole.confirmedContacts).toHaveLength(1);

    const withoutRole = matchArticleKeyword(
      makeInput({
        articleText: "Chicago Public Schools and Pedro Martinez hit a home run.",
        stateAbbrevs: ["IL"],
        districtsByState,
        contactsByLeaid,
      })
    );
    expect(withoutRole.confirmedContacts).toHaveLength(0);
  });

  it("auto-confirms school only when parent district is confirmed", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("IL", [
      { leaid: "1709930", name: "Chicago Public Schools", stateAbbrev: "IL", cityLocation: "Chicago", countyName: "Cook County", accountName: null },
    ]);
    const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
    schoolsByLeaid.set("1709930", [
      { ncessch: "170993000001", leaid: "1709930", schoolName: "Lane Tech" },
    ]);

    const result = matchArticleKeyword(
      makeInput({
        articleText: "Chicago Public Schools closed Lane Tech for the day.",
        stateAbbrevs: ["IL"],
        districtsByState,
        schoolsByLeaid,
      })
    );
    expect(result.confirmedSchools).toHaveLength(1);
  });
});

describe("matchArticleKeyword — Tier 1 city+context auto-confirm", () => {
  it("auto-confirms when article mentions city + school district context", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("CA", [
      { leaid: "0611111", name: "Lincoln Unified", stateAbbrev: "CA", cityLocation: "Stockton", countyName: "San Joaquin County", accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "Stockton school district passes a bond for new facilities.",
        stateAbbrevs: ["CA"],
        districtsByState,
      })
    );
    expect(result.confirmedDistricts).toHaveLength(1);
    expect(result.confirmedDistricts[0].leaid).toBe("0611111");
  });

  it("does NOT auto-confirm on city alone without district context", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("CA", [
      { leaid: "0611111", name: "Lincoln Unified", stateAbbrev: "CA", cityLocation: "Stockton", countyName: "San Joaquin County", accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "The Stockton Kings won their playoff game last night.",
        stateAbbrevs: ["CA"],
        districtsByState,
      })
    );
    expect(result.confirmedDistricts).toHaveLength(0);
  });

  it("skips city-match auto-confirm when multiple districts share the same city", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("CA", [
      { leaid: "0611111", name: "Lincoln Unified", stateAbbrev: "CA", cityLocation: "Stockton", countyName: "San Joaquin County", accountName: null },
      { leaid: "0622222", name: "Stockton Unified School District", stateAbbrev: "CA", cityLocation: "Stockton", countyName: "San Joaquin County", accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "A Stockton school district passes a bond.",
        stateAbbrevs: ["CA"],
        districtsByState,
      })
    );
    // Two districts share Stockton; city-rule does NOT auto-confirm either.
    // Neither full name appears literally. Ambiguous — should be empty.
    expect(result.confirmedDistricts).toHaveLength(0);
  });
});

describe("matchArticleKeyword — false-positive guards", () => {
  it("does NOT match Vernon (CT) inside 'Mount Vernon'", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("CT", [
      { leaid: "0999999", name: "Vernon School District", stateAbbrev: "CT", cityLocation: "Vernon", countyName: null, accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "Mount Vernon City School District proposes $276 million budget with tax increase",
        stateAbbrevs: ["CT"],
        districtsByState,
      })
    );
    expect(result.confirmedDistricts).toHaveLength(0);
  });

  it("does NOT school-first-match on generic names like 'Illinois School'", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("IL", [
      { leaid: "1725020", name: "Matteson Elementary School District 162", stateAbbrev: "IL", cityLocation: "Richton Park", countyName: "Cook County", accountName: null },
    ]);
    const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
    schoolsByLeaid.set("1725020", [
      { ncessch: "170993000001", leaid: "1725020", schoolName: "Illinois School" },
      { ncessch: "170993000002", leaid: "1725020", schoolName: "Arcadia Elem School" },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "28 Illinois schools receive state Blue Ribbon Schools award",
        stateAbbrevs: ["IL"],
        districtsByState,
        schoolsByLeaid,
      })
    );
    expect(result.confirmedDistricts).toHaveLength(0);
  });

  it("still school-first-matches on distinctive names like 'Arcadia Elem School'", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("IL", [
      { leaid: "1725020", name: "Matteson Elementary School District 162", stateAbbrev: "IL", cityLocation: "Richton Park", countyName: "Cook County", accountName: null },
    ]);
    const schoolsByLeaid = new Map<string, SchoolCandidate[]>();
    schoolsByLeaid.set("1725020", [
      { ncessch: "170993000002", leaid: "1725020", schoolName: "Arcadia Elem School" },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "Arcadia Elem School celebrates Blue Ribbon award",
        stateAbbrevs: ["IL"],
        districtsByState,
        schoolsByLeaid,
      })
    );
    expect(result.confirmedDistricts).toHaveLength(1);
    expect(result.confirmedDistricts[0].leaid).toBe("1725020");
  });
});

describe("matchArticleKeyword — Tier 2 LLM queue", () => {
  it("does NOT auto-confirm on core-name-only substring hits (York trap)", () => {
    // "York Central School District" → core "york" — appears in "New York"
    // whenever the article mentions NY. Must go to LLM queue, not auto-confirm.
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("NY", [
      { leaid: "3636310", name: "York Central School District", stateAbbrev: "NY", cityLocation: "Retsof", countyName: "Livingston County", accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "In New York schools, enrollment dropped this year.",
        stateAbbrevs: ["NY"],
        districtsByState,
      })
    );
    expect(result.confirmedDistricts).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].districtCandidates?.[0].leaid).toBe("3636310");
  });

  it("queues partial matches for LLM when core appears in multiple states", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("CA", [
      { leaid: "0611111", name: "Lincoln Unified", stateAbbrev: "CA", cityLocation: "Stockton", countyName: "San Joaquin County", accountName: null },
    ]);
    districtsByState.set("NE", [
      { leaid: "3122222", name: "Lincoln Public Schools", stateAbbrev: "NE", cityLocation: "Lincoln", countyName: "Lancaster County", accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "Lincoln schools are adopting a new curriculum. Officials in California and Nebraska weighed in.",
        stateAbbrevs: ["CA", "NE"],
        districtsByState,
      })
    );
    // "Lincoln" core hits both — neither full name is present — both queued
    expect(result.confirmedDistricts).toHaveLength(0);
    expect(result.ambiguous).toHaveLength(1);
    expect(result.ambiguous[0].districtCandidates).toHaveLength(2);
  });

  it("still queues even when full-name of one district IS present (other is ambiguous)", () => {
    // Full-name for Lincoln Public Schools (NE) present → auto-confirm NE.
    // Core "lincoln" also in CA — but CA doesn't have a full-name literal, so
    // CA stays queued for LLM to judge whether the article is about CA too.
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("CA", [
      { leaid: "0611111", name: "Lincoln Unified", stateAbbrev: "CA", cityLocation: "Stockton", countyName: "San Joaquin County", accountName: null },
    ]);
    districtsByState.set("NE", [
      { leaid: "3122222", name: "Lincoln Public Schools", stateAbbrev: "NE", cityLocation: "Lincoln", countyName: "Lancaster County", accountName: null },
    ]);
    const result = matchArticleKeyword(
      makeInput({
        articleText: "Lincoln Public Schools and Lincoln officials across California met.",
        stateAbbrevs: ["CA", "NE"],
        districtsByState,
      })
    );
    expect(result.confirmedDistricts.map((d) => d.leaid)).toEqual(["3122222"]);
    expect(result.ambiguous.length).toBe(1);
    expect(result.ambiguous[0].districtCandidates?.[0].leaid).toBe("0611111");
  });
});
