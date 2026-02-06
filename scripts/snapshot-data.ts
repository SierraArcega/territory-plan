/**
 * Snapshot script — captures live API data and saves as static JSON files.
 * Run while the dev server is up: npx tsx scripts/snapshot-data.ts
 *
 * Optionally pass --push to auto-commit and push after snapshot.
 */
import fs from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const BASE_URL = process.env.SNAPSHOT_BASE_URL || "http://localhost:3005";
const SNAPSHOT_DIR = path.resolve(__dirname, "../data/snapshots");
const LOG_FILE = path.join(SNAPSHOT_DIR, "snapshot.log");
const METADATA_FILE = path.join(SNAPSHOT_DIR, "metadata.json");

const ENDPOINTS = [
  {
    name: "district-profiles",
    url: `${BASE_URL}/api/data/district-profiles`,
    file: "district-profiles.json",
  },
  {
    name: "unmatched",
    url: `${BASE_URL}/api/data/reconciliation?type=unmatched`,
    file: "unmatched.json",
  },
  {
    name: "fragmented",
    url: `${BASE_URL}/api/data/reconciliation?type=fragmented`,
    file: "fragmented.json",
  },
];

function appendLog(message: string) {
  const timestamp = new Date().toISOString();
  const line = `${timestamp} | ${message}\n`;
  fs.appendFileSync(LOG_FILE, line);
  console.log(line.trim());
}

async function snapshotEndpoint(
  endpoint: (typeof ENDPOINTS)[number]
): Promise<{ name: string; count: number }> {
  const response = await fetch(endpoint.url);
  if (!response.ok) {
    throw new Error(`${endpoint.name}: HTTP ${response.status}`);
  }
  const data = await response.json();
  const count = Array.isArray(data) ? data.length : 1;
  fs.writeFileSync(
    path.join(SNAPSHOT_DIR, endpoint.file),
    JSON.stringify(data, null, 2)
  );
  return { name: endpoint.name, count };
}

async function main() {
  const shouldPush = process.argv.includes("--push");

  // Ensure snapshot directory exists
  fs.mkdirSync(SNAPSHOT_DIR, { recursive: true });

  try {
    const results = await Promise.all(ENDPOINTS.map(snapshotEndpoint));

    // Build summary string
    const summary = results.map((r) => `${r.name}: ${r.count}`).join(" | ");
    appendLog(`OK | ${summary}`);

    // Write metadata
    const metadata = {
      lastRefreshed: new Date().toISOString(),
      counts: Object.fromEntries(results.map((r) => [r.name, r.count])),
    };
    fs.writeFileSync(METADATA_FILE, JSON.stringify(metadata, null, 2));

    if (shouldPush) {
      console.log("\nCommitting and pushing snapshot...");
      execSync("git add data/snapshots/", { stdio: "inherit" });
      execSync(
        `git commit -m "chore: update data snapshot ${new Date().toISOString().slice(0, 16)}"`,
        { stdio: "inherit" }
      );
      execSync("git push", { stdio: "inherit" });
      console.log("Pushed successfully.");
    }
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    appendLog(`FAIL | ${msg}`);
    process.exit(1);
  }
}

main();
