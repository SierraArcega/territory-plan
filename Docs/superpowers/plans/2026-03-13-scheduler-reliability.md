# Scheduler Reliability & Monitoring Implementation Plan

> **For agentic workers:** REQUIRED: Use superpowers:subagent-driven-development (if subagents available) or superpowers:executing-plans to implement this plan. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add Slack alerting (failure, stale heartbeat, daily summary) to the territory-plan scheduler via a separate monitor container, and update the scheduler to emit structured state files.

**Architecture:** The scheduler (`run_scheduler.py`) writes `sync_state.json` and appends to `sync_history.jsonl` after each cycle. A separate monitor container (`monitor.py`) reads these files every 15 minutes and posts to Slack via incoming webhook. Both containers share a Docker named volume (`scheduler_logs`) at `/app/logs/`.

**Tech Stack:** Python 3.11, stdlib only for monitor (`urllib.request`, `json`, `zoneinfo`), Docker, Docker Compose

**Spec:** `Docs/superpowers/specs/2026-03-13-scheduler-reliability-design.md`

---

## File Structure

```
scheduler/
├── run_sync.py            # Modify — return result dict from run_sync()
├── run_scheduler.py       # Modify — safe_sync() returns result, write state files
├── monitor.py             # Create — standalone monitor with Slack alerting
├── Dockerfile.monitor     # Create — minimal image for monitor container
├── tests/
│   ├── test_run_sync.py   # Modify — update tests for new return values
│   ├── test_run_scheduler.py  # Create — test safe_sync return + state file writing
│   └── test_monitor.py    # Create — test monitor checks and Slack posting
docker-compose.yml         # Modify — add tp_monitor service
.env.example               # Modify — add SLACK_WEBHOOK_URL
```

---

## Chunk 1: Scheduler State Emission

### Task 1: Update `run_sync()` to return a result dict

**Files:**
- Modify: `scheduler/run_sync.py:35-55` (early return) and `:145-148` (success path)
- Modify: `scheduler/tests/test_run_sync.py`

- [ ] **Step 1: Write failing test — run_sync returns result on success**

In `scheduler/tests/test_run_sync.py`, update the existing happy path test to assert on the return value:

```python
# At line 44, change:
#     run_sync()
# To:
    result = run_sync()

    assert result["status"] == "success"
    assert result["opps_synced"] == 1
    assert result["unmatched_count"] == 0
    assert result["error"] is None
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scheduler && python -m pytest tests/test_run_sync.py::test_run_sync_happy_path -v`
Expected: FAIL — `result` is `None`, `NoneType has no attribute __getitem__`

- [ ] **Step 3: Write failing test — run_sync returns result on no-op**

Update the no-opportunities test:

```python
# At line 75, change:
#     run_sync()
# To:
    result = run_sync()

    assert result["status"] == "success"
    assert result["opps_synced"] == 0
    assert result["unmatched_count"] is None
    assert result["error"] is None
```

- [ ] **Step 4: Run test to verify it fails**

Run: `cd scheduler && python -m pytest tests/test_run_sync.py::test_run_sync_no_opportunities_skips -v`
Expected: FAIL

- [ ] **Step 5: Implement — add return values to run_sync()**

In `scheduler/run_sync.py`:

At the early return (line 52-55), change:
```python
    if not opp_hits:
        logger.info("No new/updated opportunities, skipping cycle")
        set_last_synced_at(conn, now)
        conn.close()
        return
```
To:
```python
    if not opp_hits:
        logger.info("No new/updated opportunities, skipping cycle")
        set_last_synced_at(conn, now)
        conn.close()
        return {"status": "success", "opps_synced": 0, "unmatched_count": None, "error": None}
```

At the success path (lines 145-148), change:
```python
        logger.info(
            f"=== Sync complete: {len(matched_records)} opps, "
            f"{len(unmatched_records)} unmatched ==="
        )
```
To:
```python
        logger.info(
            f"=== Sync complete: {len(matched_records)} opps, "
            f"{len(unmatched_records)} unmatched ==="
        )
        return {
            "status": "success",
            "opps_synced": len(matched_records),
            "unmatched_count": len(unmatched_records),
            "error": None,
        }
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/test_run_sync.py -v`
Expected: Both tests PASS

- [ ] **Step 7: Commit**

```bash
git add scheduler/run_sync.py scheduler/tests/test_run_sync.py
git commit -m "feat(scheduler): return result dict from run_sync()"
```

---

### Task 2: Update `safe_sync()` to return results and write state files

**Files:**
- Modify: `scheduler/run_scheduler.py`
- Create: `scheduler/tests/test_run_scheduler.py`

- [ ] **Step 1: Write failing test — safe_sync returns success result**

Create `scheduler/tests/test_run_scheduler.py`:

```python
import os
os.environ["OPENSEARCH_HOST"] = "https://test:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"
os.environ["SUPABASE_DB_URL"] = "postgresql://test:test@localhost:5432/test"

from unittest.mock import patch
from run_scheduler import safe_sync


@patch("run_scheduler.run_sync")
def test_safe_sync_returns_success(mock_run_sync):
    mock_run_sync.return_value = {
        "status": "success",
        "opps_synced": 10,
        "unmatched_count": 2,
        "error": None,
    }

    result = safe_sync()

    assert result["status"] == "success"
    assert result["opps_synced"] == 10
    assert result["attempts"] == 1
    mock_run_sync.assert_called_once()
```

- [ ] **Step 2: Run test to verify it fails**

Run: `cd scheduler && python -m pytest tests/test_run_scheduler.py::test_safe_sync_returns_success -v`
Expected: FAIL — `safe_sync()` returns `None`

- [ ] **Step 3: Write failing test — safe_sync returns failure after retries**

Add to `scheduler/tests/test_run_scheduler.py`:

```python
@patch("run_scheduler.time.sleep")  # don't actually sleep
@patch("run_scheduler.run_sync")
def test_safe_sync_returns_failure_after_retries(mock_run_sync, mock_sleep):
    mock_run_sync.side_effect = ConnectionError("OpenSearch down")

    result = safe_sync()

    assert result["status"] == "failed"
    assert result["error"] == "OpenSearch down"
    assert result["attempts"] == 3
    assert result["opps_synced"] == 0
    assert mock_run_sync.call_count == 3
```

- [ ] **Step 4: Write failing test — safe_sync succeeds on retry**

Add to `scheduler/tests/test_run_scheduler.py`:

```python
@patch("run_scheduler.time.sleep")
@patch("run_scheduler.run_sync")
def test_safe_sync_succeeds_on_second_attempt(mock_run_sync, mock_sleep):
    mock_run_sync.side_effect = [
        ConnectionError("temporary"),
        {"status": "success", "opps_synced": 5, "unmatched_count": 1, "error": None},
    ]

    result = safe_sync()

    assert result["status"] == "success"
    assert result["attempts"] == 2
    assert mock_run_sync.call_count == 2
```

- [ ] **Step 5: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_run_scheduler.py -v`
Expected: All 3 FAIL

- [ ] **Step 6: Implement — update safe_sync() to return results**

In `scheduler/run_scheduler.py`, replace the `safe_sync` function (lines 34-48):

```python
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
```

- [ ] **Step 7: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/test_run_scheduler.py -v`
Expected: All 3 PASS

- [ ] **Step 8: Commit**

```bash
git add scheduler/run_scheduler.py scheduler/tests/test_run_scheduler.py
git commit -m "feat(scheduler): safe_sync returns result dict with attempts"
```

---

### Task 3: Write state files from the main loop

**Files:**
- Modify: `scheduler/run_scheduler.py`
- Modify: `scheduler/tests/test_run_scheduler.py`

- [ ] **Step 1: Write failing test — sync_state.json written after sync**

Add to `scheduler/tests/test_run_scheduler.py`:

```python
import json
import tempfile
from pathlib import Path
from unittest.mock import patch


@patch("run_scheduler.run_sync")
def test_write_sync_state(mock_run_sync):
    mock_run_sync.return_value = {
        "status": "success",
        "opps_synced": 10,
        "unmatched_count": 2,
        "error": None,
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)
        from run_scheduler import write_sync_state, safe_sync

        result = safe_sync()
        write_sync_state(log_dir, result)

        state = json.loads((log_dir / "sync_state.json").read_text())
        assert state["last_sync_status"] == "success"
        assert state["opps_synced"] == 10
        assert state["unmatched_count"] == 2
        assert state["consecutive_failures"] == 0
        assert "last_sync_at" in state
        assert "heartbeat_at" in state
```

- [ ] **Step 2: Write failing test — sync_history.jsonl appended**

```python
@patch("run_scheduler.run_sync")
def test_append_sync_history(mock_run_sync):
    mock_run_sync.return_value = {
        "status": "success",
        "opps_synced": 10,
        "unmatched_count": 2,
        "error": None,
    }

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)
        from run_scheduler import append_sync_history, safe_sync

        result = safe_sync()
        append_sync_history(log_dir, result)
        append_sync_history(log_dir, result)

        lines = (log_dir / "sync_history.jsonl").read_text().strip().split("\n")
        assert len(lines) == 2
        entry = json.loads(lines[0])
        assert entry["status"] == "success"
        assert "timestamp" in entry
```

- [ ] **Step 3: Write failing test — consecutive_failures increments and resets**

```python
def test_consecutive_failures_tracking():
    from run_scheduler import write_sync_state

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)

        # First: failure
        write_sync_state(log_dir, {"status": "failed", "opps_synced": 0, "unmatched_count": None, "error": "boom", "attempts": 3})
        state = json.loads((log_dir / "sync_state.json").read_text())
        assert state["consecutive_failures"] == 1

        # Second: another failure
        write_sync_state(log_dir, {"status": "failed", "opps_synced": 0, "unmatched_count": None, "error": "boom", "attempts": 3})
        state = json.loads((log_dir / "sync_state.json").read_text())
        assert state["consecutive_failures"] == 2

        # Third: success resets
        write_sync_state(log_dir, {"status": "success", "opps_synced": 5, "unmatched_count": 0, "error": None, "attempts": 1})
        state = json.loads((log_dir / "sync_state.json").read_text())
        assert state["consecutive_failures"] == 0


def test_update_heartbeat_in_state():
    from run_scheduler import write_sync_state, update_heartbeat_in_state
    import time as _time

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)

        # Write initial state
        write_sync_state(log_dir, {"status": "success", "opps_synced": 5, "unmatched_count": 0, "error": None, "attempts": 1})
        state_before = json.loads((log_dir / "sync_state.json").read_text())
        old_heartbeat = state_before["heartbeat_at"]

        _time.sleep(0.01)  # tiny delay to ensure different timestamp

        # Update heartbeat only
        update_heartbeat_in_state(log_dir)
        state_after = json.loads((log_dir / "sync_state.json").read_text())

        # heartbeat_at should be updated, but sync data unchanged
        assert state_after["heartbeat_at"] > old_heartbeat
        assert state_after["last_sync_status"] == "success"
        assert state_after["opps_synced"] == 5
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_run_scheduler.py -v -k "write_sync or append_sync or consecutive"`
Expected: All 3 FAIL — functions don't exist yet

- [ ] **Step 5: Implement — write_sync_state and append_sync_history**

Add `import json` to the imports section at the top of `scheduler/run_scheduler.py` (after the existing stdlib imports around lines 3-8). Then add these functions:

```python
import json

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
```

- [ ] **Step 6: Update the main loop to call state writers**

In `scheduler/run_scheduler.py`, update the `__main__` block (lines 56-73):

```python
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
```

- [ ] **Step 7: Run all scheduler tests**

Run: `cd scheduler && python -m pytest tests/test_run_scheduler.py tests/test_run_sync.py -v`
Expected: All PASS

- [ ] **Step 8: Commit**

```bash
git add scheduler/run_scheduler.py scheduler/tests/test_run_scheduler.py
git commit -m "feat(scheduler): write sync_state.json and sync_history.jsonl after each cycle"
```

---

## Chunk 2: Monitor & Slack Alerting

### Task 4: Create monitor.py — core loop and state reading

**Files:**
- Create: `scheduler/monitor.py`
- Create: `scheduler/tests/test_monitor.py`

- [ ] **Step 1: Write failing test — read_sync_state returns state dict**

Create `scheduler/tests/test_monitor.py`:

```python
import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta


def test_read_sync_state_returns_dict():
    from monitor import read_sync_state

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)
        state = {
            "last_sync_at": datetime.now(timezone.utc).isoformat(),
            "last_sync_status": "success",
            "last_error": None,
            "opps_synced": 10,
            "unmatched_count": 2,
            "consecutive_failures": 0,
            "heartbeat_at": datetime.now(timezone.utc).isoformat(),
        }
        (log_dir / "sync_state.json").write_text(json.dumps(state))

        result = read_sync_state(log_dir)
        assert result["last_sync_status"] == "success"
        assert result["opps_synced"] == 10


def test_read_sync_state_returns_none_when_missing():
    from monitor import read_sync_state

    with tempfile.TemporaryDirectory() as tmpdir:
        result = read_sync_state(Path(tmpdir))
        assert result is None
```

- [ ] **Step 2: Write failing test — check_stale_heartbeat detects staleness**

```python
def test_check_stale_heartbeat_detects_stale():
    from monitor import check_stale_heartbeat

    state = {
        "heartbeat_at": (datetime.now(timezone.utc) - timedelta(hours=3)).isoformat(),
    }
    alert = check_stale_heartbeat(state)
    assert alert is not None
    assert "stale" in alert.lower() or "Stale" in alert


def test_check_stale_heartbeat_ok_when_fresh():
    from monitor import check_stale_heartbeat

    state = {
        "heartbeat_at": datetime.now(timezone.utc).isoformat(),
    }
    alert = check_stale_heartbeat(state)
    assert alert is None
```

- [ ] **Step 3: Write failing test — check_sync_failure detects consecutive failures**

```python
def test_check_sync_failure_detects_failures():
    from monitor import check_sync_failure

    state = {
        "last_sync_status": "failed",
        "consecutive_failures": 3,
        "last_error": "Connection refused",
        "last_sync_at": datetime.now(timezone.utc).isoformat(),
    }
    alert = check_sync_failure(state)
    assert alert is not None
    assert "Connection refused" in alert


def test_check_sync_failure_ok_when_below_threshold():
    from monitor import check_sync_failure

    state = {
        "last_sync_status": "failed",
        "consecutive_failures": 1,
        "last_error": "transient",
        "last_sync_at": datetime.now(timezone.utc).isoformat(),
    }
    alert = check_sync_failure(state)
    assert alert is None
```

- [ ] **Step 4: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_monitor.py -v`
Expected: All FAIL — `monitor` module doesn't exist

- [ ] **Step 5: Implement — monitor core functions**

Create `scheduler/monitor.py`:

```python
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
```

- [ ] **Step 6: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/test_monitor.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add scheduler/monitor.py scheduler/tests/test_monitor.py
git commit -m "feat(monitor): add core state reading and check functions"
```

---

### Task 5: Add daily summary and Slack posting

**Files:**
- Modify: `scheduler/monitor.py`
- Modify: `scheduler/tests/test_monitor.py`

- [ ] **Step 1: Write failing test — build_daily_summary from history**

Add to `scheduler/tests/test_monitor.py`:

```python
def test_build_daily_summary():
    from monitor import build_daily_summary

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)
        now = datetime.now(timezone.utc)

        lines = []
        for i in range(24):
            entry = {
                "timestamp": (now - timedelta(hours=i)).isoformat(),
                "status": "success" if i != 5 else "failed",
                "opps_synced": 60,
                "unmatched_count": 3,
                "error": None if i != 5 else "transient",
            }
            lines.append(json.dumps(entry))
        (log_dir / "sync_history.jsonl").write_text("\n".join(lines) + "\n")

        summary = build_daily_summary(log_dir)
        assert summary is not None
        assert "24" in summary  # total syncs
        assert "1" in summary   # failures
        assert "1,440" in summary or "1440" in summary  # 24 * 60 opps


def test_build_daily_summary_empty_history():
    from monitor import build_daily_summary

    with tempfile.TemporaryDirectory() as tmpdir:
        summary = build_daily_summary(Path(tmpdir))
        assert summary is not None
        assert "0" in summary
```

- [ ] **Step 2: Write failing test — post_to_slack calls webhook**

```python
from unittest.mock import patch, MagicMock


def test_post_to_slack_sends_request():
    from monitor import post_to_slack

    with patch("monitor.urllib.request.urlopen") as mock_urlopen:
        mock_response = MagicMock()
        mock_response.read.return_value = b"ok"
        mock_response.__enter__ = lambda s: mock_response
        mock_response.__exit__ = MagicMock(return_value=False)
        mock_urlopen.return_value = mock_response

        post_to_slack("https://hooks.slack.com/test", "Hello")

        mock_urlopen.assert_called_once()
        call_args = mock_urlopen.call_args
        request = call_args[0][0]
        body = json.loads(request.data)
        assert body["text"] == "Hello"
```

- [ ] **Step 3: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_monitor.py -v -k "daily_summary or post_to_slack"`
Expected: FAIL

- [ ] **Step 4: Implement — daily summary and Slack posting**

Add to `scheduler/monitor.py`:

```python
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
```

- [ ] **Step 5: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/test_monitor.py -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add scheduler/monitor.py scheduler/tests/test_monitor.py
git commit -m "feat(monitor): add daily summary builder and Slack posting"
```

---

### Task 6: Add anti-spam and monitor main loop

**Files:**
- Modify: `scheduler/monitor.py`
- Modify: `scheduler/tests/test_monitor.py`

- [ ] **Step 1: Write failing test — anti-spam prevents duplicate alerts**

Add to `scheduler/tests/test_monitor.py`:

```python
def test_should_alert_respects_cooldown():
    from monitor import should_alert, record_alert

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)

        # First alert should fire
        assert should_alert(log_dir, "sync_failure") is True

        # Record it
        record_alert(log_dir, "sync_failure")

        # Second should be suppressed
        assert should_alert(log_dir, "sync_failure") is False


def test_should_alert_allows_different_types():
    from monitor import should_alert, record_alert

    with tempfile.TemporaryDirectory() as tmpdir:
        log_dir = Path(tmpdir)

        record_alert(log_dir, "sync_failure")
        # Different type should still fire
        assert should_alert(log_dir, "stale_heartbeat") is True
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `cd scheduler && python -m pytest tests/test_monitor.py -v -k "should_alert"`
Expected: FAIL

- [ ] **Step 3: Implement — anti-spam functions**

Add to `scheduler/monitor.py`:

```python
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
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `cd scheduler && python -m pytest tests/test_monitor.py -v -k "should_alert"`
Expected: PASS

- [ ] **Step 5: Implement — monitor main loop**

Add to `scheduler/monitor.py`:

```python
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
```

- [ ] **Step 6: Run all monitor tests**

Run: `cd scheduler && python -m pytest tests/test_monitor.py -v`
Expected: All PASS

- [ ] **Step 7: Commit**

```bash
git add scheduler/monitor.py scheduler/tests/test_monitor.py
git commit -m "feat(monitor): add anti-spam, run_checks, daily summary, and main loop"
```

---

## Chunk 3: Docker & Deployment

### Task 7: Create Dockerfile.monitor and update docker-compose.yml

**Files:**
- Create: `scheduler/Dockerfile.monitor`
- Modify: `docker-compose.yml`
- Modify: `.env.example`

- [ ] **Step 1: Create Dockerfile.monitor**

Create `scheduler/Dockerfile.monitor`:

```dockerfile
FROM python:3.11-slim
WORKDIR /app
COPY monitor.py .
CMD ["python", "-u", "monitor.py"]
```

- [ ] **Step 2: Add tp_monitor service to docker-compose.yml**

Add after the `scheduler` service block in `docker-compose.yml`:

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

- [ ] **Step 3: Add SLACK_WEBHOOK_URL to .env.example**

Append to `.env.example`:

```
# Scheduler monitor — Slack incoming webhook for #data-flow alerts
SLACK_WEBHOOK_URL=https://hooks.slack.com/services/YOUR/WEBHOOK/URL
```

- [ ] **Step 4: Verify docker-compose config parses**

Run: `docker compose config --profiles scheduler 2>&1 | head -5 || echo "docker not available locally — config is text-validated"`

- [ ] **Step 5: Run all tests one final time**

Run: `cd scheduler && python -m pytest tests/ -v`
Expected: All PASS

- [ ] **Step 6: Commit**

```bash
git add scheduler/Dockerfile.monitor docker-compose.yml .env.example
git commit -m "feat(scheduler): add monitor container and docker-compose config"
```

---

## Deployment Checklist (Manual)

After all tasks are implemented and merged:

- [ ] Create a Slack Incoming Webhook for `#data-flow` at https://api.slack.com/apps
- [ ] Add `SLACK_WEBHOOK_URL` to the host server's `.env`
- [ ] On the host server: `git pull && docker compose --profile scheduler up -d --build`
- [ ] Verify both containers are running: `docker compose --profile scheduler ps`
- [ ] Wait 15 minutes, confirm no stale heartbeat alert fires
- [ ] Wait for next sync cycle, confirm `sync_state.json` is written
- [ ] Test failure alert: temporarily stop the scheduler container, wait for monitor to detect
