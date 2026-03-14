"""Hourly scheduler with heartbeat monitoring."""

import json
import os
import time
import logging
import traceback
from pathlib import Path
from datetime import datetime, timezone

import schedule
from dotenv import load_dotenv

load_dotenv()

from run_sync import run_sync

LOG_DIR = Path("/app/logs") if os.path.isdir("/app") else Path("logs")
LOG_DIR.mkdir(exist_ok=True)

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
    handlers=[
        logging.StreamHandler(),
        logging.FileHandler(LOG_DIR / "scheduler.log"),
    ],
)
logger = logging.getLogger("scheduler")

HEARTBEAT_FILE = LOG_DIR / "heartbeat"
HEARTBEAT_INTERVAL = 300  # 5 minutes


def safe_sync():
    """Run sync with error handling and retry. Returns result dict."""
    max_retries = 3
    last_error = None
    for attempt in range(1, max_retries + 1):
        try:
            result = run_sync()
            result["attempts"] = attempt
            return result
        except Exception as e:
            last_error = str(e)
            logger.error(f"Sync attempt {attempt}/{max_retries} failed: {e}")
            logger.error(traceback.format_exc())
            if attempt < max_retries:
                wait = 2 ** attempt * 10  # 20s, 40s
                logger.info(f"Retrying in {wait}s...")
                time.sleep(wait)
    logger.error("All sync attempts failed for this cycle")
    return {
        "status": "failed",
        "opps_synced": 0,
        "unmatched_count": None,
        "error": last_error,
        "attempts": max_retries,
    }


def write_sync_state(log_dir, result):
    """Write structured state file after each sync cycle."""
    state_file = log_dir / "sync_state.json"
    now = datetime.now(timezone.utc).isoformat()

    # Read existing consecutive_failures
    consecutive = 0
    if state_file.exists():
        try:
            prev = json.loads(state_file.read_text())
            consecutive = prev.get("consecutive_failures", 0)
        except (json.JSONDecodeError, OSError):
            pass

    if result["status"] == "failed":
        consecutive += 1
    else:
        consecutive = 0

    state = {
        "last_sync_at": now,
        "last_sync_status": result["status"],
        "last_error": result.get("error"),
        "opps_synced": result.get("opps_synced", 0),
        "unmatched_count": result.get("unmatched_count"),
        "consecutive_failures": consecutive,
        "heartbeat_at": now,
    }
    state_file.write_text(json.dumps(state))


def update_heartbeat_in_state(log_dir):
    """Update just the heartbeat_at timestamp in sync_state.json.

    Called every 5 minutes from the main loop to prove the process is alive,
    independent of whether a sync cycle has run.
    """
    state_file = log_dir / "sync_state.json"
    if not state_file.exists():
        return
    try:
        state = json.loads(state_file.read_text())
        state["heartbeat_at"] = datetime.now(timezone.utc).isoformat()
        state_file.write_text(json.dumps(state))
    except (json.JSONDecodeError, OSError):
        pass


def append_sync_history(log_dir, result):
    """Append one line to sync history for daily summary computation."""
    entry = {
        "timestamp": datetime.now(timezone.utc).isoformat(),
        "status": result["status"],
        "opps_synced": result.get("opps_synced", 0),
        "unmatched_count": result.get("unmatched_count"),
        "error": result.get("error"),
    }
    with open(log_dir / "sync_history.jsonl", "a") as f:
        f.write(json.dumps(entry) + "\n")


def write_heartbeat():
    """Write heartbeat file for monitoring."""
    HEARTBEAT_FILE.write_text(datetime.now(timezone.utc).isoformat())


if __name__ == "__main__":
    logger.info("Starting opportunity sync scheduler")

    # Immediate first sync
    result = safe_sync()
    write_sync_state(LOG_DIR, result)
    append_sync_history(LOG_DIR, result)

    def scheduled_sync():
        result = safe_sync()
        write_sync_state(LOG_DIR, result)
        append_sync_history(LOG_DIR, result)

    # Schedule hourly
    schedule.every(1).hour.do(scheduled_sync)

    # Run loop — heartbeat updates both the legacy file and sync_state.json
    last_heartbeat = 0
    while True:
        schedule.run_pending()
        now = time.time()
        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            write_heartbeat()
            update_heartbeat_in_state(LOG_DIR)
            last_heartbeat = now
        time.sleep(10)
