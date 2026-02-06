import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/data/district-profiles": ["./data/snapshots/district-profiles.json"],
    "/api/data/reconciliation": [
      "./data/snapshots/unmatched.json",
      "./data/snapshots/fragmented.json",
    ],
    "/api/data/snapshot-metadata": ["./data/snapshots/metadata.json"],
  },
};

export default nextConfig;
