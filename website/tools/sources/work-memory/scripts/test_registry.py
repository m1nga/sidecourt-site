#!/usr/bin/env python3
"""Isolated workspace-catalog tests. No live user configuration or data."""

import concurrent.futures
import importlib.util
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest
from unittest.mock import patch


SCRIPT = Path(__file__).with_name("registry.py")
SPEC = importlib.util.spec_from_file_location("work_memory_registry", SCRIPT)
registry = importlib.util.module_from_spec(SPEC)
SPEC.loader.exec_module(registry)


class RegistryTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.addCleanup(self.temp.cleanup)
        self.base = Path(self.temp.name).resolve()
        self.state = self.base / "private-state"

    def project(self, name):
        root = self.base / name
        (root / ".work-memory").mkdir(parents=True)
        sqlite3.connect(root / ".work-memory" / "memory.sqlite3").close()
        return root

    def register(self, root, identity="project-a", label=None):
        with patch.object(registry, "project_identity", return_value=identity):
            return registry.register(self.state, str(root), label)

    def test_read_does_not_create_state(self):
        self.assertEqual([], registry.inventory(self.state))
        self.assertFalse(self.state.exists())

    def test_register_dedup_and_relabel(self):
        root = self.project("alpha")
        first = self.register(root, label="项目甲")
        second = self.register(root, label="新的名字")
        rows = registry.inventory(self.state)
        self.assertEqual(first["project_id"], second["project_id"])
        self.assertEqual(len(rows), 1)
        self.assertEqual(rows[0]["label"], "新的名字")
        self.assertEqual(len(registry.search(rows, "新的")), 1)
        self.assertEqual(os.stat(self.state).st_mode & 0o777, 0o700)
        self.assertEqual(os.stat(self.state / registry.REGISTRY_NAME).st_mode & 0o777, 0o600)

    def test_copied_project_locations_not_overwritten(self):
        root_a, root_b = self.project("alpha"), self.project("beta")
        self.register(root_a)
        result = self.register(root_b)
        self.assertTrue(result["multiple_locations"])
        self.assertEqual(len(result["locations"]), 2)
        outcome = registry.recall(self.state, "a topic", "project-a", 8, False)
        self.assertTrue(outcome["selection_required"])
        self.assertEqual(len(outcome["candidates"]), 2)

    def test_ambiguous_recall_never_calls_engine(self):
        self.register(self.project("one"), identity="one", label="Project")
        self.register(self.project("two"), identity="two", label="Project")
        with patch.object(registry, "run_engine") as engine:
            result = registry.recall(self.state, "unrelated", None, 8, False)
            engine.assert_not_called()
        self.assertTrue(result["selection_required"])

    def test_explicit_project_forwards_only_to_selected_root(self):
        root_a, root_b = self.project("alpha"), self.project("beta")
        self.register(root_a, identity="alpha", label="甲")
        self.register(root_b, identity="beta", label="乙")
        with patch.object(registry, "project_identity", return_value="beta"), patch.object(registry, "run_engine", return_value={"records": []}) as engine:
            result = registry.recall(self.state, "交付", "乙", 3, True)
        self.assertEqual(engine.call_args.args[0], ["recall", "--root", str(root_b.resolve()), "--query", "交付", "--limit", "3", "--explore"])
        self.assertFalse(result["selection_required"])

    def test_missing_root_is_reported_not_substituted(self):
        root = self.project("alpha")
        self.register(root)
        root.rename(self.base / "moved")
        self.assertFalse(registry.inventory(self.state)[0]["present"])
        with self.assertRaises(registry.RegistryError):
            registry.recall(self.state, "topic", None, 8, False)

    def test_identity_change_rejected(self):
        root = self.project("alpha")
        self.register(root, identity="before")
        with self.assertRaises(registry.RegistryError):
            self.register(root, identity="after")
        with patch.object(registry, "project_identity", return_value="after"), self.assertRaises(registry.RegistryError):
            registry.recall(self.state, "topic", "before", 8, False)

    def test_symlink_state_rejected(self):
        target = self.base / "target"
        target.mkdir()
        link = self.base / "link"
        link.symlink_to(target, target_is_directory=True)
        with self.assertRaises(registry.RegistryError):
            registry.state_path(link)

    def test_concurrent_registrations_keep_all(self):
        roots = [self.project(f"root-{n}") for n in range(12)]
        with patch.object(registry, "project_identity", side_effect=lambda root: root.name):
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
                list(pool.map(lambda root: registry.register(self.state, str(root), None), roots))
        self.assertEqual(len(registry.inventory(self.state)), len(roots))

    def test_concurrent_registrations_preserve_caller_umask(self):
        roots = [self.project(f"umask-root-{n}") for n in range(16)]
        previous = os.umask(0o022)
        try:
            with patch.object(registry, "project_identity", side_effect=lambda root: root.name):
                with concurrent.futures.ThreadPoolExecutor(max_workers=8) as pool:
                    list(pool.map(lambda root: registry.register(self.state, str(root), None), roots))
            observed = os.umask(0o022)
            self.assertEqual(observed, 0o022)
            self.assertEqual(os.stat(self.state / registry.REGISTRY_NAME).st_mode & 0o777, 0o600)
        finally:
            os.umask(previous)

    def test_no_response_or_content_columns(self):
        self.register(self.project("alpha"))
        conn = sqlite3.connect(self.state / registry.REGISTRY_NAME)
        columns = {row[1] for row in conn.execute("PRAGMA table_info(locations)")}
        conn.close()
        self.assertEqual(columns, {"root", "project_id", "label", "registered_at", "updated_at"})

    def test_cli_list_empty(self):
        result = subprocess.run([sys.executable, str(SCRIPT), "list", "--state-dir", str(self.state)], capture_output=True, text=True)
        self.assertEqual(result.returncode, 0, result.stderr)
        self.assertEqual(json.loads(result.stdout), {"ok": True, "projects": []})

    def test_real_engine_metadata_and_uninitialized_rejection(self):
        root = self.project("metadata-project")
        with self.assertRaises(registry.RegistryError):
            registry.project_identity(root)
        database = root / ".work-memory" / "memory.sqlite3"
        conn = sqlite3.connect(database)
        conn.execute("CREATE TABLE meta (key TEXT PRIMARY KEY, value TEXT NOT NULL)")
        conn.executemany("INSERT INTO meta VALUES (?, ?)", [("schema_version", "1"), ("project_id", "actual-project-id")])
        conn.commit()
        conn.close()
        before = database.stat().st_mtime_ns
        result = registry.register(self.state, str(root), "甲项目")
        self.assertEqual(result["project_id"], "actual-project-id")
        self.assertEqual(database.stat().st_mtime_ns, before)

    def test_existing_unrelated_database_not_changed(self):
        self.state.mkdir()
        database = self.state / registry.REGISTRY_NAME
        conn = sqlite3.connect(database)
        conn.execute("CREATE TABLE unrelated (value TEXT)")
        conn.commit()
        conn.close()
        with self.assertRaises(registry.RegistryError):
            self.register(self.project("alpha"))
        conn = sqlite3.connect(database)
        tables = {row[0] for row in conn.execute("SELECT name FROM sqlite_master WHERE type='table'")}
        conn.close()
        self.assertEqual(tables, {"unrelated"})

    @unittest.skipUnless(SCRIPT.with_name("memory.py").exists(), "engine not installed")
    def test_real_engine_register_and_scoped_recall(self):
        root = self.base / "engine-project"
        root.mkdir()
        engine = SCRIPT.with_name("memory.py")
        def invoke(command, body=None):
            arguments = [sys.executable, str(engine), command, "--root", str(root)]
            if body is not None:
                arguments.extend(["--input", "-"])
            result = subprocess.run(arguments, input=json.dumps(body) if body else None, capture_output=True, text=True)
            self.assertEqual(result.returncode, 0, result.stderr)
            return json.loads(result.stdout)
        invoke("init")
        invoke("capture", {"key": "delivery-choice", "kind": "decision", "authority": "user", "actor": "test-user", "summary": "交付需要离线导出", "source": {"text": "用户确认交付需要离线导出。", "locator": "test request"}})
        registered = registry.register(self.state, str(root), "实例项目")
        result = registry.recall(self.state, "交付", "实例项目", 3, False)
        self.assertFalse(result["selection_required"])
        self.assertEqual(result["project"]["project_id"], registered["project_id"])
        self.assertEqual(result["memory"]["records"][0]["key"], "delivery-choice")


if __name__ == "__main__":
    unittest.main()
