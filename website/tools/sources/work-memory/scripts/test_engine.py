#!/usr/bin/env python3
"""Synthetic, isolated acceptance tests; never touches real project memory."""
import concurrent.futures
import hashlib
import json
import os
from pathlib import Path
import sqlite3
import subprocess
import sys
import tempfile
import unittest

import memory


class EngineTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.root = Path(self.temp.name).resolve()
        self.ledger = memory.Ledger(self.root, initialize=True)

    def tearDown(self):
        self.ledger.db.close()
        self.temp.cleanup()

    def source(self, text="Synthetic user instruction"):
        return {"text": text, "locator": "synthetic-test:1"}

    def capture(self, key="one", kind="decision", authority="user", **extra):
        data = {"key": key, "kind": kind, "authority": authority, "actor": "author",
                "summary": "当前产品使用更小的验证步骤", "source": self.source()}
        data.update(extra)
        return self.ledger.capture(data)

    def ref(self, record):
        return {"id": record["id"], "revision": record["revision"]}

    def review(self, record, action="trial", reviewer="reviewer", **extra):
        data = {**self.ref(record), "action": action, "reviewer": reviewer,
                "rationale": "Checked against observed conditions", "checks": [self.source("Concrete boundary checked in test")]}
        data.update(extra)
        return self.ledger.review(data)

    def use(self, record, context="Trial on synthetic case"):
        return self.ledger.use({**self.ref(record), "actor": "worker", "context": context,
                                "expected_outcome": "Reduce retries while keeping verification"})["use_id"]

    def observe(self, uid, verdict="improved", **extra):
        data = {"use_id": uid, "actor": "observer", "verdict": verdict,
                "baseline": "3 retries before", "result": "1 retry with same checks",
                "evidence": self.source("Synthetic comparison log: before 3, after 1")}
        data.update(extra)
        return self.ledger.observe(data)

    def test_idempotency_revision_and_failed_write_rollback(self):
        first = self.capture()["record"]
        events = self.ledger.status()["events"]
        self.assertTrue(self.capture()["deduplicated"])
        self.assertEqual(events, self.ledger.status()["events"])
        with self.assertRaises(memory.MemoryError):
            self.capture(summary="new content", expected_revision=9, supersedes_reason="explicit update")
        self.assertEqual(events, self.ledger.status()["events"])
        second = self.capture(summary="new content", expected_revision=1, supersedes_reason="explicit update")["record"]
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(second["revision"], 2)
        result = self.ledger.recall("", 20, False)
        self.assertEqual([r["revision"] for r in result["records"]], [2])
        self.assertEqual(result["excluded"][0]["reason"], "superseded")
        with self.assertRaises(memory.MemoryError):
            self.use(first)

    def test_authority_explore_and_chinese_search(self):
        self.capture("proposed", authority="assistant")
        self.capture("idea", kind="idea")
        self.capture("lesson", kind="lesson")
        self.capture("confirmed")
        self.capture("open", kind="open")
        recall = self.ledger.recall("产品验证", 20, False)
        self.assertEqual({r["key"] for r in recall["records"]}, {"confirmed", "open"})
        self.assertEqual(len(self.ledger.recall("产品", 20, True)["records"]), 5)
        self.assertEqual(self.ledger.recall("unrelated", 20, True)["records"], [])

    def test_proposals_cannot_suppress_authoritative_current_truth(self):
        for kind in ("decision", "preference"):
            self.capture(kind, kind=kind)
            for new_kind in (kind, "idea", "open"):
                for authority in ("assistant", "observed"):
                    with self.assertRaises(memory.MemoryError):
                        self.capture(kind, kind=new_kind, authority=authority, summary="Unapproved replacement",
                                     expected_revision=1, supersedes_reason="Only a recommendation")
            current = self.ledger.recall("", 20, False)["records"]
            self.assertTrue(any(r["key"] == kind and r["revision"] == 1 and r["status"] == "confirmed" for r in current))
        self.capture("fact", kind="fact", authority="observed")
        with self.assertRaises(memory.MemoryError):
            self.capture("fact", kind="fact", authority="assistant", summary="Hypothesis only",
                         expected_revision=1, supersedes_reason="Speculation")
        with self.assertRaises(memory.MemoryError):
            self.capture("fact", kind="idea", authority="observed", summary="Idea only",
                         expected_revision=1, supersedes_reason="Reclassify")
        updated = self.capture("fact", kind="fact", authority="observed", summary="Fresh observed fact",
                               expected_revision=1, supersedes_reason="New direct observation")
        self.assertEqual(updated["record"]["revision"], 2)
        proposal = self.capture("proposal-for-decision", kind="idea", authority="assistant",
                                applicability="Alternative to the existing decision; not yet authorized")
        self.assertEqual(proposal["record"]["status"], "idea")

    def test_quoted_secret_keys_and_export_defense_in_depth(self):
        fake = "A" * 24
        for name in ("api_key", "access_token", "password", "client-secret"):
            content = json.dumps({name: fake})
            with self.assertRaises(memory.MemoryError):
                self.capture(name, source=self.source(content))
            with self.assertRaises(memory.MemoryError):
                memory.reject_secrets({name: fake})
        record = self.capture()["record"]
        # Simulate a legacy store created before the stricter input filter.
        legacy_content = json.dumps({"api_key": fake})
        legacy_source = {"type": "text", "content": legacy_content,
                         "locator": "legacy-fixture", "sha256": memory.digest(legacy_content)}
        self.ledger.db.execute("UPDATE records SET source=? WHERE id=?", (json.dumps(legacy_source), record["id"]))
        output = self.root / "refused-source-export"
        with self.assertRaises(memory.MemoryError):
            self.ledger.export(output, "", None)
        self.assertFalse(output.exists())
        clean_source = memory.snapshot(self.source(), self.root)
        self.ledger.db.execute("UPDATE records SET source=? WHERE id=?", (json.dumps(clean_source), record["id"]))
        self.ledger.checkpoint({"turn_key": "legacy-checkpoint", "actor": "worker", "summary": "Initially safe",
                                "next_action": "Continue", "no_change": True})
        self.ledger.db.execute("UPDATE checkpoints SET summary=?", (json.dumps({"password": fake}),))
        output = self.root / "refused-checkpoint-export"
        with self.assertRaises(memory.MemoryError):
            self.ledger.export(output, "", None)
        self.assertFalse(output.exists())

    def test_source_drift_missing_and_safety(self):
        path = self.root / "truth.md"
        path.write_text("version one", encoding="utf-8")
        self.capture(source={"path": "truth.md", "locator": "line 1"})
        path.write_text("version two", encoding="utf-8")
        self.assertEqual(self.ledger.recall("", 20, False)["excluded"][0]["reason"], "source_changed")
        path.unlink()
        self.assertEqual(self.ledger.recall("", 20, False)["excluded"][0]["reason"], "source_missing_or_unsafe")
        (self.root / ".env").write_text("not a secret", encoding="utf-8")
        with self.assertRaises(memory.MemoryError):
            self.capture("env", source={"path": ".env", "locator": "line 1"})
        link = self.root / "link"
        link.symlink_to(self.root / ".env")
        with self.assertRaises(memory.MemoryError):
            self.capture("link", source={"path": "link", "locator": "line 1"})
        with self.assertRaises(memory.MemoryError):
            self.capture("external", source={"path": str(Path(__file__)), "locator": "line 1"})
        with self.assertRaises(memory.MemoryError):
            self.capture("secret", source=self.source("-----BEGIN " + "PRIVATE KEY-----\nsynthetic-only"))

    def test_learning_requires_actual_outcomes_and_independent_review(self):
        record = self.capture(kind="lesson")["record"]
        with self.assertRaises(memory.MemoryError):
            self.use(record)
        with self.assertRaises(memory.MemoryError):
            self.review(record, reviewer="author")
        self.review(record)
        events = self.ledger.status()["events"]
        with self.assertRaises(memory.MemoryError):
            self.review(record, "promote", counterexample=self.source("Out of scope: irreversible production change"))
        self.assertEqual(events, self.ledger.status()["events"])
        self.assertEqual(self.ledger.status()["counts"], {"trial": 1})
        uid = self.use(record)
        self.assertEqual(len(self.ledger.status()["pending_outcomes"]), 1)
        with self.assertRaises(memory.MemoryError):
            self.observe(uid, result="3 retries before")
        observation = self.observe(uid)
        self.assertTrue(self.observe(uid)["deduplicated"])
        self.assertTrue(observation["outcome_id"])
        with self.assertRaises(memory.MemoryError):
            self.review(record, "promote", reviewer="worker", counterexample=self.source("Boundary tested"))
        with self.assertRaises(memory.MemoryError):
            self.review(record, "promote", reviewer="observer", counterexample=self.source("Boundary tested"))
        with self.assertRaises(memory.MemoryError):
            self.review(record, "promote")
        self.review(record, "promote", counterexample=self.source("Boundary tested: do not skip deployment checks"))
        self.assertEqual(self.ledger.recall("", 20, False)["records"][0]["status"], "active")
        harmful = self.use(record, "A distinct trial in another setting")
        self.observe(harmful, verdict="harmful", result="5 retries after")
        self.assertEqual(self.ledger.recall("", 20, False)["records"], [])
        self.assertEqual(self.ledger.status()["counts"], {"suspended": 1})
        with self.assertRaises(memory.MemoryError):
            self.review(record, "promote", counterexample=self.source("Boundary tested"))

    def test_learning_evidence_drift_deactivates_recall(self):
        record = self.capture(kind="lesson")["record"]
        path = self.root / "check.md"
        path.write_text("Verified applicability", encoding="utf-8")
        self.review(record, checks=[{"path": "check.md", "locator": "line 1"}])
        uid = self.use(record)
        self.observe(uid)
        self.review(record, "promote", counterexample=self.source("Boundary tested"))
        path.write_text("Evidence changed", encoding="utf-8")
        self.assertEqual(self.ledger.recall("", 20, False)["excluded"][0]["reason"], "review_evidence_changed_or_missing")
        learning = self.ledger.status()["learning"]
        self.assertEqual(learning["lifecycle_active"], 1)
        self.assertEqual(learning["usable_active"], 0)
        self.assertEqual(learning["active_lessons"], 0)

    def test_negative_learning_exports_as_portable_caution_not_guidance(self):
        record = self.capture("failed-rule", kind="lesson")["record"]
        self.review(record)
        usage = self.use(record)
        evidence = self.root / "negative-evidence.md"
        evidence.write_text("The trial increased retries from 3 to 5.", encoding="utf-8")
        self.observe(usage, verdict="harmful", result="5 retries after",
                     evidence={"path": evidence.name, "locator": "line 1"})
        rejected = self.capture("rejected-rule", kind="lesson")["record"]
        self.review(rejected, "reject", reviewer="author", rationale="Boundary check disproved applicability")
        # Retired/superseded lessons are not an indiscriminate exported archive.
        old = self.capture("obsolete-rule", kind="lesson")["record"]
        self.review(old, "reject", reviewer="author")
        self.capture("obsolete-rule", kind="lesson", summary="Revised candidate", expected_revision=1,
                     supersedes_reason="Corrected scope after rejection")
        evidence.unlink()
        self.assertEqual(self.ledger.recall("", 20, False)["records"], [])
        output = self.root / "caution-bundle"
        result = self.ledger.export(output, "", 1)
        bundle = json.loads((output / "records.json").read_text())
        self.assertEqual(result["total_cautions"], 2)
        self.assertFalse(result["cautions_truncated"])
        self.assertEqual({c["key"] for c in bundle["cautions"]}, {"failed-rule", "rejected-rule"})
        caution = next(c for c in bundle["cautions"] if c["key"] == "failed-rule")
        self.assertIn("DO_NOT_REAPPLY", caution["instruction_status"])
        observed = caution["verification"]["outcomes"][0]
        self.assertEqual(observed["verdict"], "harmful")
        self.assertFalse(observed["evidence"]["fresh_at_export"])
        self.assertEqual((output / observed["evidence"]["snapshot"]).read_text(), "The trial increased retries from 3 to 5.")
        self.assertTrue(all(record["key"] not in {"failed-rule", "rejected-rule"} for record in bundle["records"]))
        manifest = json.loads((output / "manifest.json").read_text())
        for name, metadata in manifest["files"].items():
            self.assertEqual(memory.digest((output / name).read_bytes()), metadata["sha256"])

    def test_checkpoints_resume_and_no_change(self):
        record = self.capture()["record"]
        checkpoint = {"turn_key": "codex:s:t", "actor": "worker", "summary": "Decision recorded",
                      "next_action": "Implement small step", "record_ids": [record["id"]], "session_id": "s", "host": "codex"}
        self.ledger.checkpoint(checkpoint)
        self.assertTrue(self.ledger.checkpoint(checkpoint)["deduplicated"])
        second = memory.Ledger(self.root)
        try:
            self.assertEqual(second.status()["last_checkpoint"]["next_action"], "Implement small step")
            second.checkpoint({"turn_key": "codex:s:t2", "actor": "worker", "summary": "Inspected, no durable change",
                               "next_action": "Wait for new evidence", "no_change": True})
        finally:
            second.db.close()
        self.assertTrue(self.ledger.status()["last_checkpoint"]["no_change"])
        self.assertEqual(self.ledger.status()["learning"]["active_lessons"], 0)

    def test_retirement_is_not_product_cancellation(self):
        record = self.capture(kind="open")["record"]
        self.review(record, "retire", reviewer="author", authority="observed")
        self.assertEqual(self.ledger.recall("", 20, False)["records"], [])
        decision = self.capture("decision")["record"]
        with self.assertRaises(memory.MemoryError):
            self.review(decision, "retire", reviewer="author", authority="observed")
        self.review(decision, "retire", reviewer="author", authority="user")
        lesson = self.capture("candidate", kind="lesson")["record"]
        self.review(lesson, "reject", reviewer="author")

    def test_export_all_and_portable_checksums(self):
        path = self.root / "truth.md"
        path.write_text("Current explicit decision", encoding="utf-8")
        for idx in range(25):
            self.capture(str(idx), source={"path": "truth.md", "locator": "line 1"})
        self.capture("promising", kind="idea")
        self.capture("pending", kind="open")
        self.capture("candidate", kind="lesson")
        output = self.root / "bundle"
        result = self.ledger.export(output, "", None)
        self.assertEqual(result["records"], 28)
        self.assertFalse(result["truncated"])
        self.assertEqual(result["pending_counts"]["lessons"], 1)
        manifest = json.loads((output / "manifest.json").read_text())
        path.unlink()
        for name, metadata in manifest["files"].items():
            self.assertEqual(hashlib.sha256((output / name).read_bytes()).hexdigest(), metadata["sha256"])
        portable = json.loads((output / "records.json").read_text())
        self.assertNotIn("path", portable["records"][0]["source"])
        self.assertTrue(any(r["export_class"] == "unverified_option" for r in portable["records"]))
        self.assertFalse(list(output.rglob("*.sqlite3")))
        with self.assertRaises(memory.MemoryError):
            self.ledger.export(output, "", None)

    def test_cross_window_concurrency_and_isolation(self):
        def worker(_):
            ledger = memory.Ledger(self.root)
            try:
                return ledger.capture({"key": "same", "kind": "fact", "authority": "observed", "actor": "worker",
                                       "summary": "Shared result", "source": self.source()})["deduplicated"]
            finally:
                ledger.db.close()
        with concurrent.futures.ThreadPoolExecutor(max_workers=4) as pool:
            values = list(pool.map(worker, range(8)))
        self.assertEqual(values.count(False), 1)
        sibling = self.root / "other"
        sibling.mkdir()
        other = memory.Ledger(sibling, initialize=True)
        try:
            self.assertEqual(other.recall("", 20, True)["records"], [])
            self.assertNotEqual(other.project_id(), self.ledger.project_id())
        finally:
            other.db.close()

    def test_concurrent_init_preserves_callers_umask(self):
        root = self.root / "simultaneous-init"
        root.mkdir()
        original = os.umask(0o027)
        try:
            def worker(index):
                ledger = memory.Ledger(root, initialize=True)
                try:
                    ledger.capture({"key": "concurrent-" + str(index), "kind": "fact", "authority": "observed",
                                    "actor": "worker", "summary": "Observed fixture", "source": self.source()})
                    return ledger.project_id()
                finally:
                    ledger.db.close()
            with concurrent.futures.ThreadPoolExecutor(max_workers=6) as pool:
                ids = list(pool.map(worker, range(12)))
            observed = os.umask(0o027)
            self.assertEqual(observed, 0o027)
            self.assertEqual(len(set(ids)), 1)
            self.assertEqual((root / ".work-memory" / "memory.sqlite3").stat().st_mode & 0o777, 0o600)
            self.assertEqual((root / ".work-memory").stat().st_mode & 0o777, 0o700)
        finally:
            os.umask(original)

    def test_taskdock_identity_private_modes_and_cli(self):
        sibling = self.root / "taskdock"
        sibling.mkdir()
        (sibling / "TASK.json").write_text(json.dumps({"id": "synthetic-taskdock-id"}))
        ledger = memory.Ledger(sibling, initialize=True)
        try:
            self.assertEqual(ledger.project_id(), "synthetic-taskdock-id")
            self.assertEqual(ledger.path.stat().st_mode & 0o777, 0o600)
            self.assertEqual(ledger.directory.stat().st_mode & 0o777, 0o700)
        finally:
            ledger.db.close()
        process = subprocess.run([sys.executable, str(Path(memory.__file__)), "status", "--root", str(sibling)], capture_output=True, text=True)
        self.assertEqual(process.returncode, 0, process.stderr)
        self.assertTrue(json.loads(process.stdout)["ok"])

    def test_private_store_is_git_ignored_without_overwriting_user_patterns(self):
        root = self.root / "git-project"
        root.mkdir()
        subprocess.run(["git", "init", "--quiet", str(root)], check=True, capture_output=True)
        ledger = memory.Ledger(root, initialize=True)
        try:
            ledger.capture({"key": "private", "kind": "fact", "authority": "observed", "actor": "worker",
                            "summary": "Private synthetic work", "source": self.source()})
            ignore = root / ".work-memory" / ".gitignore"
            self.assertEqual(ignore.read_text(), "*\n")
            self.assertEqual(ignore.stat().st_mode & 0o777, 0o600)
            status = subprocess.run(["git", "-C", str(root), "status", "--porcelain", "--untracked-files=all"],
                                    check=True, capture_output=True, text=True)
            self.assertEqual(status.stdout, "")
            subprocess.run(["git", "-C", str(root), "add", "-A"], check=True, capture_output=True)
            tracked = subprocess.run(["git", "-C", str(root), "ls-files"], check=True, capture_output=True, text=True)
            self.assertNotIn(".work-memory", tracked.stdout)
        finally:
            ledger.db.close()
        unsafe_root = self.root / "unprotective-ignore"
        (unsafe_root / ".work-memory").mkdir(parents=True)
        unsafe = unsafe_root / ".work-memory" / ".gitignore"
        original = "*.log\n!memory.sqlite3\n"
        unsafe.write_text(original)
        with self.assertRaises(memory.MemoryError):
            memory.Ledger(unsafe_root, initialize=True)
        self.assertEqual(unsafe.read_text(), original)
        self.assertFalse((unsafe.parent / "memory.sqlite3").exists())
        safe_root = self.root / "existing-protective-ignore"
        (safe_root / ".work-memory").mkdir(parents=True)
        safe_ignore = safe_root / ".work-memory" / ".gitignore"
        safe_original = "# User-owned privacy rule\n*\n"
        safe_ignore.write_text(safe_original)
        initialized = memory.Ledger(safe_root, initialize=True)
        initialized.db.close()
        self.assertEqual(safe_ignore.read_text(), safe_original)


if __name__ == "__main__":
    unittest.main(verbosity=2)
