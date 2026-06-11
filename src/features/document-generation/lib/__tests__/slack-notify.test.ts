import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { buildExecutedMessage, postExecutedAgreement } from "../slack-notify";

const NOTICE = {
  pdf: Buffer.from("%PDF-fake"),
  filename: "SY26-27 — Acme ISD — Contract — signed 2026-06-10 (a1b2c3d4).pdf",
  companyName: "Acme ISD",
  orderTotal: 20211.18 as number | null,
  schoolYearShort: "SY26-27" as string | null,
  repName: "Aston Arcega" as string | null,
  signedDate: "2026-06-10",
  driveUrl: "https://drive.google.com/file/d/F1/view" as string | null,
};

describe("buildExecutedMessage", () => {
  it("includes company, total, SY, rep, date, and Drive link", () => {
    const msg = buildExecutedMessage(NOTICE);
    expect(msg).toContain("Contract signed — Acme ISD");
    expect(msg).toContain("$20,211.18");
    expect(msg).toContain("SY26-27");
    expect(msg).toContain("sent by Aston Arcega");
    expect(msg).toContain("signed 2026-06-10");
    expect(msg).toContain("https://drive.google.com/file/d/F1/view");
  });
  it("omits null segments without dangling separators", () => {
    const msg = buildExecutedMessage({
      ...NOTICE,
      orderTotal: null,
      schoolYearShort: null,
      repName: null,
      driveUrl: null,
    });
    expect(msg).toContain("Contract signed — Acme ISD");
    expect(msg).toContain("signed 2026-06-10");
    expect(msg).not.toContain("$");
    expect(msg).not.toContain("·  ·");
    expect(msg).not.toContain("Drive:");
  });
});

describe("postExecutedAgreement", () => {
  const mockFetch = vi.fn();
  beforeEach(() => {
    vi.stubGlobal("fetch", mockFetch);
    mockFetch.mockReset();
    process.env.SLACK_BOT_TOKEN = "xoxb-test";
    process.env.SLACK_EXECUTED_CHANNEL_ID = "C123";
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    delete process.env.SLACK_BOT_TOKEN;
    delete process.env.SLACK_EXECUTED_CHANNEL_ID;
  });

  function queueHappyPath() {
    mockFetch
      .mockResolvedValueOnce({ // files.getUploadURLExternal
        ok: true,
        json: async () => ({ ok: true, upload_url: "https://files.slack/upload/u1", file_id: "FILE1" }),
      })
      .mockResolvedValueOnce({ ok: true, json: async () => ({}) }) // raw upload POST
      .mockResolvedValueOnce({ // files.completeUploadExternal
        ok: true,
        json: async () => ({ ok: true }),
      });
  }

  it("runs the 3-call external upload sequence", async () => {
    queueHappyPath();
    await postExecutedAgreement(NOTICE);
    expect(mockFetch).toHaveBeenCalledTimes(3);
    expect(String(mockFetch.mock.calls[0][0])).toContain("files.getUploadURLExternal");
    expect(String(mockFetch.mock.calls[1][0])).toBe("https://files.slack/upload/u1");
    expect(String(mockFetch.mock.calls[2][0])).toContain("files.completeUploadExternal");
    const completeBody = JSON.parse(mockFetch.mock.calls[2][1].body as string);
    expect(completeBody.channel_id).toBe("C123");
    expect(completeBody.files[0].id).toBe("FILE1");
    expect(completeBody.initial_comment).toContain("Acme ISD");
  });

  it("skips silently when env vars are missing", async () => {
    delete process.env.SLACK_BOT_TOKEN;
    await expect(postExecutedAgreement(NOTICE)).resolves.toBeUndefined();
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it("throws when Slack returns ok:false (caller isolates)", async () => {
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => ({ ok: false, error: "invalid_auth" }),
    });
    await expect(postExecutedAgreement(NOTICE)).rejects.toThrow("invalid_auth");
  });

  it("throws when the byte upload itself fails", async () => {
    mockFetch
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({ ok: true, upload_url: "https://files.slack/upload/u1", file_id: "FILE1" }),
      })
      .mockResolvedValueOnce({ ok: false, status: 500, json: async () => ({}) });
    await expect(postExecutedAgreement(NOTICE)).rejects.toThrow("500");
  });
});
