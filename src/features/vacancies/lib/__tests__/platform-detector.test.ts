import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  detectPlatform,
  isStatewideBoard,
  isStatewideBoardAsync,
  normalizeJobBoardKey,
  __resetSharedBoardsCache,
} from "../platform-detector";

const mockFindMany = vi.fn();
vi.mock("@/lib/prisma", () => ({
  default: {
    district: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
    },
  },
}));

beforeEach(() => {
  mockFindMany.mockReset();
  mockFindMany.mockResolvedValue([]);
  __resetSharedBoardsCache();
});

describe("detectPlatform", () => {
  describe("known platforms", () => {
    it("detects applitrack.com", () => {
      expect(detectPlatform("https://www.applitrack.com/some-district/onlineapp")).toBe("applitrack");
    });

    it("detects subdomain.applitrack.com", () => {
      expect(detectPlatform("https://springfield.applitrack.com/onlineapp/default.aspx")).toBe("applitrack");
    });

    it("detects olasjobs.org", () => {
      expect(detectPlatform("https://pa.olasjobs.org/posts/12345")).toBe("olas");
    });

    it("detects subdomain.olasjobs.org", () => {
      expect(detectPlatform("https://nj.olasjobs.org/posts/67890")).toBe("olas");
    });

    it("detects schoolspring.com", () => {
      expect(detectPlatform("https://www.schoolspring.com/job/123")).toBe("schoolspring");
    });

    it("detects subdomain.schoolspring.com", () => {
      expect(detectPlatform("https://jobs.schoolspring.com/listings/456")).toBe("schoolspring");
    });

    it("detects tedk12.com as schoolspring (TalentEd K12 redirects to SchoolSpring)", () => {
      expect(detectPlatform("https://roswellnm.tedk12.com/hire/index.aspx")).toBe("schoolspring");
    });

    it("detects subdomain.tedk12.com as schoolspring", () => {
      expect(detectPlatform("https://springfield.tedk12.com/hire/")).toBe("schoolspring");
    });
  });

  describe("unknown platforms", () => {
    it('returns "unknown" for indeed.com', () => {
      expect(detectPlatform("https://www.indeed.com/job/teacher-123")).toBe("unknown");
    });

    it('returns "unknown" for generic URLs', () => {
      expect(detectPlatform("https://example.com/careers")).toBe("unknown");
    });

    it('returns "unknown" for district websites', () => {
      expect(detectPlatform("https://www.springfield-schools.org/employment")).toBe("unknown");
    });
  });

  describe("URLs with paths and query strings", () => {
    it("detects platform from URL with deep path", () => {
      expect(
        detectPlatform("https://www.applitrack.com/district/onlineapp/default.aspx?Category=Teaching")
      ).toBe("applitrack");
    });

    it("detects platform from URL with query parameters", () => {
      expect(
        detectPlatform("https://pa.olasjobs.org/posts?page=2&category=sped")
      ).toBe("olas");
    });

    it("detects platform from URL with fragment", () => {
      expect(
        detectPlatform("https://jobs.schoolspring.com/listing/456#details")
      ).toBe("schoolspring");
    });
  });

  describe("case insensitivity", () => {
    it("handles uppercase domain", () => {
      expect(detectPlatform("https://WWW.APPLITRACK.COM/jobs")).toBe("applitrack");
    });

    it("handles mixed-case domain", () => {
      expect(detectPlatform("https://Jobs.SchoolSpring.COM/listing")).toBe("schoolspring");
    });
  });

  describe("invalid URLs", () => {
    it('returns "unknown" for empty string', () => {
      expect(detectPlatform("")).toBe("unknown");
    });

    it('returns "unknown" for a non-URL string', () => {
      expect(detectPlatform("not a url at all")).toBe("unknown");
    });

    it('returns "unknown" for a malformed URL', () => {
      expect(detectPlatform("://missing-scheme.com")).toBe("unknown");
    });

    it('returns "unknown" for a bare domain with no scheme', () => {
      expect(detectPlatform("applitrack.com/jobs")).toBe("unknown");
    });
  });
});

describe("normalizeJobBoardKey", () => {
  it("lowercases origin and path", () => {
    expect(normalizeJobBoardKey("https://IOWA.SchoolSpring.com/JOBS")).toBe(
      "https://iowa.schoolspring.com/jobs"
    );
  });

  it("strips trailing slash", () => {
    expect(normalizeJobBoardKey("https://www.applitrack.com/nesdec/onlineapp/")).toBe(
      "https://www.applitrack.com/nesdec/onlineapp"
    );
  });

  it("ignores query string and fragment", () => {
    expect(normalizeJobBoardKey("https://www.schoolspring.com/search?q=sped#top")).toBe(
      "https://www.schoolspring.com/search"
    );
  });

  it("returns root origin for bare domain", () => {
    expect(normalizeJobBoardKey("https://iowa.schoolspring.com/")).toBe(
      "https://iowa.schoolspring.com"
    );
  });

  it("returns null for invalid URL", () => {
    expect(normalizeJobBoardKey("not a url")).toBeNull();
  });

  it("returns null for empty string", () => {
    expect(normalizeJobBoardKey("")).toBeNull();
  });
});

describe("isStatewideBoard (sync)", () => {
  it("returns false when no URL is provided", () => {
    expect(isStatewideBoard("olas")).toBe(false);
    expect(isStatewideBoard("schoolspring")).toBe(false);
    expect(isStatewideBoard("applitrack")).toBe(false);
    expect(isStatewideBoard("unknown")).toBe(false);
  });

  it("returns false before the shared-boards cache is loaded", () => {
    expect(isStatewideBoard("schoolspring", "https://iowa.schoolspring.com/")).toBe(false);
  });

  it("returns true after cache is loaded for a URL shared by 2+ districts", async () => {
    mockFindMany.mockResolvedValue([
      { jobBoardUrl: "https://iowa.schoolspring.com/" },
      { jobBoardUrl: "https://iowa.schoolspring.com/" },
      { jobBoardUrl: "https://joplin.schoolspring.com/" },
    ]);
    await isStatewideBoardAsync("schoolspring", "https://iowa.schoolspring.com/"); // warms cache
    expect(isStatewideBoard("schoolspring", "https://iowa.schoolspring.com/")).toBe(true);
    expect(isStatewideBoard("schoolspring", "https://joplin.schoolspring.com/")).toBe(false);
  });
});

describe("isStatewideBoardAsync", () => {
  it("returns true for a URL shared by 2+ districts", async () => {
    mockFindMany.mockResolvedValue([
      { jobBoardUrl: "https://iowa.schoolspring.com/" },
      { jobBoardUrl: "https://iowa.schoolspring.com/" },
    ]);
    expect(await isStatewideBoardAsync("schoolspring", "https://iowa.schoolspring.com/")).toBe(true);
  });

  it("returns false for single-district schoolspring subdomain", async () => {
    // Verifies the fix: richmondmo.tedk12.com was previously mis-classified as statewide
    mockFindMany.mockResolvedValue([
      { jobBoardUrl: "https://richmondmo.tedk12.com/hire/index.aspx" },
      { jobBoardUrl: "https://other.tedk12.com/hire/index.aspx" },
    ]);
    expect(
      await isStatewideBoardAsync("schoolspring", "https://richmondmo.tedk12.com/hire/index.aspx")
    ).toBe(false);
  });

  it("returns false for single-district olas URL", async () => {
    mockFindMany.mockResolvedValue([
      { jobBoardUrl: "https://onedistrict.olasjobs.org/" },
    ]);
    expect(await isStatewideBoardAsync("olas", "https://onedistrict.olasjobs.org/")).toBe(false);
  });

  it("returns true for shared applitrack instance URL", async () => {
    mockFindMany.mockResolvedValue([
      { jobBoardUrl: "https://www.applitrack.com/nesdec/onlineapp/" },
      { jobBoardUrl: "https://www.applitrack.com/nesdec/onlineapp/" },
    ]);
    expect(
      await isStatewideBoardAsync("applitrack", "https://www.applitrack.com/nesdec/onlineapp/")
    ).toBe(true);
  });

  it("normalizes URL case and trailing slash when matching cache", async () => {
    mockFindMany.mockResolvedValue([
      { jobBoardUrl: "https://www.applitrack.com/nesdec/onlineapp/" },
      { jobBoardUrl: "https://www.applitrack.com/nesdec/onlineapp/" },
    ]);
    expect(
      await isStatewideBoardAsync("applitrack", "https://WWW.applitrack.com/NESDEC/onlineapp")
    ).toBe(true);
  });

  it("returns false without URL", async () => {
    expect(await isStatewideBoardAsync("schoolspring")).toBe(false);
    expect(await isStatewideBoardAsync("olas")).toBe(false);
  });

  it("returns false for invalid URL", async () => {
    expect(await isStatewideBoardAsync("schoolspring", "not a url")).toBe(false);
  });
});
