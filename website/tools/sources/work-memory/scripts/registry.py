#!/usr/bin/env python3
"""Private workspace catalog. It routes recall; it never merges project memories."""

from __future__ import annotations

import argparse
import datetime as dt
import json
import os
from pathlib import Path
import re
import sqlite3
import subprocess
import sys
from urllib.parse import quote


DEFAULT_STATE = Path.home() / ".local" / "share" / "work-memory"
REGISTRY_NAME = "registry.sqlite3"
SCHEMA = "work-memory-registry/v1"


class RegistryError(Exception):
    pass


def now() -> str:
    return dt.datetime.now(dt.timezone.utc).isoformat(timespec="seconds")


def dump(value: object) -> None:
    print(json.dumps(value, ensure_ascii=False, sort_keys=True))


def state_path(value: str | Path) -> Path:
    path = Path(value).expanduser().absolute()
    if path.is_symlink():
        raise RegistryError("state directory must not be a symlink")
    return path


def readonly_sqlite(path: Path) -> sqlite3.Connection:
    if path.is_symlink() or not path.is_file():
        raise RegistryError(f"not a regular database: {path}")
    conn = sqlite3.connect(f"file:{quote(str(path))}?mode=ro", uri=True, timeout=5)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA query_only=ON")
    return conn


def project_identity(root: Path) -> str:
    """Read only the engine's stable metadata contract; never initialize a root."""
    marker = root / ".work-memory"
    database = marker / "memory.sqlite3"
    if marker.is_symlink() or database.is_symlink() or not database.is_file():
        raise RegistryError("workspace is not initialized with a regular work-memory database")
    conn = readonly_sqlite(database)
    try:
        metadata = dict(conn.execute("SELECT key, value FROM meta WHERE key IN ('project_id', 'schema_version')"))
    except sqlite3.Error as exc:
        raise RegistryError("workspace has no supported work-memory metadata") from exc
    finally:
        conn.close()
    if metadata.get("schema_version") != "1":
        raise RegistryError("unsupported work-memory schema")
    project_id = metadata.get("project_id")
    if not isinstance(project_id, str) or not project_id.strip():
        raise RegistryError("workspace metadata contains no stable project identity")
    return project_id


def run_engine(arguments: list[str]) -> dict:
    engine = Path(__file__).with_name("memory.py")
    try:
        proc = subprocess.run(
            [sys.executable, str(engine), *arguments],
            capture_output=True, text=True, timeout=30, check=False,
        )
    except subprocess.TimeoutExpired as exc:
        raise RegistryError("memory operation exceeded 30 seconds") from exc
    try:
        result = json.loads(proc.stdout or proc.stderr)
    except (json.JSONDecodeError, TypeError) as exc:
        raise RegistryError("memory operation returned invalid JSON") from exc
    if proc.returncode or not isinstance(result, dict) or result.get("ok") is False:
        detail = result.get("error", "memory operation failed") if isinstance(result, dict) else "invalid result"
        raise RegistryError(str(detail))
    return result


def connect_registry(state: Path, *, create: bool) -> sqlite3.Connection | None:
    database = state / REGISTRY_NAME
    if not create and not database.exists():
        return None
    if create:
        state.mkdir(parents=True, exist_ok=True, mode=0o700)
        if not state.is_dir() or state.is_symlink():
            raise RegistryError("state directory must be a real directory")
        os.chmod(state, 0o700)
        if database.is_symlink():
            raise RegistryError("registry database must not be a symlink")
        # Do not change process-global umask: callers may register concurrently.
        # A private first creation also protects the brief pre-connect interval.
        try:
            descriptor = os.open(database, os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0), 0o600)
        except FileExistsError:
            if database.is_symlink() or not database.is_file():
                raise RegistryError("registry database must be a regular file")
        else:
            try:
                os.fchmod(descriptor, 0o600)
            finally:
                os.close(descriptor)
        conn = sqlite3.connect(database, timeout=10)
        os.chmod(database, 0o600)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA busy_timeout=10000")
        try:
            conn.execute("BEGIN IMMEDIATE")
            existing = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
            if existing:
                if not {"registry_meta", "locations"}.issubset(existing):
                    raise RegistryError("existing database is not a work-memory registry")
                row = conn.execute("SELECT value FROM registry_meta WHERE key='schema'").fetchone()
                if not row or row[0] != SCHEMA:
                    raise RegistryError("unsupported registry schema")
            else:
                conn.execute("CREATE TABLE registry_meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
                conn.execute("""CREATE TABLE locations (
                    root TEXT PRIMARY KEY,
                    project_id TEXT NOT NULL,
                    label TEXT NOT NULL,
                    registered_at TEXT NOT NULL,
                    updated_at TEXT NOT NULL
                )""")
                conn.execute("INSERT INTO registry_meta VALUES ('schema', ?)", (SCHEMA,))
            conn.commit()
        except Exception:
            conn.close()
            raise
        return conn
    conn = readonly_sqlite(database)
    try:
        schema = conn.execute("SELECT value FROM registry_meta WHERE key='schema'").fetchone()
        if not schema or schema[0] != SCHEMA:
            raise RegistryError("unsupported registry schema")
    except Exception:
        conn.close()
        raise
    return conn


def register(state: Path, root_value: str, label: str | None) -> dict:
    try:
        root = Path(root_value).expanduser().resolve(strict=True)
    except (OSError, RuntimeError) as exc:
        raise RegistryError("workspace root does not exist") from exc
    if not root.is_dir():
        raise RegistryError("workspace root must be a directory")
    project_id = project_identity(root)
    if label is not None and (not label.strip() or len(label) > 200):
        raise RegistryError("label must contain 1–200 characters")
    conn = connect_registry(state, create=True)
    assert conn is not None
    try:
        conn.execute("BEGIN IMMEDIATE")
        old = conn.execute("SELECT * FROM locations WHERE root=?", (str(root),)).fetchone()
        if old and old["project_id"] != project_id:
            raise RegistryError("registered root now has a different project identity; explicit manual reconciliation required")
        chosen_label = label.strip() if label is not None else (old["label"] if old else root.name)
        stamp = now()
        conn.execute("""
            INSERT INTO locations VALUES (?, ?, ?, ?, ?)
            ON CONFLICT(root) DO UPDATE SET label=excluded.label, updated_at=excluded.updated_at
        """, (str(root), project_id, chosen_label, old["registered_at"] if old else stamp, stamp))
        conn.commit()
        matches = conn.execute("SELECT root FROM locations WHERE project_id=? ORDER BY root", (project_id,)).fetchall()
        return {
            "ok": True, "project_id": project_id, "root": str(root), "label": chosen_label,
            "multiple_locations": len(matches) > 1,
            "locations": [row["root"] for row in matches],
        }
    finally:
        conn.close()


def inventory(state: Path) -> list[dict]:
    conn = connect_registry(state, create=False)
    if conn is None:
        return []
    try:
        rows = [dict(row) for row in conn.execute("SELECT * FROM locations ORDER BY label, root")]
    finally:
        conn.close()
    counts: dict[str, int] = {}
    for row in rows:
        counts[row["project_id"]] = counts.get(row["project_id"], 0) + 1
    for row in rows:
        root = Path(row["root"])
        marker = root / ".work-memory"
        database = marker / "memory.sqlite3"
        row["present"] = root.is_dir() and not root.is_symlink() and not marker.is_symlink() and database.is_file() and not database.is_symlink()
        row["multiple_locations"] = counts[row["project_id"]] > 1
    return rows


def search(rows: list[dict], query: str) -> list[dict]:
    normalized = query.strip().casefold()
    if not normalized:
        return rows
    # A catalog searches names, not the contents of any project.
    tokens = re.findall(r"[\w-]+", normalized, re.UNICODE)
    results = []
    for row in rows:
        label = row["label"].casefold()
        haystack = " ".join((label, row["project_id"].casefold(), row["root"].casefold()))
        score = (100 if normalized == label or normalized == row["project_id"].casefold() else 0)
        score += (20 if normalized in haystack else 0)
        score += sum(1 for token in tokens if token in haystack)
        if score:
            results.append({**row, "match_score": score})
    return sorted(results, key=lambda row: (-row["match_score"], row["label"], row["root"]))


def recall(state: Path, query: str, project: str | None, limit: int, explore: bool) -> dict:
    rows = inventory(state)
    if project:
        needle = project.strip().casefold()
        candidates = [row for row in rows if needle in (row["project_id"].casefold(), row["label"].casefold(), row["root"].casefold())]
    elif len(rows) == 1:
        candidates = rows
    else:
        candidates = search(rows, query)
    if len(candidates) != 1:
        return {
            "ok": True, "selection_required": True,
            "reason": "no matching project" if not candidates else "multiple matching project locations",
            "candidates": candidates if candidates else rows,
            "hint": "Pass --project with an exact ID, label, or canonical root; copied IDs require an unambiguous root or label.",
        }
    selected = candidates[0]
    if not selected["present"]:
        raise RegistryError("selected workspace is missing or its memory path is unsafe; no other workspace was substituted")
    if project_identity(Path(selected["root"])) != selected["project_id"]:
        raise RegistryError("selected workspace identity has changed; refusing stale catalog route")
    arguments = ["recall", "--root", selected["root"], "--query", query, "--limit", str(limit)]
    if explore:
        arguments.append("--explore")
    return {"ok": True, "selection_required": False, "project": selected, "memory": run_engine(arguments)}


def parser() -> argparse.ArgumentParser:
    result = argparse.ArgumentParser(description=__doc__)
    commands = result.add_subparsers(dest="command", required=True)
    for name in ("register", "list", "locate", "recall"):
        command = commands.add_parser(name)
        command.add_argument("--state-dir", default=str(DEFAULT_STATE))
        if name == "register":
            command.add_argument("--root", required=True)
            command.add_argument("--label")
        if name in ("locate", "recall"):
            command.add_argument("--query", required=True)
        if name == "recall":
            command.add_argument("--project")
            command.add_argument("--limit", type=int, default=8)
            command.add_argument("--explore", action="store_true")
    return result


def main() -> int:
    args = parser().parse_args()
    try:
        state = state_path(args.state_dir)
        if args.command == "register":
            result = register(state, args.root, args.label)
        elif args.command == "list":
            result = {"ok": True, "projects": inventory(state)}
        elif args.command == "locate":
            result = {"ok": True, "projects": search(inventory(state), args.query)}
        else:
            if not 1 <= args.limit <= 100:
                raise RegistryError("limit must be between 1 and 100")
            result = recall(state, args.query, args.project, args.limit, args.explore)
        dump(result)
        return 0
    except (RegistryError, OSError, sqlite3.Error) as exc:
        dump({"ok": False, "error": str(exc)})
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
