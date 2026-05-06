import { describe, it, expect, vi, beforeEach } from "vitest";
import { parseClassificationResult, MAX_KEYWORDS, MAX_KEYWORD_CHARS } from "../classifier";

vi.mock("@/lib/anthropic", () => ({
  HAIKU_MODEL: "claude-haiku-4-5-20251001",
  callClaude: vi.fn(),
  findToolUse: vi.fn(),
}));

const mockFindMany = vi.fn();
const mockUpdate = vi.fn();
vi.mock("@/lib/prisma", () => ({
  prisma: {
    rfp: {
      findMany: (...args: unknown[]) => mockFindMany(...args),
      update: (...args: unknown[]) => mockUpdate(...args),
    },
  },
}));

describe("parseClassificationResult", () => {
  it("returns null for non-object input", () => {
    expect(parseClassificationResult(null)).toBeNull();
    expect(parseClassificationResult(undefined)).toBeNull();
    expect(parseClassificationResult("string")).toBeNull();
    expect(parseClassificationResult(42)).toBeNull();
  });

  it("parses a valid full result", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: ["high-dosage tutoring", "algebra i", "esser"],
      fundingSources: ["esser", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: true,
      requiresW9State: null,
    });

    expect(result).toEqual({
      fullmindRelevance: "high",
      keywords: ["high-dosage tutoring", "algebra i", "esser"],
      fundingSources: ["esser", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: true,
      requiresW9State: null,
    });
  });

  it("falls back to 'none' for invalid relevance tier", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "super_high", // not in enum
      keywords: [],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.fullmindRelevance).toBe("none");
  });

  it("falls back to 'none' for invalid set-aside type", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: [],
      fundingSources: [],
      setAsideType: "extraterrestrial_owned",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.setAsideType).toBe("none");
  });

  it("filters out invalid funding sources", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: [],
      fundingSources: ["esser", "made_up_source", "title_i"],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.fundingSources).toEqual(["esser", "title_i"]);
  });

  it(`truncates keywords beyond MAX_KEYWORDS (${MAX_KEYWORDS})`, () => {
    const tooMany = Array.from({ length: 25 }, (_, i) => `keyword-${i}`);
    const result = parseClassificationResult({
      fullmindRelevance: "medium",
      keywords: tooMany,
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toHaveLength(MAX_KEYWORDS);
    expect(result?.keywords[0]).toBe("keyword-0");
  });

  it("lowercases and trims keywords", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: ["  High-Dosage Tutoring  ", "ALGEBRA I"],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toEqual(["high-dosage tutoring", "algebra i"]);
  });

  it("filters out empty keywords", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: ["valid", "", "  ", "another"],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toEqual(["valid", "another"]);
  });

  it("validates requiresW9State as 2-letter USPS code or null", () => {
    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "TX",
      })?.requiresW9State,
    ).toBe("TX");

    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "Texas", // bad format
      })?.requiresW9State,
    ).toBeNull();

    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: false,
        // omitted entirely
      })?.requiresW9State,
    ).toBeNull();
  });

  it("coerces missing booleans to false", () => {
    const result = parseClassificationResult({
      fullmindRelevance: "low",
      keywords: [],
      fundingSources: [],
      setAsideType: "none",
      // inStateOnly + cooperativeEligible omitted
    });
    expect(result?.inStateOnly).toBe(false);
    expect(result?.cooperativeEligible).toBe(false);
  });

  it("returns null for array input", () => {
    expect(parseClassificationResult(["esser"])).toBeNull();
    expect(parseClassificationResult([])).toBeNull();
  });

  it("normalizes requiresW9State to uppercase", () => {
    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "tx",
      })?.requiresW9State,
    ).toBe("TX");

    expect(
      parseClassificationResult({
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "  Ca  ",
      })?.requiresW9State,
    ).toBe("CA");
  });

  it(`caps each keyword at MAX_KEYWORD_CHARS (${MAX_KEYWORD_CHARS})`, () => {
    const longKeyword = "x".repeat(200);
    const result = parseClassificationResult({
      fullmindRelevance: "high",
      keywords: [longKeyword],
      fundingSources: [],
      setAsideType: "none",
      inStateOnly: false,
      cooperativeEligible: false,
    });
    expect(result?.keywords).toHaveLength(1);
    expect(result?.keywords[0]).toHaveLength(MAX_KEYWORD_CHARS);
  });
});

import { callClaude, findToolUse } from "@/lib/anthropic";
import { classifyOne, classifyUnclassified } from "../classifier";

describe("classifyOne", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RFP_LLM_ENABLED;
  });

  it("returns null when RFP_LLM_ENABLED='false'", async () => {
    process.env.RFP_LLM_ENABLED = "false";
    const result = await classifyOne({
      id: 42,
      title: "Tutoring services",
      description: null,
      aiSummary: null,
    });
    expect(result).toBeNull();
    expect(callClaude).not.toHaveBeenCalled();
  });

  it("calls callClaude with title/description/aiSummary in the user message", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "high",
        keywords: ["tutoring"],
        fundingSources: ["esser"],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: true,
      },
    });

    await classifyOne({
      id: 1,
      title: "K-8 High-Dosage Tutoring RFP",
      description: "Seeking vendors for ESSER-funded math tutoring",
      aiSummary: "K-8 ESSER tutoring",
    });

    expect(callClaude).toHaveBeenCalledOnce();
    const arg = (callClaude as any).mock.calls[0][0];
    expect(arg.userMessage).toContain("K-8 High-Dosage Tutoring RFP");
    expect(arg.userMessage).toContain("Seeking vendors for ESSER-funded math tutoring");
    expect(arg.userMessage).toContain("K-8 ESSER tutoring");
    expect(arg.toolChoice).toEqual({ type: "tool", name: "classify_rfp" });
  });

  it("returns null when no classify_rfp tool use found in response", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue(null);

    const result = await classifyOne({
      id: 1,
      title: "X",
      description: null,
      aiSummary: null,
    });
    expect(result).toBeNull();
  });

  it("parses a successful tool response", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "medium",
        keywords: ["mtss tier 2"],
        fundingSources: ["title_i"],
        setAsideType: "small_business",
        inStateOnly: true,
        cooperativeEligible: false,
        requiresW9State: "CA",
      },
    });

    const result = await classifyOne({
      id: 1,
      title: "MTSS Vendor Pool",
      description: null,
      aiSummary: null,
    });

    expect(result).toEqual({
      fullmindRelevance: "medium",
      keywords: ["mtss tier 2"],
      fundingSources: ["title_i"],
      setAsideType: "small_business",
      inStateOnly: true,
      cooperativeEligible: false,
      requiresW9State: "CA",
    });
  });

  it("truncates description to 800 chars to control prompt cost", async () => {
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "low",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: false,
      },
    });

    const longDesc = "x".repeat(2000);
    await classifyOne({
      id: 1,
      title: "T",
      description: longDesc,
      aiSummary: null,
    });

    const userMsg = (callClaude as any).mock.calls[0][0].userMessage as string;
    // Should contain at most 800 'x' run from the description
    const xRun = userMsg.match(/x{800,}/);
    expect(xRun).not.toBeNull();
    expect(userMsg.match(/x{900}/)).toBeNull();
  });
});

describe("classifyUnclassified", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    delete process.env.RFP_LLM_ENABLED;
  });

  it("returns zero stats when RFP_LLM_ENABLED='false'", async () => {
    process.env.RFP_LLM_ENABLED = "false";
    mockFindMany.mockResolvedValue([
      { id: 1, title: "x", description: null, aiSummary: null },
    ]);

    const stats = await classifyUnclassified(10, 2, 5_000);
    expect(stats).toEqual({ processed: 0, classified: 0, errors: 0, llmCalls: 0 });
    expect(mockUpdate).not.toHaveBeenCalled();
  });

  it("classifies and writes per-RFP", async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, title: "Tutoring", description: null, aiSummary: null },
      { id: 2, title: "HVAC",     description: null, aiSummary: null },
    ]);
    (callClaude as any).mockResolvedValue([{ type: "text", text: "ok" }]);
    (findToolUse as any)
      .mockReturnValueOnce({
        input: {
          fullmindRelevance: "high",
          keywords: ["tutoring"],
          fundingSources: [],
          setAsideType: "none",
          inStateOnly: false,
          cooperativeEligible: false,
        },
      })
      .mockReturnValueOnce({
        input: {
          fullmindRelevance: "none",
          keywords: ["hvac"],
          fundingSources: [],
          setAsideType: "none",
          inStateOnly: false,
          cooperativeEligible: false,
        },
      });

    const stats = await classifyUnclassified(10, 2, 30_000);

    expect(stats.processed).toBe(2);
    expect(stats.classified).toBe(2);
    expect(stats.errors).toBe(0);
    expect(mockUpdate).toHaveBeenCalledTimes(2);

    // Each call must include classifiedAt
    for (const call of mockUpdate.mock.calls) {
      expect(call[0].data.classifiedAt).toBeInstanceOf(Date);
    }
  });

  it("isolates per-RFP errors via Promise.allSettled-equivalent", async () => {
    mockFindMany.mockResolvedValue([
      { id: 1, title: "Good",  description: null, aiSummary: null },
      { id: 2, title: "Bad",   description: null, aiSummary: null },
    ]);

    let call = 0;
    (callClaude as any).mockImplementation(async () => {
      call++;
      if (call === 2) throw new Error("rate limited");
      return [{ type: "text", text: "ok" }];
    });
    (findToolUse as any).mockReturnValue({
      input: {
        fullmindRelevance: "high",
        keywords: [],
        fundingSources: [],
        setAsideType: "none",
        inStateOnly: false,
        cooperativeEligible: false,
      },
    });

    const stats = await classifyUnclassified(10, 1, 30_000);
    expect(stats.processed).toBe(2);
    expect(stats.classified).toBe(1);
    expect(stats.errors).toBe(1);
  });

  it("respects the limit argument (passes take to findMany)", async () => {
    mockFindMany.mockResolvedValue([]);
    await classifyUnclassified(50, 4, 1_000);
    expect(mockFindMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { classifiedAt: null },
        take: 50,
      }),
    );
  });
});
