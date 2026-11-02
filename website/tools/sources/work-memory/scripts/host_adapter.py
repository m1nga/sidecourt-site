#!/usr/bin/env python3
"""Metadata-only, opt-in host receipts. This hook does not learn or capture content.

Codex: notify --state-dir DIR --downstream-config FILE -- JSON
Claude: claude-stop --state-dir DIR < JSON
Inspect: status --state-dir DIR [--root PROJECT] [--limit 50]

FILE is the original Codex notify command as a JSON array of strings. Its
arguments are forwarded unchanged, including when receipt processing fails.
No transcript is opened and no model, scheduler, or background process is used.
"""

from __future__ import annotations

import argparse
from contextlib import closing
import hashlib
import json
import os
from pathlib import Path
import re
import sqlite3
import stat
import subprocess
import sys
from datetime import datetime, timezone


MAX_INPUT_BYTES = 4 * 1024 * 1024
DB_NAME = "host-receipts.sqlite3"
PROJECT_DB = Path(".work-memory") / "memory.sqlite3"
LIMITATIONS = [
    "Receipts prove only that this configured hook observed a completion; they do not prove semantic capture, learning, or successful work.",
    "Only exact checkpoint turn_key matches count as checkpointed; session-only checkpoints are informational, not turn coverage.",
    "Claude Stop supplies no turn ID. Fingerprints can collapse identical callbacks or repeated identical responses; counts are not a complete turn census.",
    "Claude Stop omits user interrupts and API-error endings. No host event means no receipt, including unavailable/offline/unsupported hosts.",
    "Existing open sessions may not reload installed guidance or configuration. Verify a real completion after host reload.",
    "Uninitialized projects are observed but never initialized by this hook. Old account history and other devices are not scanned.",
]


def warn(code: str) -> None:
    # Exception messages can contain payload text or private source paths.
    print(f"work-memory host adapter: {code}", file=sys.stderr)


def timestamp() -> str:
    return datetime.now(timezone.utc).isoformat(timespec="microseconds")


def digest(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def identifier(value: object) -> str:
    if not isinstance(value, str) or not re.fullmatch(r"[A-Za-z0-9_.:-]{1,256}", value):
        raise ValueError("invalid host identifier")
    return value


def parse_payload(raw: str) -> dict:
    if len(raw.encode("utf-8")) > MAX_INPUT_BYTES:
        raise ValueError("payload too large")
    result = json.loads(raw)
    if not isinstance(result, dict):
        raise ValueError("payload is not an object")
    return result


def cwd_path(value: object) -> Path:
    if not isinstance(value, str) or len(value) > 8192 or any(ord(c) < 32 for c in value):
        raise ValueError("invalid cwd")
    path = Path(value)
    if not path.is_absolute():
        raise ValueError("cwd must be absolute")
    return path.resolve()


def project_root(cwd: Path) -> Path | None:
    """Read-only discovery; marker and DB must already exist, without symlinks."""
    if not cwd.is_dir():
        return None
    for candidate in (cwd, *cwd.parents):
        marker = candidate / ".work-memory"
        db = candidate / PROJECT_DB
        if marker.is_symlink() or db.is_symlink():
            continue
        if marker.is_dir() and db.is_file():
            return candidate
    return None


def receipt(raw: str, host: str) -> dict | None:
    payload = parse_payload(raw)
    if host == "codex":
        if payload.get("type") != "agent-turn-complete":
            return None
        session = identifier(payload.get("thread-id"))
        turn = identifier(payload["turn-id"]) if payload.get("turn-id") else None
        message = payload.get("last-assistant-message", "")
    else:
        if payload.get("hook_event_name") != "Stop":
            return None
        session = identifier(payload.get("session_id"))
        turn = None  # The official Stop schema has no turn ID.
        message = payload.get("last_assistant_message", "")
    if not isinstance(message, str):
        raise ValueError("invalid final message")
    cwd = cwd_path(payload.get("cwd"))
    root = project_root(cwd)
    canonical = json.dumps(payload, sort_keys=True, separators=(",", ":"), ensure_ascii=False).encode("utf-8")
    payload_hash = digest(canonical)
    # Never use a timestamp as a fabricated host turn ID. A fallback fingerprint
    # is explicitly weaker, and lets redelivered identical callbacks be idempotent.
    turn_part = turn if turn else "fingerprint-" + payload_hash
    message_bytes = message.encode("utf-8")
    return {
        "receipt_key": f"{host}:{session}:{turn_part}",
        "host": host,
        "session_id": session,
        "turn_id": turn,
        "identity_precision": "host-turn-id" if turn else "fingerprint",
        "cwd": str(cwd),
        "root": str(root) if root else None,
        "observed_at": timestamp(),
        "payload_sha256": payload_hash,
        "payload_bytes": len(raw.encode("utf-8")),
        "response_sha256": digest(message_bytes),
        "response_bytes": len(message_bytes),
    }


def state_path(state_dir: str, create: bool) -> Path:
    target = Path(state_dir).expanduser()
    if target.is_symlink():
        raise ValueError("symlink state directory")
    target = target.resolve()
    if target in (Path(target.anchor), Path.home().resolve()):
        raise ValueError("state directory too broad")
    if create:
        # The private leaf protects its contents. Do not temporarily change the
        # process-wide umask: embedded callers may observe turns concurrently.
        target.mkdir(parents=True, mode=0o700, exist_ok=True)
    if target.exists():
        info = target.stat()
        if not stat.S_ISDIR(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077:
            raise ValueError("state directory is not private")
    db = target / DB_NAME
    if db.is_symlink():
        raise ValueError("symlink state database")
    if create:
        try:
            fd = os.open(db, os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
        except FileExistsError:
            pass
        else:
            os.close(fd)
    if db.exists():
        info = db.stat()
        if not stat.S_ISREG(info.st_mode) or info.st_uid != os.getuid() or info.st_mode & 0o077 or info.st_nlink != 1:
            raise ValueError("state database is not private")
    return db


def record(data: dict, state_dir: str) -> None:
    db = state_path(state_dir, create=True)
    with closing(sqlite3.connect(db, timeout=1)) as conn, conn:
        conn.execute("PRAGMA busy_timeout=1000")
        conn.execute("""CREATE TABLE IF NOT EXISTS receipts (
            receipt_key TEXT PRIMARY KEY, host TEXT NOT NULL, session_id TEXT NOT NULL,
            turn_id TEXT, identity_precision TEXT NOT NULL, cwd TEXT NOT NULL, root TEXT,
            observed_at TEXT NOT NULL, payload_sha256 TEXT NOT NULL, payload_bytes INTEGER NOT NULL,
            response_sha256 TEXT NOT NULL, response_bytes INTEGER NOT NULL
        )""")
        columns = tuple(data)
        conn.execute(f"INSERT OR IGNORE INTO receipts ({','.join(columns)}) VALUES ({','.join('?' for _ in columns)})", tuple(data.values()))


def observe(raw: str, host: str, state_dir: str) -> None:
    item = receipt(raw, host)
    if item is not None:
        record(item, state_dir)


def downstream(config: str | None, original_argv: list[str]) -> int:
    """Never shell-interpret, rewrite, split, or discard downstream arguments."""
    if not config:
        return 0
    try:
        with open(config, encoding="utf-8") as stream:
            raw = stream.read(65537)
        if len(raw) > 65536:
            raise ValueError("oversized config")
        command = json.loads(raw)
        if not isinstance(command, list) or not command or not all(isinstance(arg, str) and "\x00" not in arg for arg in command):
            raise ValueError("invalid downstream command")
        if not command[0]:
            raise ValueError("empty executable")
        # Do not impose a new timeout or discard output on the existing notifier.
        return subprocess.run(command + original_argv, check=False).returncode
    except Exception as error:
        warn("downstream_notifier_failed_" + type(error).__name__)
        return 0


def notify(args: argparse.Namespace) -> int:
    original = list(args.payload)
    if original[:1] == ["--"]:
        original = original[1:]
    try:
        if len(original) != 1:
            raise ValueError("expected one payload")
        observe(original[0], "codex", args.state_dir)
    except Exception as error:
        warn("receipt_not_recorded_" + type(error).__name__)
    # Unconditionally forward, even if JSON parsing or SQLite was broken.
    return downstream(args.downstream_config, original)


def claude_stop(args: argparse.Namespace) -> int:
    try:
        raw = sys.stdin.buffer.read(MAX_INPUT_BYTES + 1)
        if len(raw) > MAX_INPUT_BYTES:
            raise ValueError("payload too large")
        observe(raw.decode("utf-8"), "claude", args.state_dir)
    except Exception as error:
        warn("receipt_not_recorded_" + type(error).__name__)
    # No decision, context, or nonzero exit that could continue/block Claude.
    return 0


def checkpoint_status(item: dict) -> dict:
    result = {"checkpoint_status": "pending_checkpoint", "session_checkpoint_count": 0}
    if not item["root"]:
        result["checkpoint_status"] = "uninitialized_project"
        return result
    root = Path(item["root"])
    db = root / PROJECT_DB
    if (root / ".work-memory").is_symlink() or db.is_symlink() or not db.is_file():
        result["checkpoint_status"] = "project_unavailable"
        return result
    try:
        with closing(sqlite3.connect(db.as_uri() + "?mode=ro", uri=True, timeout=1)) as conn:
            conn.execute("PRAGMA query_only=ON")
            cols = {row[1] for row in conn.execute("PRAGMA table_info(checkpoints)")}
            if not {"turn_key", "no_change"}.issubset(cols):
                result["checkpoint_status"] = "checkpoint_schema_unavailable"
                return result
            row = conn.execute("SELECT no_change FROM checkpoints WHERE turn_key=?", (item["receipt_key"],)).fetchone()
            if row:
                result["checkpoint_status"] = "checkpointed_no_change" if row[0] else "checkpointed"
            if {"session_id", "host"}.issubset(cols):
                result["session_checkpoint_count"] = conn.execute(
                    "SELECT count(*) FROM checkpoints WHERE session_id=? AND host=?",
                    (item["session_id"], item["host"]),
                ).fetchone()[0]
    except (OSError, sqlite3.Error):
        result["checkpoint_status"] = "project_unavailable"
    return result


def status_report(state_dir: str, root: str | None = None, limit: int = 50) -> dict:
    db = state_path(state_dir, create=False)
    result = {"observed_receipts": 0, "counts": {}, "receipts": [], "limitations": LIMITATIONS}
    if not db.exists():
        return result
    with closing(sqlite3.connect(db.as_uri() + "?mode=ro", uri=True, timeout=1)) as conn:
        conn.row_factory = sqlite3.Row
        if not conn.execute("SELECT 1 FROM sqlite_master WHERE type='table' AND name='receipts'").fetchone():
            return result
        root_filter = str(Path(root).expanduser().resolve()) if root else None
        sql = "SELECT * FROM receipts"
        params = ()
        if root_filter:
            sql += " WHERE root=?"
            params = (root_filter,)
        # Counts cover all observed receipts, not just the display limit.
        for row in conn.execute(sql + " ORDER BY observed_at DESC", params):
            item = dict(row)
            item.update(checkpoint_status(item))
            result["observed_receipts"] += 1
            code = item["checkpoint_status"]
            result["counts"][code] = result["counts"].get(code, 0) + 1
            if len(result["receipts"]) < limit:
                result["receipts"].append(item)
    return result


def main(argv: list[str] | None = None) -> int:
    parser = argparse.ArgumentParser(description=__doc__, formatter_class=argparse.RawDescriptionHelpFormatter)
    commands = parser.add_subparsers(dest="command", required=True)
    for name in ("notify", "claude-stop", "status"):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", default=str(Path.home() / ".local/share/work-memory"))
        if name == "notify":
            command.add_argument("--downstream-config")
            command.add_argument("payload", nargs=argparse.REMAINDER)
        if name == "status":
            command.add_argument("--root")
            command.add_argument("--limit", type=int, default=50)
    args = parser.parse_args(argv)
    if args.command == "notify":
        return notify(args)
    if args.command == "claude-stop":
        return claude_stop(args)
    try:
        if not 0 <= args.limit <= 1000:
            raise ValueError("limit must be 0..1000")
        print(json.dumps(status_report(args.state_dir, args.root, args.limit), ensure_ascii=False, indent=2))
        return 0
    except Exception as error:
        warn("status_unavailable_" + type(error).__name__)
        return 1


if __name__ == "__main__":
    raise SystemExit(main())
