import { describe, it, expect } from "vitest";
import { parseRssXml, buildGoogleNewsRssUrl } from "../rss";

const RSS_20 = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <title>Chalkbeat</title>
    <item>
      <title>A big education story</title>
      <link>https://www.chalkbeat.org/2026/04/22/a-story</link>
      <description>Summary of the story</description>
      <pubDate>Tue, 22 Apr 2026 14:00:00 +0000</pubDate>
      <dc:creator xmlns:dc="http://purl.org/dc/elements/1.1/">Jane Writer</dc:creator>
    </item>
    <item>
      <title>Another story - MaxPreps</title>
      <link>https://www.maxpreps.com/high-schools/article</link>
      <pubDate>Tue, 22 Apr 2026 10:00:00 +0000</pubDate>
    </item>
  </channel>
</rss>`;

const ATOM = `<?xml version="1.0"?>
<feed xmlns="http://www.w3.org/2005/Atom">
  <entry>
    <title>Atom story</title>
    <link href="https://example.com/atom-story"/>
    <published>2026-04-22T12:00:00Z</published>
    <author><name>A. Author</name></author>
  </entry>
</feed>`;

const GOOGLE_NEWS = `<?xml version="1.0"?>
<rss version="2.0">
  <channel>
    <item>
      <title>Chicago Public Schools declare May 1 a day of civil action - Fox News</title>
      <link>https://news.google.com/rss/articles/ABCDEF123</link>
      <source url="https://www.foxnews.com">Fox News</source>
      <pubDate>Mon, 20 Apr 2026 00:00:35 +0000</pubDate>
    </item>
  </channel>
</rss>`;

describe("parseRssXml", () => {
  it("parses RSS 2.0 items and drops excluded domains", () => {
    const out = parseRssXml(RSS_20, "chalkbeat.org");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("A big education story");
    expect(out[0].url).toBe("https://www.chalkbeat.org/2026/04/22/a-story");
    expect(out[0].author).toBe("Jane Writer");
    expect(out[0].publishedAt.toISOString()).toBe("2026-04-22T14:00:00.000Z");
  });

  it("parses Atom entries", () => {
    const out = parseRssXml(ATOM, "example.com");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Atom story");
    expect(out[0].url).toBe("https://example.com/atom-story");
    expect(out[0].author).toBe("A. Author");
  });

  it("strips the ' - {source}' suffix in Google News titles", () => {
    const out = parseRssXml(GOOGLE_NEWS, "news.google.com");
    expect(out).toHaveLength(1);
    expect(out[0].title).toBe("Chicago Public Schools declare May 1 a day of civil action");
    expect(out[0].source).toBe("Fox News");
    // Preserves Google News redirect URL — stable identifier for hashing
    expect(out[0].url).toBe("https://news.google.com/rss/articles/ABCDEF123");
  });

  it("returns empty on malformed xml", () => {
    expect(parseRssXml("<not xml", "x")).toEqual([]);
  });
});

describe("buildGoogleNewsRssUrl", () => {
  it("URL-encodes the query and sets locale params", () => {
    const url = buildGoogleNewsRssUrl('"Chicago Public Schools" budget');
    expect(url).toContain("news.google.com/rss/search");
    expect(url).toContain("hl=en-US");
    expect(url).toContain("gl=US");
    expect(url).toContain("ceid=US%3Aen");
    expect(url).toMatch(/q=%22Chicago\+Public\+Schools%22\+budget/);
  });
});
