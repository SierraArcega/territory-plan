"""Hourly scheduler with heartbeat monitoring."""

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
    """Run sync with error handling and retry."""
    max_retries = 3
    for attempt in range(1, max_retries + 1):
        try:
            run_sync()
            return
        except Exception as e:
            logger.error(f"Sync attempt {attempt}/{max_retries} failed: {e}")
            logger.error(traceback.format_exc())
            if attempt < max_retries:
                wait = 2 ** attempt * 10  # 20s, 40s
                logger.info(f"Retrying in {wait}s...")
                time.sleep(wait)
    logger.error("All sync attempts failed for this cycle")


def write_heartbeat():
    """Write heartbeat file for monitoring."""
    HEARTBEAT_FILE.write_text(datetime.now(timezone.utc).isoformat())


if __name__ == "__main__":
    logger.info("Starting opportunity sync scheduler")

    # Immediate first sync
    safe_sync()

    # Schedule hourly
    schedule.every(1).hour.do(safe_sync)

    # Run loop
    last_heartbeat = 0
    while True:
        schedule.run_pending()
        now = time.time()
        if now - last_heartbeat >= HEARTBEAT_INTERVAL:
            write_heartbeat()
            last_heartbeat = now
        time.sleep(10)
