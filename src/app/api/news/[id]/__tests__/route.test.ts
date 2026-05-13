import { describe, it, expect, vi, beforeEach } from "vitest";
import { NextRequest } from "next/server";

const mockGetUser = vi.fn();
vi.mock("@/lib/supabase/server", () => ({
  getUser: (...args: unknown[]) => mockGetUser(...args),
}));

vi.mock("@/lib/prisma", () => ({
  default: {
    newsArticle: {
      findUnique: vi.fn(),
    },
  },
}));

import prisma from "@/lib/prisma";
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const mockPrisma = vi.mocked(prisma) as any;

import { GET } from "../route";

function makeRequest() {
  return new NextRequest(
    new URL("/api/news/article-1", "http://localhost:3000"),
    { method: "GET" } as never,
  );
}

beforeEach(() => {
  vi.clearAllMocks();
});

describe("GET /api/news/[id]", () => {
  it("returns 401 when not authenticated", async () => {
    mockGetUser.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "article-1" }),
    });
    expect(res.status).toBe(401);
  });

  it("returns 404 when article does not exist", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.newsArticle.findUnique.mockResolvedValue(null);
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "article-1" }),
    });
    expect(res.status).toBe(404);
  });

  it("returns article with matched districts + contacts", async () => {
    mockGetUser.mockResolvedValue({ id: "u1" });
    mockPrisma.newsArticle.findUnique.mockResolvedValue({
      id: "article-1",
      url: "https://example.com/x",
      title: "Big bond approved",
      description: "...",
      content: "full body text",
      imageUrl: null,
      author: null,
      source: "Example News",
      feedSource: "rss",
      publishedAt: new Date("2026-05-10"),
      fetchedAt: new Date("2026-05-11"),
      stateAbbrevs: ["NY"],
      categories: ["Funding"],
      fullmindRelevance: "high",
      classifiedAt: null,
      matchedAt: null,
      districts: [
        {
          confidence: "high",
          district: { leaid: "3601001", name: "Albany City SD", stateAbbrev: "NY" },
        },
      ],
      contacts: [],
    });
    const res = await GET(makeRequest(), {
      params: Promise.resolve({ id: "article-1" }),
    });
    const data = await res.json();
    expect(res.status).toBe(200);
    expect(data.id).toBe("article-1");
    expect(data.content).toBe("full body text");
    expect(data.districts).toHaveLength(1);
    expect(data.districts[0].name).toBe("Albany City SD");
  });
});
