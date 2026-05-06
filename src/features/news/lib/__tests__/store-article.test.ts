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

  // Use relative recent dates so tests don't rot once "today" drifts past
  // the MAX_ARTICLE_AGE_DAYS cutoff defined in config.
  const recent = () => new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

  it("returns existing article when URL hash matches", async () => {
    const publishedAt = recent();
    const existing: ArticleFixture = { id: "a1", title: "t", publishedAt };
    mockPrisma.newsArticle.findUnique.mockResolvedValueOnce(existing);
    const result = await upsertArticle(
      {
        url: "https://a.com/x",
        title: "t",
        source: "a.com",
        publishedAt,
      },
      "feed"
    );
    expect("skipped" in result).toBe(false);
    if ("skipped" in result) return;
    expect(result.isNew).toBe(false);
    expect(result.article.id).toBe("a1");
    expect(mockPrisma.newsArticle.findFirst).not.toHaveBeenCalled();
  });

  it("returns existing article when title matches and publish dates within 24h", async () => {
    const earlier = recent();
    const later = new Date(earlier.getTime() + 12 * 60 * 60 * 1000);
    mockPrisma.newsArticle.findUnique.mockResolvedValueOnce(null);
    mockPrisma.newsArticle.findFirst.mockResolvedValueOnce({
      id: "a2",
      title: "Big story about schools",
      publishedAt: earlier,
    });
    const result = await upsertArticle(
      {
        url: "https://b.com/y",
        title: "Big story about schools",
        source: "b.com",
        publishedAt: later,
      },
      "feed"
    );
    expect("skipped" in result).toBe(false);
    if ("skipped" in result) return;
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
        publishedAt: recent(),
      },
      "feed"
    );
    expect("skipped" in result).toBe(false);
    if ("skipped" in result) return;
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
        publishedAt: recent(),
      },
      "feed"
    );
    expect("skipped" in result).toBe(false);
    if ("skipped" in result) return;
    expect(result.isNew).toBe(false);
    const findFirstCall = mockPrisma.newsArticle.findFirst.mock.calls[0][0];
    expect(findFirstCall.where.title).toBe("Clean headline");
  });
});

describe("upsertArticle stale-age guard", () => {
  const mockPrisma = prisma as unknown as {
    newsArticle: {
      findUnique: ReturnType<typeof vi.fn>;
      findFirst: ReturnType<typeof vi.fn>;
      create: ReturnType<typeof vi.fn>;
    };
  };

  it("skips articles older than the cutoff without touching the DB", async () => {
    mockPrisma.newsArticle.findUnique.mockReset();
    mockPrisma.newsArticle.findFirst.mockReset();
    mockPrisma.newsArticle.create.mockReset();

    const oldPublishedAt = new Date(Date.now() - 181 * 24 * 60 * 60 * 1000);
    const result = await upsertArticle(
      {
        url: "https://stale.com/x",
        title: "Ancient news",
        source: "stale.com",
        publishedAt: oldPublishedAt,
      },
      "feed"
    );

    expect("skipped" in result && result.skipped).toBe("stale");
    expect(mockPrisma.newsArticle.findUnique).not.toHaveBeenCalled();
    expect(mockPrisma.newsArticle.findFirst).not.toHaveBeenCalled();
    expect(mockPrisma.newsArticle.create).not.toHaveBeenCalled();
  });

  it("admits articles inside the cutoff window", async () => {
    mockPrisma.newsArticle.findUnique.mockReset().mockResolvedValueOnce(null);
    mockPrisma.newsArticle.findFirst.mockReset().mockResolvedValueOnce(null);
    mockPrisma.newsArticle.create.mockReset().mockResolvedValueOnce({
      id: "fresh1",
      title: "Fresh news",
      publishedAt: new Date(),
    });

    const recentPublishedAt = new Date(Date.now() - 30 * 24 * 60 * 60 * 1000);
    const result = await upsertArticle(
      {
        url: "https://fresh.com/y",
        title: "Fresh news",
        source: "fresh.com",
        publishedAt: recentPublishedAt,
      },
      "feed"
    );

    expect("skipped" in result).toBe(false);
    expect(mockPrisma.newsArticle.create).toHaveBeenCalled();
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
