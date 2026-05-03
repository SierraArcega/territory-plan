import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { resolveSchoolSpringSource } from "../schoolspring";

describe("resolveSchoolSpringSource", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("returns the hostname directly when URL is already on a per-employer subdomain", async () => {
    const result = await resolveSchoolSpringSource(
      "https://brimfieldma.schoolspring.com/jobs"
    );
    expect(result).toEqual({ hostname: "brimfieldma.schoolspring.com" });
  });

  it("follows redirects from alias domains to the per-employer subdomain", async () => {
    const fetchMock = vi.fn(async () => ({
      headers: {
        get: (name: string) =>
          name.toLowerCase() === "location"
            ? "https://brimfieldma.schoolspring.com/jobs"
            : null,
      },
    }));
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSchoolSpringSource(
      "https://brimfield.tedk12.com/jobs"
    );

    expect(result).toEqual({ hostname: "brimfieldma.schoolspring.com" });
    expect(fetchMock).toHaveBeenCalledTimes(1);
    const firstCall = fetchMock.mock.calls[0] as unknown as [string, RequestInit];
    expect(firstCall[0]).toBe("https://brimfield.tedk12.com/jobs");
    expect(firstCall[1]).toMatchObject({ method: "HEAD", redirect: "manual" });
  });

  it("recovers via HTML discovery probe — finds per-employer subdomain in iframe response", async () => {
    const fetchMock = vi.fn(async (calledUrl: string) => {
      if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
        return {
          ok: true,
          text: async () =>
            `<html><body><script src="https://brimfieldma.schoolspring.com/static/x.js"></script></body></html>`,
          headers: { get: () => null },
        };
      }
      throw new Error(`Unexpected fetch: ${calledUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSchoolSpringSource(
      "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
    );

    expect(result).toEqual({ hostname: "brimfieldma.schoolspring.com" });
  });

  it("recovers via API organization-filter probe when discovery returns nothing useful", async () => {
    const fetchMock = vi.fn(async (calledUrl: string) => {
      if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
        // Discovery probe — empty body, no usable subdomain.
        return {
          ok: true,
          text: async () => "<html><body>no useful info</body></html>",
          headers: { get: () => null },
        };
      }
      if (calledUrl.startsWith("https://api.schoolspring.com/")) {
        // API probe — single distinct employer name → filter is honored.
        return {
          ok: true,
          json: async () => ({
            success: true,
            value: {
              page: 1,
              size: 1,
              jobsList: [
                { jobId: 1, employer: "Brimfield MA", title: "T", location: "Brimfield, MA", displayDate: "2026-04-28" },
              ],
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${calledUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSchoolSpringSource(
      "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
    );

    expect(result).toEqual({
      hostname: "www.schoolspring.com",
      organizationFilter: "19502",
    });
  });

  it("returns null when www.schoolspring.com URL has no employer query param", async () => {
    const fetchMock = vi.fn();
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSchoolSpringSource(
      "https://www.schoolspring.com/jobs/"
    );

    expect(result).toBeNull();
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("returns null when API probe response shows mixed employers (filter ignored)", async () => {
    const fetchMock = vi.fn(async (calledUrl: string) => {
      if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
        return {
          ok: true,
          text: async () => "<html><body>no useful info</body></html>",
          headers: { get: () => null },
        };
      }
      if (calledUrl.startsWith("https://api.schoolspring.com/")) {
        return {
          ok: true,
          json: async () => ({
            success: true,
            value: {
              page: 1,
              size: 5,
              jobsList: [
                { jobId: 1, employer: "Fresno Unified", title: "T1", location: "Fresno, CA", displayDate: "2026-04-28" },
                { jobId: 2, employer: "San Jose Unified", title: "T2", location: "San Jose, CA", displayDate: "2026-04-28" },
                { jobId: 3, employer: "Monroe County", title: "T3", location: "Monroe, NC", displayDate: "2026-04-28" },
              ],
            },
          }),
        };
      }
      throw new Error(`Unexpected fetch: ${calledUrl}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const result = await resolveSchoolSpringSource(
      "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
    );

    expect(result).toBeNull();
  });

  it("parseSchoolSpring includes organization filter in paged API URLs when present", async () => {
    const apiCalls: string[] = [];
    const fetchMock = vi.fn(async (calledUrl: string) => {
      if (calledUrl.startsWith("https://www.schoolspring.com/jobs/")) {
        // Discovery returns nothing useful → forces API filter probe.
        return {
          ok: true,
          text: async () => "<html></html>",
          headers: { get: () => null },
        };
      }
      apiCalls.push(calledUrl);
      return {
        ok: true,
        json: async () => ({
          success: true,
          value: {
            page: 1,
            size: 1,
            jobsList: [
              { jobId: 7, employer: "Brimfield MA", title: "Math Teacher", location: "Brimfield, MA", displayDate: "2026-04-28" },
            ],
          },
        }),
      };
    });
    vi.stubGlobal("fetch", fetchMock);

    // parseSchoolSpring is the public entry point.
    const { parseSchoolSpring } = await import("../schoolspring");
    const out = await parseSchoolSpring(
      "https://www.schoolspring.com/jobs/?iframe=1&employer=19502"
    );

    expect(out.length).toBeGreaterThan(0);
    // Every API call after the probe must include &organization=19502
    const pagedCalls = apiCalls.filter((u) => u.includes("page="));
    expect(pagedCalls.length).toBeGreaterThan(0);
    for (const u of pagedCalls) {
      expect(u).toContain("organization=19502");
    }
  });
});
