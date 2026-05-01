import os
os.environ["OPENSEARCH_HOST"] = "https://test:9200"
os.environ["OPENSEARCH_USERNAME"] = "user"
os.environ["OPENSEARCH_PASSWORD"] = "pass"
os.environ["SUPABASE_DB_URL"] = "postgresql://test:test@localhost:5432/test"

import json
import tempfile
from pathlib import Path
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


@patch("run_scheduler.time.sleep")
@patch("run_scheduler.run_sync")
def test_safe_sync_returns_failure_after_retries(mock_run_sync, mock_sleep):
    mock_run_sync.side_effect = ConnectionError("OpenSearch down")

    result = safe_sync()

    assert result["status"] == "failed"
    assert result["error"] == "OpenSearch down"
    assert result["attempts"] == 3
    assert result["opps_synced"] == 0
    assert mock_run_sync.call_count == 3


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


# Task 3: State file writing tests

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
        from run_scheduler import write_sync_state

        result = safe_sync()
        write_sync_state(log_dir, result)

        state = json.loads((log_dir / "sync_state.json").read_text())
        assert state["last_sync_status"] == "success"
        assert state["opps_synced"] == 10
        assert state["unmatched_count"] == 2
        assert state["consecutive_failures"] == 0
        assert "last_sync_at" in state
        assert "heartbeat_at" in state


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
        from run_scheduler import append_sync_history

        result = safe_sync()
        append_sync_history(log_dir, result)
        append_sync_history(log_dir, result)

        lines = (log_dir / "sync_history.jsonl").read_text().strip().split("\n")
        assert len(lines) == 2
        entry = json.loads(lines[0])
        assert entry["status"] == "success"
        assert "timestamp" in entry


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

        _time.sleep(0.01)

        # Update heartbeat only
        update_heartbeat_in_state(log_dir)
        state_after = json.loads((log_dir / "sync_state.json").read_text())

        assert state_after["heartbeat_at"] > old_heartbeat
        assert state_after["last_sync_status"] == "success"
        assert state_after["opps_synced"] == 5


@patch("run_scheduler.schedule")
def test_daily_backfill_is_registered_at_04_00(mock_schedule):
    from run_scheduler import register_schedules

    register_schedules()

    # schedule.every().day.at("04:00") should have been called
    daily_chain_seen = any(
        c.args == ("04:00",)
        for c in mock_schedule.every.return_value.day.at.call_args_list
    )
    assert daily_chain_seen, "expected schedule.every().day.at('04:00').do(...) to be wired"


@patch("run_scheduler.schedule")
def test_hourly_sync_is_registered(mock_schedule):
    from run_scheduler import register_schedules

    register_schedules()

    # schedule.every(1).hour should have been called
    mock_schedule.every.assert_any_call(1)
    mock_schedule.every.return_value.hour.do.assert_called_once()
