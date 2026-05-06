import { describe, it, expect, vi } from "vitest";

vi.mock("../publisher-states.generated", () => ({
  PUBLISHER_STATES: {
    "MLive.com": "MI",
    "Live 5 News": "SC",
    "Coshocton Tribune": "OH",
  } as Record<string, string>,
}));

import { computeStateAbbrevs } from "../state-hints";

describe("computeStateAbbrevs", () => {
  it("falls back to extractStates when no hints apply", () => {
    const states = computeStateAbbrevs({
      title: "California superintendent resigns",
      description: null,
      publisher: "Some Random Wire",
    });
    expect(states).toEqual(["CA"]);
  });

  it("adds the source-leaid state when text has no state mention", () => {
    const states = computeStateAbbrevs({
      title: "Wilson County Schools announces two finalists",
      description: null,
      publisher: "Some Random Wire",
      sourceLeaidState: "NC",
    });
    expect(states).toEqual(["NC"]);
  });

  it("adds the publisher-map state when text has no state mention", () => {
    const states = computeStateAbbrevs({
      title: "School board approves budget",
      description: null,
      publisher: "MLive.com",
    });
    expect(states).toEqual(["MI"]);
  });

  it("merges all three signals deduplicated and sorted", () => {
    const states = computeStateAbbrevs({
      title: "Michigan school board meeting", // extracts MI
      description: null,
      publisher: "Live 5 News", // → SC
      sourceLeaidState: "OH",
    });
    expect(states).toEqual(["MI", "OH", "SC"]);
  });

  it("doesn't double-count when signals agree", () => {
    const states = computeStateAbbrevs({
      title: "Michigan teachers demand raises",
      description: null,
      publisher: "MLive.com", // → MI
      sourceLeaidState: "MI",
    });
    expect(states).toEqual(["MI"]);
  });

  it("ignores publishers not in the map", () => {
    const states = computeStateAbbrevs({
      title: "School news",
      description: null,
      publisher: "Unknown Publisher 99",
    });
    expect(states).toEqual([]);
  });

  it("includes description in text extraction", () => {
    const states = computeStateAbbrevs({
      title: "School board meeting",
      description: "The Texas commissioner of education weighed in on the dispute.",
      publisher: "Some Random Wire",
    });
    expect(states).toEqual(["TX"]);
  });
});
