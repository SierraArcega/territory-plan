/**
 * Browser-side SSE client for `POST /api/lists/ai-build`.
 *
 * The server emits three event types over an `EventSource`-style stream:
 *
 *   event: turn_event   — agent loop trace; payload is whatever runAgentLoop
 *                          emits (model_call, tool_use, tool_result, etc).
 *   event: result       — final structured payload, one of:
 *                            { kind: "ok", listSpec, name, assistantText }
 *                            { kind: "clarifying", text }
 *                            { kind: "error", error }
 *   event: error        — out-of-band server-level failure (rare).
 *
 * This module exposes a single async-iterator helper that yields a
 * normalized union so callers can write a clean switch instead of digging
 * through raw SSE frames.
 *
 * We can't use the platform `EventSource` because that interface only
 * supports GET. We hand-parse the stream from a POST fetch.
 */
import type { ListSpec } from "@/lib/saved-views/filter-tree";
import { API_BASE } from "@/features/shared/lib/api-client";

/** A single trace event from the agent loop (model_call / tool_use / etc). */
export interface TraceEvent {
  kind: "trace";
  payload: unknown;
}

/** Successful terminal result — model called emit_list_spec. */
export interface OkResultEvent {
  kind: "ok";
  listSpec: ListSpec;
  name: string;
  assistantText?: string;
}

/** Model asked for clarification rather than emitting a spec. */
export interface ClarifyingEvent {
  kind: "clarifying";
  text: string;
}

/** Either an in-band agent-loop surrender or a server-level error frame. */
export interface ErrorEvent {
  kind: "error";
  error: string;
}

export type AiListBuilderEvent =
  | TraceEvent
  | OkResultEvent
  | ClarifyingEvent
  | ErrorEvent;

/** Server `result` event payload union before normalization. */
interface ResultFramePayload {
  kind: "ok" | "clarifying" | "error";
  listSpec?: ListSpec;
  name?: string;
  assistantText?: string;
  text?: string;
  error?: string;
}

/**
 * Parse a single SSE frame (two-newline-delimited block) into an event name
 * + raw data string. Returns null when the frame is a comment-only "ping".
 *
 * Exported for unit tests.
 */
export function parseSseFrame(
  frame: string,
): { event: string; data: string } | null {
  let event = "message";
  const dataLines: string[] = [];
  for (const rawLine of frame.split("\n")) {
    const line = rawLine.endsWith("\r") ? rawLine.slice(0, -1) : rawLine;
    if (line.startsWith(":")) continue; // comment / ping
    if (line.startsWith("event:")) {
      event = line.slice(6).trim();
    } else if (line.startsWith("data:")) {
      dataLines.push(line.slice(5).trim());
    }
  }
  if (dataLines.length === 0) return null;
  return { event, data: dataLines.join("\n") };
}

/**
 * Normalize a raw SSE frame into the typed AiListBuilderEvent union.
 * Returns null when the frame doesn't carry meaningful payload.
 *
 * Exported for unit tests.
 */
export function frameToEvent(
  event: string,
  data: string,
): AiListBuilderEvent | null {
  if (!data) return null;
  if (event === "turn_event") {
    let payload: unknown;
    try {
      payload = JSON.parse(data);
    } catch {
      return null;
    }
    return { kind: "trace", payload };
  }
  if (event === "result") {
    let frame: ResultFramePayload;
    try {
      frame = JSON.parse(data) as ResultFramePayload;
    } catch {
      return { kind: "error", error: "Malformed result frame" };
    }
    if (frame.kind === "ok" && frame.listSpec && frame.name) {
      return {
        kind: "ok",
        listSpec: frame.listSpec,
        name: frame.name,
        assistantText: frame.assistantText,
      };
    }
    if (frame.kind === "clarifying" && typeof frame.text === "string") {
      return { kind: "clarifying", text: frame.text };
    }
    if (frame.kind === "error") {
      return { kind: "error", error: frame.error ?? "Unknown error" };
    }
    return { kind: "error", error: "Malformed result frame" };
  }
  if (event === "error") {
    let payload: { error?: string };
    try {
      payload = JSON.parse(data) as { error?: string };
    } catch {
      return { kind: "error", error: data };
    }
    return { kind: "error", error: payload.error ?? "Unknown error" };
  }
  return null;
}

interface BuildArgs {
  prompt: string;
  signal?: AbortSignal;
}

/**
 * POST /api/lists/ai-build and yield normalized events as the stream comes
 * in. The async iterator completes when the server closes the connection.
 *
 * Callers do:
 *   for await (const ev of streamAiListBuilder({ prompt })) {
 *     switch (ev.kind) {
 *       case "trace":      // update progress dots
 *       case "ok":         // populate fields + close
 *       case "clarifying": // show clarification prompt
 *       case "error":      // show red error
 *     }
 *   }
 *
 * @throws when the initial response is not 2xx; trace/result events flow as
 *         iterator yields, not exceptions.
 */
export async function* streamAiListBuilder(
  args: BuildArgs,
): AsyncGenerator<AiListBuilderEvent, void, void> {
  const res = await fetch(`${API_BASE}/lists/ai-build`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt: args.prompt }),
    signal: args.signal,
  });
  if (!res.ok) {
    let detail = "";
    try {
      const body = (await res.json()) as { error?: string };
      detail = body.error ?? "";
    } catch {
      // not JSON — fall through
    }
    throw new Error(
      detail
        ? `${res.status}: ${detail}`
        : `AI build failed: ${res.status} ${res.statusText}`,
    );
  }
  if (!res.body) {
    throw new Error("AI build response missing body");
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      // SSE frames are separated by a blank line — "\n\n" (or "\r\n\r\n").
      let sepIdx: number;
      while ((sepIdx = findFrameSeparator(buffer)) !== -1) {
        const frameText = buffer.slice(0, sepIdx);
        // Skip the 2-char separator. handle both \n\n and \r\n\r\n forms.
        const sepLen = buffer.startsWith("\r\n\r\n", sepIdx) ? 4 : 2;
        buffer = buffer.slice(sepIdx + sepLen);
        const parsed = parseSseFrame(frameText);
        if (!parsed) continue;
        const ev = frameToEvent(parsed.event, parsed.data);
        if (ev) yield ev;
      }
    }
    // Flush any trailing frame the stream closed mid-line.
    if (buffer.trim().length > 0) {
      const parsed = parseSseFrame(buffer);
      if (parsed) {
        const ev = frameToEvent(parsed.event, parsed.data);
        if (ev) yield ev;
      }
    }
  } finally {
    try {
      reader.releaseLock();
    } catch {
      // ignore — reader already released
    }
  }
}

/** Returns the index of the first frame separator, or -1. */
function findFrameSeparator(buffer: string): number {
  const a = buffer.indexOf("\n\n");
  const b = buffer.indexOf("\r\n\r\n");
  if (a === -1) return b;
  if (b === -1) return a;
  return Math.min(a, b);
}
