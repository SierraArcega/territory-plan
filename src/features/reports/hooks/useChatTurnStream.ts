"use client";

import { useCallback, useState } from "react";
import type { ChatRequest, TurnEvent } from "../lib/agent/types";
import type { ChatTurnResult } from "./useChatTurn";

export interface ChatTurnStreamCallbacks {
  /** Fires once per `TurnEvent` as the agent emits it. */
  onEvent: (e: TurnEvent) => void;
  /** Fires once when the stream's terminal `result` event arrives. */
  onComplete: (result: ChatTurnResult) => void;
  /** Fires on stream error or abort (excluding caller-initiated aborts). */
  onError: (err: Error) => void;
}

export interface UseChatTurnStream {
  isPending: boolean;
  /** Starts a new streaming turn. Returns the AbortController so callers can
   *  cancel (e.g. on unmount). The stream's reader is wired to the signal so
   *  cancellation tears the network read down promptly. */
  submit: (body: ChatRequest, callbacks: ChatTurnStreamCallbacks) => AbortController;
}

interface ParsedSseEvent {
  event: string;
  data: string;
}

/**
 * Pulls complete SSE events out of an accumulating buffer. Returns the parsed
 * events plus the leftover (incomplete) tail. SSE events are terminated by a
 * blank line (`\n\n`), so we slice on that boundary; lines starting with
 * `event:` and `data:` populate the parsed event. Comment lines (`:`) and
 * unknown fields are ignored — the route never emits them, but a tolerant
 * parser is defensive in case a proxy injects keep-alive comments.
 */
function drainEvents(buffer: string): { events: ParsedSseEvent[]; remainder: string } {
  const events: ParsedSseEvent[] = [];
  let cursor = 0;
  while (true) {
    const delim = buffer.indexOf("\n\n", cursor);
    if (delim === -1) break;
    const chunk = buffer.slice(cursor, delim);
    cursor = delim + 2;
    let event = "message";
    const dataLines: string[] = [];
    for (const rawLine of chunk.split("\n")) {
      const line = rawLine.replace(/\r$/, "");
      if (!line || line.startsWith(":")) continue;
      if (line.startsWith("event:")) {
        event = line.slice(6).trim();
      } else if (line.startsWith("data:")) {
        dataLines.push(line.slice(5).trim());
      }
    }
    events.push({ event, data: dataLines.join("\n") });
  }
  return { events, remainder: buffer.slice(cursor) };
}

export function useChatTurnStream(): UseChatTurnStream {
  const [isPending, setPending] = useState(false);

  const submit = useCallback(
    (body: ChatRequest, callbacks: ChatTurnStreamCallbacks): AbortController => {
      const controller = new AbortController();
      setPending(true);

      const finish = (): void => {
        // Defer to a microtask so React batches the state flip with whatever
        // the caller does in onComplete/onError. Avoids a flicker where
        // isPending bounces back to true mid-render.
        Promise.resolve().then(() => setPending(false));
      };

      (async () => {
        let res: Response;
        try {
          res = await fetch("/api/ai/query/chat/stream", {
            method: "POST",
            headers: {
              "content-type": "application/json",
              accept: "text/event-stream",
            },
            body: JSON.stringify(body),
            signal: controller.signal,
          });
        } catch (err) {
          if (controller.signal.aborted) {
            finish();
            return;
          }
          callbacks.onError(err instanceof Error ? err : new Error(String(err)));
          finish();
          return;
        }

        if (!res.ok || !res.body) {
          let msg = "Stream request failed";
          try {
            const j = (await res.json()) as { error?: string };
            if (j?.error) msg = j.error;
          } catch {
            // Non-JSON body — fall through with the generic message.
          }
          callbacks.onError(new Error(msg));
          finish();
          return;
        }

        const reader = res.body.getReader();
        const decoder = new TextDecoder();
        let buffer = "";

        try {
          while (true) {
            const { value, done } = await reader.read();
            if (done) break;
            buffer += decoder.decode(value, { stream: true });
            const { events, remainder } = drainEvents(buffer);
            buffer = remainder;
            for (const ev of events) {
              try {
                if (ev.event === "turn_event") {
                  callbacks.onEvent(JSON.parse(ev.data) as TurnEvent);
                } else if (ev.event === "result") {
                  callbacks.onComplete(JSON.parse(ev.data) as ChatTurnResult);
                } else if (ev.event === "error") {
                  const parsed = JSON.parse(ev.data) as { error?: string };
                  callbacks.onError(new Error(parsed.error ?? "Stream error"));
                }
              } catch (err) {
                // A single malformed event shouldn't kill the stream — log and
                // continue. (Should not happen in practice; the route always
                // emits valid JSON.)
                console.error("[useChatTurnStream] failed to parse event", ev, err);
              }
            }
          }
          // Flush any trailing event (no terminating blank line).
          const flushChunk = buffer.trim();
          if (flushChunk) {
            const { events } = drainEvents(buffer + "\n\n");
            for (const ev of events) {
              try {
                if (ev.event === "result") {
                  callbacks.onComplete(JSON.parse(ev.data) as ChatTurnResult);
                }
              } catch {
                // ignore
              }
            }
          }
        } catch (err) {
          if (!controller.signal.aborted) {
            callbacks.onError(err instanceof Error ? err : new Error(String(err)));
          }
        } finally {
          finish();
        }
      })();

      return controller;
    },
    [],
  );

  return { isPending, submit };
}
