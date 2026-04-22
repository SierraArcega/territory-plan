import { describe, it, expect, vi } from "vitest";
import { hashUrl, normalizeUrl, upsertArticle } from "../store-article";
import { prisma } from "@/lib/prisma";

vi.mock("@/lib/prisma", () => {
  const fn = vi.fn;
  return {
    prisma: {
      newsArticle: {
        findUnique: fn(),
        findFirst: fn(),
        create: fn(),
      },
    },
  };
});

describe("normalizeUrl", () => {
  it("strips utm_* params", () => {
    expect(normalizeUrl("https://a.com/p?utm_source=x&utm_medium=y&id=1")).toBe(
      "https://a.com/p?id=1"
    );
  });

  it("strips fbclid and gclid", () => {
    expect(normalizeUrl("https://a.com/p?fbclid=abc&gclid=xyz&id=1")).toBe(
      "https://a.com/p?id=1"
    );
  });

  it("strips the fragment hash", () => {
    expect(normalizeUrl("https://a.com/p?id=1#section")).toBe("https://a.com/p?id=1");
  });

  it("leaves non-tracking params alone", () => {
    expect(normalizeUrl("https://a.com/p?id=1&page=2")).toBe("https://a.com/p?id=1&page=2");
  });

  it("returns input for malformed URLs", () => {
    expect(normalizeUrl("not a url")).toBe("not a url");
  });
});

describe("upsertArticle title-based dedup", () => {
  interface ArticleFixture {
    id: string;
    title: string;
    publishedAt: Date;
  }
  const mockPrisma = prisma as unknown as {
    newsArticle: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };

  it("returns existing article when URL hash matches", async () => {
    const existing: ArticleFixture = { id: "a1", title: "t", publishedAt: new Date("2026-04-01") };
    mockPrisma.newsArticle.findUnique.mockResolvedValueOnce(existing);
    const result = await upsertArticle(
      {
        url: "https://a.com/x",
        title: "t",
        source: "a.com",
        publishedAt: new Date("2026-04-01"),
      },
      "feed"
    );
    expect(result.isNew).toBe(false);
    expect(result.article.id).toBe("a1");
    expect(mockPrisma.newsArticle.findFirst).not.toHaveBeenCalled();
  });

  it("returns existing article when title matches and publish dates within 24h", async () => {
    mockPrisma.newsArticle.findUnique.mockResolvedValueOnce(null);
    mockPrisma.newsArticle.findFirst.mockResolvedValueOnce({
      id: "a2",
      title: "Big story about schools",
      publishedAt: new Date("2026-04-01T10:00:00Z"),
    });
    const result = await upsertArticle(
      {
        url: "https://b.com/y",
        title: "Big story about schools",
        source: "b.com",
        publishedAt: new Date("2026-04-01T22:00:00Z"),
      },
      "feed"
    );
    expect(result.isNew).toBe(false);
    expect(result.article.id).toBe("a2");
    expect(mockPrisma.newsArticle.create).not.toHaveBeenCalled();
  });

  it("creates a new article when no URL or title-window match", async () => {
    mockPrisma.newsArticle.findUnique.mockResolvedValueOnce(null);
    mockPrisma.newsArticle.findFirst.mockResolvedValueOnce(null);
    mockPrisma.newsArticle.create.mockResolvedValueOnce({ id: "a3", title: "x", publishedAt: new Date() });
    const result = await upsertArticle(
      {
        url: "https://c.com/z",
        title: "A brand new headline",
        source: "c.com",
        publishedAt: new Date("2026-04-22"),
      },
      "feed"
    );
    expect(result.isNew).toBe(true);
    expect(mockPrisma.newsArticle.create).toHaveBeenCalled();
  });

  it("strips trailing ' - {publisher}' suffix when normalizing title", async () => {
    mockPrisma.newsArticle.findUnique.mockResolvedValueOnce(null);
    mockPrisma.newsArticle.findFirst.mockResolvedValueOnce({ id: "a4", title: "Clean headline", publishedAt: new Date() });
    const result = await upsertArticle(
      {
        url: "https://d.com/q",
        title: "Clean headline - The Register",
        source: "d.com",
        publishedAt: new Date("2026-04-22"),
      },
      "feed"
    );
    expect(result.isNew).toBe(false);
    // The findFirst call should have been made with normalized title
    const findFirstCall = mockPrisma.newsArticle.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.title).toBe("Clean headline");
  });
});

describe("hashUrl", () => {
  it("produces identical hashes for URLs that differ only in tracking params", () => {
    const a = hashUrl("https://a.com/p?id=1");
    const b = hashUrl("https://a.com/p?id=1&utm_source=newsletter&fbclid=abc");
    expect(a).toBe(b);
  });

  it("produces different hashes for truly different URLs", () => {
    const a = hashUrl("https://a.com/p?id=1");
    const b = hashUrl("https://a.com/p?id=2");
    expect(a).not.toBe(b);
  });

  it("returns a 64-char hex string", () => {
    expect(hashUrl("https://a.com")).toMatch(/^[0-9a-f]{64}$/);
  });
});
