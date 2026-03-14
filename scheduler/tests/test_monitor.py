import json
import tempfile
from pathlib import Path
from datetime import datetime, timezone, timedelta
from unittest.mock import patch, MagicMock


# Task 4: Core state reading and checks

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


# Task 5: Daily summary and Slack posting

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


# Task 6: Anti-spam

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
