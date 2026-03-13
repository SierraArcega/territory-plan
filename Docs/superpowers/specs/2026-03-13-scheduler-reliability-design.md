# Scheduler Reliability & Monitoring Design

**Date**: 2026-03-13
**Status**: Draft
**Goal**: Make the territory-plan opportunity scheduler reliably always-running with Slack alerting for failures, stale heartbeats, and daily summaries.

## Context

The `tp_scheduler` container runs an hourly sync from OpenSearch to Supabase (opportunities, unmatched opps, district pipeline aggregates, materialized view refresh). Currently it has no deployment beyond Docker Compose, no alerting, and silent failures go unnoticed. The es-bi project uses a similar pattern on a local host server.

### Current State
- Last successful sync: 2026-03-13T03:39:16 UTC (stale — not currently running)
- No monitoring or alerting
- Single heartbeat file, no structured state
- Docker Compose with `profiles: ["scheduler"]`, `restart: unless-stopped`

### Decisions
- **Hosting (short term)**: Deploy to the same local host server as es-bi
- **Hosting (long term)**: Migrate both es-bi and territory-plan schedulers to a managed service (Railway or Fly.io)
- **Alerting channel**: Slack `#data-flow` (C0ALX5YNPJ5) via incoming webhook
- **Alerting architecture**: Separate monitor container (can detect total scheduler death)
- **Alert types**: Sync failure, stale heartbeat, daily summary

## Design

### 1. Scheduler State File

The scheduler writes a structured state file (`sync_state.json`) after each sync cycle, replacing the simple heartbeat as the primary state signal.

```json
{
  "last_sync_at": "2026-03-13T03:39:16Z",
  "last_sync_status": "success",
  "last_error": null,
  "opps_synced": 142,
  "unmatched_count": 8,
  "consecutive_failures": 0,
  "heartbeat_at": "2026-03-13T14:30:00Z"
}
```

- Written after every sync cycle (success or failure)
- Heartbeat timestamp updated every 5 min (existing behavior preserved)
- `consecutive_failures` increments on failure, resets to 0 on success
- Single source of truth for the monitor

Additionally, the scheduler appends to `sync_history.jsonl` — one JSON line per sync cycle — for daily summary computation.

### 2. Monitor Script

A standalone `monitor.py` runs as its own container alongside the scheduler. It performs three checks:

**Stale heartbeat detection (every 15 min)**
- Reads `sync_state.json`
- If `heartbeat_at` is older than 2 hours, alert Slack
- If the file doesn't exist, alert Slack (scheduler never started)

**Sync failure detection (every 15 min)**
- If `last_sync_status` is `"failed"` and `consecutive_failures >= 3`, alert Slack
- Includes `last_error` in the alert message
- Tracks last alerted failure timestamp to avoid re-alerting for the same failure

**Daily summary (once per day, 8 AM ET)**
- Reads `sync_history.jsonl`, filters to last 24 hours
- Computes: total syncs, failures, total opps synced, current unmatched count
- Posts summary to Slack

### 3. Slack Integration

Uses a Slack Incoming Webhook URL pointed at `#data-flow`. Stored as `SLACK_WEBHOOK_URL` env var on the monitor container only. Posts via `urllib.request` — no SDK dependencies.

**Message formats:**

Failure alert:
> :red_circle: **Scheduler Alert — Sync Failed**
> 3 consecutive failures since 2026-03-13 12:00 UTC
> Error: `Connection refused to OpenSearch`

Stale heartbeat:
> :warning: **Scheduler Alert — Heartbeat Stale**
> Last heartbeat: 2026-03-13 03:39 UTC (2h 15m ago)
> The scheduler process may be down.

Daily summary:
> :chart_with_upwards_trend: **Daily Sync Summary — Mar 13**
> Syncs: 24 | Failures: 0 | Opps: 1,432 | Unmatched: 8

**Anti-spam:**
- Monitor tracks `last_alert_at` per alert type in `monitor_state.json`
- Same alert type won't re-send more than once per hour
- Daily summary sends exactly once per day

### 4. File & Container Layout

**New/modified files:**

```
scheduler/
├── run_scheduler.py      # Modified — write sync_state.json + append sync_history.jsonl
├── run_sync.py            # Modified — return result dict (opps count, status, error)
├── monitor.py             # New — reads state files, posts to Slack
├── Dockerfile             # Existing (scheduler)
├── Dockerfile.monitor     # New — lightweight image for monitor
└── logs/
    ├── sync_state.json    # Runtime — current scheduler state
    ├── sync_history.jsonl # Runtime — append-only sync log for daily summaries
    ├── monitor_state.json # Runtime — anti-spam tracking
    ├── heartbeat          # Existing — kept for backward compat
    └── scheduler.log      # Existing
```

**docker-compose.yml — new service:**

```yaml
tp_monitor:
  build:
    context: ./scheduler
    dockerfile: Dockerfile.monitor
  container_name: tp_monitor
  profiles: ["scheduler"]
  environment:
    - SLACK_WEBHOOK_URL=${SLACK_WEBHOOK_URL}
  volumes:
    - scheduler_logs:/app/logs
  restart: unless-stopped
```

- Both `tp_scheduler` and `tp_monitor` share the `scheduler_logs` volume
- Both start with `--profile scheduler`
- Monitor has no OpenSearch or Supabase access — reads files only, posts to Slack only

### 5. Changes to Existing Code

**`run_sync.py`**
- `run_sync()` returns a result dict: `{"status": "success"|"failed", "opps_synced": int, "unmatched_count": int, "error": str|None}`
- Currently returns nothing; minimal change to capture and return what it already logs

**`run_scheduler.py`**
- After each `safe_sync()` call, write `sync_state.json` with the result
- Append a line to `sync_history.jsonl` with timestamp + result
- Continue writing heartbeat file (existing behavior) but also update `heartbeat_at` in state file

## Future: Managed Service Migration

When ready to move off the local host server:
- Add `railway.toml` or `fly.toml` to `scheduler/`
- Both scheduler and monitor containers deploy as separate services
- Same env vars, same volume sharing pattern
- es-bi scheduler would follow the same migration path
