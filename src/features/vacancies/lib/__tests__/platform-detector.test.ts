import { describe, it, expect } from "vitest";
import { detectPlatform, isStatewideBoard } from "../platform-detector";

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

describe("isStatewideBoard", () => {
  it("returns true for olas", () => {
    expect(isStatewideBoard("olas")).toBe(true);
  });

  it("returns true for schoolspring", () => {
    expect(isStatewideBoard("schoolspring")).toBe(true);
  });

  it("returns false for applitrack without URL", () => {
    expect(isStatewideBoard("applitrack")).toBe(false);
  });

  it("returns false for unknown", () => {
    expect(isStatewideBoard("unknown")).toBe(false);
  });
});
