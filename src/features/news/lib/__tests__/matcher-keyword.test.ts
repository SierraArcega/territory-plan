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

describe("matchArticleKeyword", () => {
  it("matches a district by full name scoped to its state", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("GA", [
      { leaid: "1301200", name: "Cobb County School District", stateAbbrev: "GA" },
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
  });

  it("matches by acronym when state is confirmed", () => {
    // DISTRICT_ACRONYMS includes CPS → IL
    const result = matchArticleKeyword(
      makeInput({
        articleText: "CPS teachers will strike Monday.",
        stateAbbrevs: ["IL"],
      })
    );
    expect(result.confirmedDistricts[0]?.leaid).toBe("1709930");
  });

  it("does NOT match acronym when state is wrong", () => {
    const result = matchArticleKeyword(
      makeInput({
        articleText: "CPS teachers will strike Monday.",
        stateAbbrevs: ["CA"],
      })
    );
    expect(result.confirmedDistricts).toHaveLength(0);
  });

  it("only matches a contact when a role keyword co-occurs", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("IL", [
      { leaid: "1709930", name: "Chicago Public Schools", stateAbbrev: "IL" },
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

  it("matches a school only when its parent district is also matched", () => {
    const districtsByState = new Map<string, DistrictCandidate[]>();
    districtsByState.set("IL", [
      { leaid: "1709930", name: "Chicago Public Schools", stateAbbrev: "IL" },
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
