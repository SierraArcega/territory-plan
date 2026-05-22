import { describe, it, expect } from "vitest";
import { parseSseFrame, frameToEvent } from "../client";

describe("parseSseFrame", () => {
  it("parses a simple event+data frame", () => {
    expect(parseSseFrame("event: result\ndata: {\"x\":1}")).toEqual({
      event: "result",
      data: '{"x":1}',
    });
  });

  it("defaults event to 'message' when not specified", () => {
    expect(parseSseFrame("data: hello")).toEqual({
      event: "message",
      data: "hello",
    });
  });

  it("ignores comment lines starting with ':'", () => {
    expect(parseSseFrame(": ping\ndata: ok")).toEqual({
      event: "message",
      data: "ok",
    });
  });

  it("joins multi-line data blocks", () => {
    expect(parseSseFrame("event: a\ndata: line1\ndata: line2")).toEqual({
      event: "a",
      data: "line1\nline2",
    });
  });

  it("returns null when there is no data line", () => {
    expect(parseSseFrame(": ping only")).toBe(null);
    expect(parseSseFrame("event: result")).toBe(null);
  });

  it("strips a trailing \\r from CRLF wire format", () => {
    expect(parseSseFrame("event: x\r\ndata: y\r")).toEqual({
      event: "x",
      data: "y",
    });
  });
});

describe("frameToEvent", () => {
  it("turn_event with JSON yields a trace event", () => {
    const ev = frameToEvent(
      "turn_event",
      '{"type":"model_call","tokens":42}',
    );
    expect(ev?.kind).toBe("trace");
    if (ev?.kind === "trace") {
      expect(ev.payload).toEqual({ type: "model_call", tokens: 42 });
    }
  });

  it("result ok yields an ok event with listSpec + name", () => {
    const ok = {
      kind: "ok",
      listSpec: {
        schemaVersion: 1,
        source: "districts",
        filterTree: { kind: "and", children: [] },
        scope: { mode: "none" },
      },
      name: "High-priority prospects",
      assistantText: "Built that for you",
    };
    const ev = frameToEvent("result", JSON.stringify(ok));
    expect(ev?.kind).toBe("ok");
    if (ev?.kind === "ok") {
      expect(ev.name).toBe("High-priority prospects");
      expect(ev.listSpec.source).toBe("districts");
      expect(ev.assistantText).toBe("Built that for you");
    }
  });

  it("result clarifying yields a clarifying event with text", () => {
    const ev = frameToEvent(
      "result",
      JSON.stringify({ kind: "clarifying", text: "Which state?" }),
    );
    expect(ev?.kind).toBe("clarifying");
    if (ev?.kind === "clarifying") {
      expect(ev.text).toBe("Which state?");
    }
  });

  it("result error yields an error event with message", () => {
    const ev = frameToEvent(
      "result",
      JSON.stringify({ kind: "error", error: "Schema mismatch" }),
    );
    expect(ev?.kind).toBe("error");
    if (ev?.kind === "error") {
      expect(ev.error).toBe("Schema mismatch");
    }
  });

  it("event:error yields an error event", () => {
    const ev = frameToEvent("error", JSON.stringify({ error: "boom" }));
    expect(ev?.kind).toBe("error");
    if (ev?.kind === "error") {
      expect(ev.error).toBe("boom");
    }
  });

  it("returns null for unknown event names", () => {
    expect(frameToEvent("garbage", '{"x":1}')).toBe(null);
  });

  it("returns null for empty data", () => {
    expect(frameToEvent("result", "")).toBe(null);
  });

  it("returns an error when the result frame is malformed JSON", () => {
    const ev = frameToEvent("result", "not-json{");
    expect(ev?.kind).toBe("error");
  });

  it("turn_event with malformed JSON yields null (skipped)", () => {
    expect(frameToEvent("turn_event", "not-json{")).toBe(null);
  });
});
