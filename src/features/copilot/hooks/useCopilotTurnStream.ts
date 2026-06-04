"use client";

import { useCallback, useState } from "react";
import { drainEvents } from "@/features/reports/hooks/useChatTurnStream";
import type {
  CopilotChatRequest,
  CopilotTurnResult,
  TurnEvent,
} from "@/features/copilot/lib/types";

export interface CopilotTurnStreamCallbacks {
  onEvent: (e: TurnEvent) => void;
  onComplete: (result: CopilotTurnResult) => void;
  onError: (err: Error) => void;
}

export interface UseCopilotTurnStream {
  isPending: boolean;
  submit: (
    body: CopilotChatRequest,
    callbacks: CopilotTurnStreamCallbacks,
  ) => AbortController;
}

/**
 * SSE consumer for POST /api/copilot/chat/stream. Reuses the reports stream
 * parser (`drainEvents`); the difference is the URL and the terminal `result`
 * shape (CopilotTurnResult — answer | actions | clarifying).
 */
export function useCopilotTurnStream(): UseCopilotTurnStream {
  const [isPending, setPending] = useState(false);

  const submit = useCallback(
    (
      body: CopilotChatRequest,
      callbacks: CopilotTurnStreamCallbacks,
    ): AbortController => {
      const controller = new AbortController();
      setPending(true);

      const finish = (): void => {
        Promise.resolve().then(() => setPending(false));
      };

      (async () => {
        let res: Response;
        try {
          res = await fetch("/api/copilot/chat/stream", {
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
            // Non-JSON body — fall through.
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
                  callbacks.onComplete(JSON.parse(ev.data) as CopilotTurnResult);
                } else if (ev.event === "error") {
                  const parsed = JSON.parse(ev.data) as { error?: string };
                  callbacks.onError(new Error(parsed.error ?? "Stream error"));
                }
              } catch (err) {
                console.error("[useCopilotTurnStream] failed to parse event", ev, err);
              }
            }
          }
          const flushChunk = buffer.trim();
          if (flushChunk) {
            const { events } = drainEvents(buffer + "\n\n");
            for (const ev of events) {
              try {
                if (ev.event === "result") {
                  callbacks.onComplete(JSON.parse(ev.data) as CopilotTurnResult);
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
