#!/usr/bin/env python3
"""Isolated behavioral tests. No installed host configuration is modified."""

import argparse
import concurrent.futures
from contextlib import closing, redirect_stderr
import io
import json
from pathlib import Path
import sqlite3
import stat
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch

import host_adapter as adapter


class AdapterTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="work-memory-hooks-")
        self.base = Path(self.temporary.name).resolve()
        self.root = self.base / "project"
        self.root.mkdir()
        self.state = self.base / "private-state"
        self.script = Path(adapter.__file__).resolve()

    def tearDown(self):
        self.temporary.cleanup()

    def initialize(self):
        marker = self.root / ".work-memory"
        marker.mkdir()
        with closing(sqlite3.connect(self.root / adapter.PROJECT_DB)) as conn, conn:
            conn.execute("""CREATE TABLE checkpoints (
                turn_key TEXT PRIMARY KEY, actor TEXT, summary TEXT, next_action TEXT,
                record_ids TEXT, no_change INTEGER, created_at TEXT, session_id TEXT, host TEXT
            )""")

    def codex(self, **updates):
        value = {
            "type": "agent-turn-complete", "thread-id": "thread-123", "turn-id": "turn-456",
            "cwd": str(self.root), "input-messages": ["private user prompt should never persist"],
            "last-assistant-message": "private response should never persist",
        }
        value.update(updates)
        return json.dumps(value, ensure_ascii=False)

    def claude(self, **updates):
        value = {
            "hook_event_name": "Stop", "session_id": "session-789", "cwd": str(self.root),
            "stop_hook_active": False, "last_assistant_message": "private Claude response",
            "transcript_path": str(self.base / "DO_NOT_OPEN_TRANSCRIPT.jsonl"),
        }
        value.update(updates)
        return json.dumps(value, ensure_ascii=False)

    def run_cli(self, *args, stdin=None):
        return subprocess.run([sys.executable, str(self.script), *args], input=stdin, text=True, capture_output=True, check=False)

    def command_config(self, code="import json,sys; print(json.dumps(sys.argv[1:]))"):
        path = self.base / "downstream.json"
        path.write_text(json.dumps([sys.executable, "-c", code, "fixed argument with spaces"]), encoding="utf-8")
        return path

    def test_codex_receipt_is_metadata_only_private_and_idempotent(self):
        self.initialize()
        raw = self.codex()
        adapter.observe(raw, "codex", str(self.state))
        adapter.observe(raw, "codex", str(self.state))
        report = adapter.status_report(str(self.state))
        self.assertEqual(report["observed_receipts"], 1)
        item = report["receipts"][0]
        self.assertEqual(item["receipt_key"], "codex:thread-123:turn-456")
        self.assertEqual(item["identity_precision"], "host-turn-id")
        self.assertEqual(item["checkpoint_status"], "pending_checkpoint")
        db_bytes = (self.state / adapter.DB_NAME).read_bytes()
        self.assertNotIn(b"private user prompt", db_bytes)
        self.assertNotIn(b"private response", db_bytes)
        self.assertEqual(stat.S_IMODE(self.state.stat().st_mode), 0o700)
        self.assertEqual(stat.S_IMODE((self.state / adapter.DB_NAME).stat().st_mode), 0o600)

    def test_unrelated_project_is_not_initialized(self):
        adapter.observe(self.codex(), "codex", str(self.state))
        self.assertFalse((self.root / ".work-memory").exists())
        report = adapter.status_report(str(self.state))
        self.assertEqual(report["counts"], {"uninitialized_project": 1})

    def test_parent_project_found_and_nested_marker_preferred(self):
        self.initialize()
        nested = self.root / "src" / "feature"
        nested.mkdir(parents=True)
        self.assertEqual(adapter.project_root(nested), self.root)
        (nested / ".work-memory").mkdir()
        (nested / adapter.PROJECT_DB).touch()
        self.assertEqual(adapter.project_root(nested), nested)

    def test_marker_symlinks_are_not_followed(self):
        other = self.base / "some-other-project"
        other.mkdir()
        (other / "memory.sqlite3").touch()
        (self.root / ".work-memory").symlink_to(other, target_is_directory=True)
        self.assertIsNone(adapter.project_root(self.root))

    def test_exact_checkpoint_and_no_change_are_differentiated(self):
        self.initialize()
        adapter.observe(self.codex(), "codex", str(self.state))
        key = "codex:thread-123:turn-456"
        with closing(sqlite3.connect(self.root / adapter.PROJECT_DB)) as conn, conn:
            conn.execute("INSERT INTO checkpoints(turn_key,no_change,session_id,host) VALUES (?,0,?,?)", (key, "thread-123", "codex"))
        self.assertEqual(adapter.status_report(str(self.state))["counts"], {"checkpointed": 1})
        with closing(sqlite3.connect(self.root / adapter.PROJECT_DB)) as conn, conn:
            conn.execute("UPDATE checkpoints SET no_change=1 WHERE turn_key=?", (key,))
        self.assertEqual(adapter.status_report(str(self.state))["counts"], {"checkpointed_no_change": 1})

    def test_session_or_raw_turn_match_does_not_claim_coverage(self):
        self.initialize()
        adapter.observe(self.codex(), "codex", str(self.state))
        with closing(sqlite3.connect(self.root / adapter.PROJECT_DB)) as conn, conn:
            conn.execute("INSERT INTO checkpoints(turn_key,no_change,session_id,host) VALUES ('turn-456',0,'thread-123','codex')")
        item = adapter.status_report(str(self.state))["receipts"][0]
        self.assertEqual(item["checkpoint_status"], "pending_checkpoint")
        self.assertEqual(item["session_checkpoint_count"], 1)

    def test_claude_uses_declared_fingerprint_without_reading_transcript(self):
        self.initialize()
        transcript = self.base / "DO_NOT_OPEN_TRANSCRIPT.jsonl"
        transcript.write_text("SECRET TRANSCRIPT BODY", encoding="utf-8")
        transcript.chmod(0o000)
        try:
            adapter.observe(self.claude(), "claude", str(self.state))
            adapter.observe(self.claude(), "claude", str(self.state))
        finally:
            transcript.chmod(0o600)
        report = adapter.status_report(str(self.state))
        self.assertEqual(report["observed_receipts"], 1)
        item = report["receipts"][0]
        self.assertEqual(item["identity_precision"], "fingerprint")
        self.assertIsNone(item["turn_id"])
        self.assertIn("claude:session-789:fingerprint-", item["receipt_key"])
        db_bytes = (self.state / adapter.DB_NAME).read_bytes()
        self.assertNotIn(b"SECRET TRANSCRIPT BODY", db_bytes)
        self.assertNotIn(b"DO_NOT_OPEN_TRANSCRIPT", db_bytes)
        self.assertNotIn(b"private Claude response", db_bytes)

    def test_changed_claude_response_has_separate_receipt(self):
        adapter.observe(self.claude(), "claude", str(self.state))
        adapter.observe(self.claude(last_assistant_message="different response"), "claude", str(self.state))
        self.assertEqual(adapter.status_report(str(self.state))["observed_receipts"], 2)

    def test_other_events_do_not_write_state(self):
        adapter.observe(self.codex(type="approval-requested"), "codex", str(self.state))
        adapter.observe(self.claude(hook_event_name="StopFailure"), "claude", str(self.state))
        self.assertFalse(self.state.exists())

    def test_forward_valid_payload_byte_for_byte(self):
        config = self.command_config()
        raw = self.codex(**{"last-assistant-message": "中文 \"quoted\" $HOME $(no-execution)"})
        result = self.run_cli("notify", "--state-dir", str(self.state), "--downstream-config", str(config), "--", raw)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), ["fixed argument with spaces", raw])

    def test_forward_all_original_argv_when_receipt_invalid(self):
        config = self.command_config()
        original = ["--odd", "not JSON", " spaced argument "]
        result = self.run_cli("notify", "--state-dir", str(self.state), "--downstream-config", str(config), "--", *original)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout), ["fixed argument with spaces", *original])
        self.assertIn("receipt_not_recorded", result.stderr)

    def test_forward_even_when_state_write_fails(self):
        config = self.command_config()
        self.state.write_text("not a directory", encoding="utf-8")
        raw = self.codex()
        result = self.run_cli("notify", "--state-dir", str(self.state), "--downstream-config", str(config), "--", raw)
        self.assertEqual(result.returncode, 0)
        self.assertEqual(json.loads(result.stdout), ["fixed argument with spaces", raw])
        self.assertIn("receipt_not_recorded", result.stderr)

    def test_downstream_exit_code_preserved(self):
        config = self.command_config("import sys; sys.exit(7)")
        result = self.run_cli("notify", "--state-dir", str(self.state), "--downstream-config", str(config), "--", self.codex())
        self.assertEqual(result.returncode, 7)

    def test_missing_downstream_warns_without_losing_receipt(self):
        config = self.base / "missing-executable.json"
        config.write_text(json.dumps([str(self.base / "not-installed")]), encoding="utf-8")
        result = self.run_cli("notify", "--state-dir", str(self.state), "--downstream-config", str(config), "--", self.codex())
        self.assertEqual(result.returncode, 0)
        self.assertIn("downstream_notifier_failed", result.stderr)
        self.assertEqual(adapter.status_report(str(self.state))["observed_receipts"], 1)

    def test_claude_hook_never_blocks_or_prints_continuation(self):
        result = self.run_cli("claude-stop", "--state-dir", str(self.state), stdin=self.claude(stop_hook_active=True))
        self.assertEqual(result.returncode, 0)
        self.assertEqual(result.stdout, "")
        invalid = self.run_cli("claude-stop", "--state-dir", str(self.state), stdin="bad private input")
        self.assertEqual(invalid.returncode, 0)
        self.assertEqual(invalid.stdout, "")
        self.assertNotIn("bad private input", invalid.stderr)

    def test_claude_oversized_payload_is_bounded_and_nonblocking(self):
        payload = b"x" * (adapter.MAX_INPUT_BYTES + 10)
        stream = io.TextIOWrapper(io.BytesIO(payload))
        with patch.object(sys, "stdin", stream), redirect_stderr(io.StringIO()):
            self.assertEqual(adapter.claude_stop(argparse.Namespace(state_dir=str(self.state))), 0)
        self.assertFalse(self.state.exists())

    def test_symlink_and_world_readable_state_rejected(self):
        real = self.base / "private"
        real.mkdir(mode=0o700)
        self.state.symlink_to(real, target_is_directory=True)
        with self.assertRaises(ValueError):
            adapter.observe(self.codex(), "codex", str(self.state))
        self.state.unlink()
        self.state.mkdir(mode=0o755)
        self.state.chmod(0o755)
        with self.assertRaises(ValueError):
            adapter.observe(self.codex(), "codex", str(self.state))
        self.assertEqual(stat.S_IMODE(self.state.stat().st_mode), 0o755)

    def test_concurrent_receipts_do_not_mutate_process_umask(self):
        self.initialize()
        payloads = [self.codex(**{"turn-id": "concurrent-" + str(index)}) for index in range(4)]
        with patch.object(adapter.os, "umask", side_effect=AssertionError("process-wide mutation")):
            with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
                list(pool.map(lambda raw: adapter.observe(raw, "codex", str(self.state)), payloads))
        self.assertEqual(adapter.status_report(str(self.state))["observed_receipts"], 4)
        self.assertEqual(stat.S_IMODE(self.state.stat().st_mode), 0o700)

    def test_status_is_read_only_and_limits_display_not_counts(self):
        empty = adapter.status_report(str(self.state))
        self.assertEqual(empty["observed_receipts"], 0)
        self.assertFalse(self.state.exists())
        adapter.observe(self.codex(), "codex", str(self.state))
        adapter.observe(self.codex(**{"turn-id": "turn-999"}), "codex", str(self.state))
        report = adapter.status_report(str(self.state), limit=1)
        self.assertEqual(report["observed_receipts"], 2)
        self.assertEqual(len(report["receipts"]), 1)
        self.assertTrue(report["limitations"])

    def test_unavailable_or_wrong_schema_is_not_marked_captured(self):
        self.initialize()
        adapter.observe(self.codex(), "codex", str(self.state))
        with closing(sqlite3.connect(self.root / adapter.PROJECT_DB)) as conn, conn:
            conn.execute("DROP TABLE checkpoints")
        self.assertEqual(adapter.status_report(str(self.state))["counts"], {"checkpoint_schema_unavailable": 1})
        (self.root / adapter.PROJECT_DB).unlink()
        self.assertEqual(adapter.status_report(str(self.state))["counts"], {"project_unavailable": 1})


if __name__ == "__main__":
    unittest.main()
