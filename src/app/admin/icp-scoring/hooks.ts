"use client";

import { useState, useEffect, useCallback } from "react";
import type { District } from "./types";

export function useDistrictScores() {
  const [data, setData] = useState<District[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);

  const fetchData = useCallback(() => {
    setLoading(true);
    setError(false);
    fetch("/district_scores.json")
      .then((r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: District[]) => {
        setData(d);
        setLoading(false);
      })
      .catch(() => {
        setError(true);
        setLoading(false);
      });
  }, []);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  return { data, loading, error, retry: fetchData };
}
