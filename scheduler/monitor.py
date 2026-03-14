"""Monitor for scheduler health — posts alerts to Slack."""

import json
import logging
import os
import time
import urllib.request
from datetime import datetime, timezone, timedelta
from pathlib import Path
from zoneinfo import ZoneInfo

LOG_DIR = Path("/app/logs") if os.path.isdir("/app") else Path("logs")

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger("monitor")

STALE_THRESHOLD = timedelta(hours=2)
FAILURE_THRESHOLD = 3
CHECK_INTERVAL = 900  # 15 minutes
ANTI_SPAM_INTERVAL = timedelta(hours=1)
ET = ZoneInfo("America/New_York")


def read_sync_state(log_dir):
    """Read sync_state.json. Returns dict or None if missing."""
    state_file = log_dir / "sync_state.json"
    if not state_file.exists():
        return None
    try:
        return json.loads(state_file.read_text())
    except (json.JSONDecodeError, OSError):
        return None


def check_stale_heartbeat(state):
    """Returns alert message if heartbeat is stale, else None."""
    heartbeat_at = datetime.fromisoformat(state["heartbeat_at"])
    age = datetime.now(timezone.utc) - heartbeat_at
    if age > STALE_THRESHOLD:
        hours = age.total_seconds() / 3600
        return (
            f":warning: *Scheduler Alert — Heartbeat Stale*\n"
            f"Last heartbeat: {heartbeat_at.strftime('%Y-%m-%d %H:%M')} UTC "
            f"({hours:.0f}h {(age.total_seconds() % 3600) / 60:.0f}m ago)\n"
            f"The scheduler process may be down or a sync may be hanging."
        )
    return None


def check_sync_failure(state):
    """Returns alert message if consecutive failures >= threshold, else None."""
    if state.get("consecutive_failures", 0) >= FAILURE_THRESHOLD:
        return (
            f":red_circle: *Scheduler Alert — Sync Failed*\n"
            f"{state['consecutive_failures']} consecutive failures "
            f"since {state.get('last_sync_at', 'unknown')}\n"
            f"Error: `{state.get('last_error', 'unknown')}`"
        )
    return None


def build_daily_summary(log_dir):
    """Build daily summary message from sync_history.jsonl."""
    history_file = log_dir / "sync_history.jsonl"
    cutoff = datetime.now(timezone.utc) - timedelta(hours=24)

    total_syncs = 0
    failures = 0
    total_opps = 0
    last_unmatched = 0

    if history_file.exists():
        try:
            for line in history_file.read_text().strip().split("\n"):
                if not line:
                    continue
                entry = json.loads(line)
                ts = datetime.fromisoformat(entry["timestamp"])
                if ts < cutoff:
                    continue
                total_syncs += 1
                if entry["status"] == "failed":
                    failures += 1
                total_opps += entry.get("opps_synced", 0) or 0
                if entry.get("unmatched_count") is not None:
                    last_unmatched = entry["unmatched_count"]
        except (json.JSONDecodeError, OSError) as e:
            logger.error(f"Error reading sync history: {e}")

    today = datetime.now(ET).strftime("%b %d")
    return (
        f":chart_with_upwards_trend: *Daily Sync Summary — {today}*\n"
        f"Syncs: {total_syncs} | Failures: {failures} | "
        f"Opps: {total_opps:,} | Unmatched: {last_unmatched}"
    )


def truncate_old_history(log_dir):
    """Remove sync_history.jsonl entries older than 48 hours."""
    history_file = log_dir / "sync_history.jsonl"
    if not history_file.exists():
        return
    cutoff = datetime.now(timezone.utc) - timedelta(hours=48)
    kept = []
    try:
        for line in history_file.read_text().strip().split("\n"):
            if not line:
                continue
            entry = json.loads(line)
            ts = datetime.fromisoformat(entry["timestamp"])
            if ts >= cutoff:
                kept.append(line)
        history_file.write_text("\n".join(kept) + "\n" if kept else "")
    except (json.JSONDecodeError, OSError) as e:
        logger.error(f"Error truncating history: {e}")


def post_to_slack(webhook_url, message):
    """Post a message to Slack via incoming webhook."""
    data = json.dumps({"text": message}).encode("utf-8")
    req = urllib.request.Request(
        webhook_url,
        data=data,
        headers={"Content-Type": "application/json"},
    )
    try:
        with urllib.request.urlopen(req) as resp:
            resp.read()
        logger.info("Posted to Slack")
    except Exception as e:
        logger.error(f"Failed to post to Slack: {e}")


def _read_monitor_state(log_dir):
    """Read monitor_state.json."""
    state_file = log_dir / "monitor_state.json"
    if not state_file.exists():
        return {"last_alert_at": {}}
    try:
        return json.loads(state_file.read_text())
    except (json.JSONDecodeError, OSError):
        return {"last_alert_at": {}}


def _write_monitor_state(log_dir, state):
    """Write monitor_state.json."""
    (log_dir / "monitor_state.json").write_text(json.dumps(state))


def should_alert(log_dir, alert_type):
    """Check if enough time has passed since the last alert of this type."""
    state = _read_monitor_state(log_dir)
    last = state.get("last_alert_at", {}).get(alert_type)
    if last is None:
        return True
    last_dt = datetime.fromisoformat(last)
    return datetime.now(timezone.utc) - last_dt > ANTI_SPAM_INTERVAL


def record_alert(log_dir, alert_type):
    """Record that an alert was just sent."""
    state = _read_monitor_state(log_dir)
    state.setdefault("last_alert_at", {})[alert_type] = datetime.now(timezone.utc).isoformat()
    _write_monitor_state(log_dir, state)


def run_checks(log_dir, webhook_url):
    """Run all monitor checks once."""
    state = read_sync_state(log_dir)

    if state is None:
        if should_alert(log_dir, "stale_heartbeat"):
            post_to_slack(
                webhook_url,
                ":warning: *Scheduler Alert — No State File*\n"
                "sync_state.json not found. The scheduler may have never started.",
            )
            record_alert(log_dir, "stale_heartbeat")
        return

    # Check stale heartbeat
    heartbeat_alert = check_stale_heartbeat(state)
    if heartbeat_alert and should_alert(log_dir, "stale_heartbeat"):
        post_to_slack(webhook_url, heartbeat_alert)
        record_alert(log_dir, "stale_heartbeat")

    # Check sync failures
    failure_alert = check_sync_failure(state)
    if failure_alert and should_alert(log_dir, "sync_failure"):
        post_to_slack(webhook_url, failure_alert)
        record_alert(log_dir, "sync_failure")


def run_daily_summary(log_dir, webhook_url):
    """Send daily summary if it's 8 AM ET and hasn't been sent today."""
    now_et = datetime.now(ET)
    if now_et.hour != 8:
        return

    state = _read_monitor_state(log_dir)
    last_summary = state.get("last_alert_at", {}).get("daily_summary")
    if last_summary:
        last_dt = datetime.fromisoformat(last_summary)
        if (datetime.now(timezone.utc) - last_dt).total_seconds() < 82800:  # 23 hours
            return

    summary = build_daily_summary(log_dir)
    post_to_slack(webhook_url, summary)
    record_alert(log_dir, "daily_summary")
    truncate_old_history(log_dir)


if __name__ == "__main__":
    webhook_url = os.environ.get("SLACK_WEBHOOK_URL")
    if not webhook_url:
        logger.error("SLACK_WEBHOOK_URL not set")
        raise SystemExit(1)

    logger.info("Starting scheduler monitor")
    while True:
        try:
            run_checks(LOG_DIR, webhook_url)
            run_daily_summary(LOG_DIR, webhook_url)
        except Exception as e:
            logger.error(f"Monitor check failed: {e}")
        time.sleep(CHECK_INTERVAL)
