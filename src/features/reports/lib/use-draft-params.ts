"use client";

import { useCallback } from "react";
import {
  useDraftQuery,
  useUpsertDraftMutation,
} from "./queries";
import { DEFAULT_LIMIT, type QueryParams } from "./types";
import { useReportsStore } from "./store";

const EMPTY_PARAMS: QueryParams = {
  table: "",
  limit: DEFAULT_LIMIT,
};

/**
 * Read + write the current user's active draft. Returns the current params
 * (or a blank scaffold if no draft exists) and a setter that upserts the
 * draft server-side and marks the store dirty.
 */
export function useDraftParams() {
  const { data: draft } = useDraftQuery();
  const upsert = useUpsertDraftMutation();
  const markDirty = useReportsStore((s) => s.markDirty);

  const params: QueryParams = draft?.params ?? EMPTY_PARAMS;

  const setParams = useCallback(
    (next: QueryParams) => {
      markDirty();
      return upsert.mutateAsync({
        params: next,
        conversationId: draft?.conversationId ?? undefined,
        chatHistory: draft?.chatHistory ?? undefined,
      });
    },
    [upsert, markDirty, draft?.conversationId, draft?.chatHistory],
  );

  return { params, setParams, isReady: draft !== undefined };
}
