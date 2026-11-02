#!/usr/bin/env python3
"""Bundle integration regressions using real ledgers/registry in private temp roots."""

from contextlib import closing
import hashlib
import json
from pathlib import Path
import sqlite3
import stat
import subprocess
import sys
import tempfile
import unittest

import bundle
import memory
import registry


class BundleTests(unittest.TestCase):
    def setUp(self):
        self.temporary = tempfile.TemporaryDirectory(prefix="work-memory-bundle-")
        # macOS /var is a symlink; the engine intentionally requires real paths.
        self.base = Path(self.temporary.name).resolve()
        self.state = self.base / "state"
        self.output = self.base / "pickup"

    def tearDown(self):
        self.temporary.cleanup()

    def project(self, name="alpha", label=None, identity=None):
        root = self.base / name
        root.mkdir()
        if identity:
            (root / "TASK.json").write_text(json.dumps({"id": identity}), encoding="utf-8")
        registry.run_engine(["init", "--root", str(root)])
        evidence = root / "current-fact.txt"
        evidence.write_text("Verified current behavior for " + name, encoding="utf-8")
        ledger = memory.Ledger(root)
        try:
            record = ledger.capture({
                "key": "current-fact", "kind": "fact", "authority": "observed", "actor": "fixture-observer",
                "summary": "Current behavior for " + name,
                "source": {"path": "current-fact.txt", "locator": "explicit fixture evidence"},
            })["record"]
        finally:
            ledger.db.close()
        registry.register(self.state, str(root), label or name)
        return root, record

    def catalog(self):
        return json.loads((self.output / "catalog.json").read_text(encoding="utf-8"))

    def exported_project(self, index=0):
        entry = self.catalog()["projects"][index]
        folder = self.output / entry["folder"]
        return folder, json.loads((folder / "records.json").read_text(encoding="utf-8"))

    def check_manifest(self, root):
        manifest = json.loads((root / "manifest.json").read_text(encoding="utf-8"))
        actual = {path.relative_to(root).as_posix() for path in root.rglob("*") if path.is_file()}
        self.assertEqual(set(manifest["files"]) | {"manifest.json"}, actual)
        for relative, expected in manifest["files"].items():
            path = root / relative
            self.assertTrue(path.resolve().is_relative_to(root))
            data = path.read_bytes()
            self.assertEqual(len(data), expected["bytes"])
            self.assertEqual(hashlib.sha256(data).hexdigest(), expected["sha256"])

    def lesson(self, root, *, harmful=False):
        ledger = memory.Ledger(root)
        try:
            record = ledger.capture({
                "key": "bounded-batches", "kind": "lesson", "authority": "assistant", "actor": "author",
                "summary": "Smaller batches reduce retry cost for independent jobs",
                "applicability": "Independent jobs only; not atomic operations",
                "source": {"text": "Repeated large jobs incurred retry costs.", "locator": "episode"},
            })["record"]
            ref = {"id": record["id"], "revision": record["revision"]}
            ledger.review({
                **ref, "reviewer": "trial-reviewer", "action": "trial", "rationale": "A bounded comparison is safe",
                "checks": [{"text": "The fixture jobs are independent.", "locator": "trial-check"}],
                "counterexample": {"text": "Atomic work must not be split.", "locator": "boundary"},
            })
            usage = ledger.use({**ref, "actor": "executor", "context": "measured fixture job", "expected_outcome": "Retry cost below ten minutes"})
            evidence = root / "measured-outcome.txt"
            evidence.write_text("Baseline 10 minutes; measured " + ("14" if harmful else "4") + " minutes.", encoding="utf-8")
            ledger.observe({
                "use_id": usage["use_id"], "actor": "observer", "verdict": "harmful" if harmful else "improved",
                "baseline": "10 minutes", "result": "14 minutes" if harmful else "4 minutes",
                "evidence": {"path": "measured-outcome.txt", "locator": "measured outcome"},
            })
            if not harmful:
                ledger.review({
                    **ref, "reviewer": "independent-reviewer", "action": "promote", "rationale": "Observed benefit under the stated boundary",
                    "checks": [{"text": "The comparison used the same input and runtime.", "locator": "comparison-check"}],
                    "counterexample": {"text": "Atomic work remains outside this lesson.", "locator": "boundary-check"},
                })
            return record, evidence
        finally:
            ledger.db.close()

    def test_refuses_overwrite_without_changing_existing_output(self):
        self.project()
        self.output.mkdir()
        sentinel = self.output / "keep.txt"
        sentinel.write_text("User-owned contents", encoding="utf-8")
        with self.assertRaises(registry.RegistryError):
            bundle.export_bundle(self.output, self.state, [])
        self.assertEqual(list(self.output.iterdir()), [sentinel])
        self.assertEqual(sentinel.read_text(), "User-owned contents")

    def test_metadata_secret_rejected_before_creating_output(self):
        root, _ = self.project()
        synthetic = "sk-" + "z" * 24
        # Simulate a legacy registry: the export boundary must protect itself even
        # if a future registration-time validator rejects this label earlier.
        with closing(sqlite3.connect(self.state / registry.REGISTRY_NAME)) as conn, conn:
            conn.execute("UPDATE locations SET label=? WHERE root=?", (synthetic, str(root)))
        with self.assertRaises(memory.MemoryError):
            bundle.export_bundle(self.output, self.state, [])
        self.assertFalse(self.output.exists())

    def test_ambiguous_label_requires_exact_location(self):
        alpha, _ = self.project("alpha", label="Shared label")
        self.project("beta", label="Shared label")
        with self.assertRaises(registry.RegistryError):
            bundle.export_bundle(self.output, self.state, ["Shared label"])
        self.assertFalse(self.output.exists())
        report = bundle.export_bundle(self.output, self.state, [str(alpha)])
        self.assertTrue(report["ok"])
        self.assertEqual(report["projects"], 1)
        _, exported = self.exported_project()
        self.assertEqual(exported["records"][0]["summary"], "Current behavior for alpha")

    def test_copied_identity_requires_one_selected_root(self):
        alpha, _ = self.project("alpha", identity="copied-task-id")
        self.project("beta", identity="copied-task-id")
        with self.assertRaises(registry.RegistryError):
            bundle.export_bundle(self.output, self.state, [])
        self.assertFalse(self.output.exists())
        report = bundle.export_bundle(self.output, self.state, [str(alpha)])
        self.assertEqual(report["projects"], 1)
        self.assertTrue(report["ok"])

    def test_multiple_distinct_projects_export_without_merging(self):
        self.project("alpha")
        self.project("beta")
        report = bundle.export_bundle(self.output, self.state, [])
        self.assertTrue(report["ok"])
        self.assertEqual(report["projects"], 2)
        catalog = self.catalog()
        self.assertEqual(len({row["project_id"] for row in catalog["projects"]}), 2)
        summaries = []
        for row in catalog["projects"]:
            records = json.loads((self.output / row["folder"] / "records.json").read_text())["records"]
            self.assertEqual(len(records), 1)
            summaries.append(records[0]["summary"])
        self.assertCountEqual(summaries, ["Current behavior for alpha", "Current behavior for beta"])

    def test_missing_root_produces_inspectable_partial_not_success(self):
        self.project("alpha")
        missing, _ = self.project("beta")
        moved = self.base / "moved-beta"
        missing.rename(moved)
        report = bundle.export_bundle(self.output, self.state, [])
        self.assertFalse(report["ok"])
        self.assertFalse(report["export_completed_without_known_gaps"])
        self.assertEqual(report["projects"], 1)
        self.assertEqual(len(report["gaps"]), 1)
        self.assertEqual(report["gaps"][0]["label"], "beta")
        self.assertTrue((moved / "current-fact.txt").is_file())
        self.assertFalse(self.catalog()["export_completed_without_known_gaps"])
        self.check_manifest(self.output)

    def test_stale_current_fact_surfaces_top_level_gap(self):
        root, record = self.project()
        (root / "current-fact.txt").write_text("Changed after capture", encoding="utf-8")
        report = bundle.export_bundle(self.output, self.state, [])
        self.assertFalse(report["ok"])
        stale = report["gaps"][0]["records"]
        self.assertEqual(stale[0]["id"], record["id"])
        self.assertEqual(stale[0]["reason"], "source_changed")
        _, exported = self.exported_project()
        self.assertEqual(exported["records"], [])
        self.assertFalse(self.catalog()["export_completed_without_known_gaps"])

    def test_stale_improvement_evidence_surfaces_gap_and_unusable_count(self):
        root, _ = self.project()
        lesson, evidence = self.lesson(root)
        evidence.write_text("Corrected measurement invalidates the original improvement", encoding="utf-8")
        report = bundle.export_bundle(self.output, self.state, [])
        self.assertFalse(report["ok"])
        gaps = [entry for gap in report["gaps"] for entry in gap.get("records", [])]
        self.assertIn({"id": lesson["id"], "revision": 1, "key": "bounded-batches", "reason": "outcome_evidence_changed_or_missing"}, gaps)
        ledger = memory.Ledger(root)
        try:
            learning = ledger.status()["learning"]
            self.assertEqual(learning["lifecycle_active"], 1)
            self.assertEqual(learning["usable_active"], 0)
            self.assertEqual(ledger.recall("bounded-batches", 20, False)["records"], [])
        finally:
            ledger.db.close()

    def test_negative_learning_is_exported_as_caution_not_active_guidance(self):
        root, _ = self.project()
        lesson, _ = self.lesson(root, harmful=True)
        report = bundle.export_bundle(self.output, self.state, [])
        self.assertTrue(report["ok"])
        folder, exported = self.exported_project()
        self.assertNotIn(lesson["id"], {row["id"] for row in exported["records"]})
        self.assertEqual(len(exported["cautions"]), 1)
        caution = exported["cautions"][0]
        self.assertEqual(caution["id"], lesson["id"])
        self.assertEqual(caution["status"], "suspended")
        self.assertIn("DO_NOT_REAPPLY", caution["instruction_status"])
        outcome = caution["verification"]["outcomes"][0]
        self.assertEqual(outcome["verdict"], "harmful")
        self.assertIn("14 minutes", (folder / outcome["evidence"]["snapshot"]).read_text())

    def test_all_checksums_and_evidence_work_after_old_root_moves(self):
        root, _ = self.project()
        self.lesson(root)
        report = bundle.export_bundle(self.output, self.state, [])
        self.assertTrue(report["ok"])
        root.rename(self.base / "old-source-unavailable")
        self.check_manifest(self.output)
        folder, exported = self.exported_project()
        self.check_manifest(folder)
        snapshots = []

        def visit(value):
            if isinstance(value, dict):
                if "snapshot" in value:
                    snapshots.append(value)
                for nested in value.values():
                    visit(nested)
            elif isinstance(value, list):
                for nested in value:
                    visit(nested)

        visit(exported)
        self.assertGreaterEqual(len(snapshots), 5)
        for source in snapshots:
            self.assertNotIn("path", source)
            self.assertFalse(Path(source["snapshot"]).is_absolute())
            snapshot = folder / source["snapshot"]
            self.assertTrue(snapshot.resolve().is_relative_to(folder))
            self.assertEqual(hashlib.sha256(snapshot.read_bytes()).hexdigest(), source["sha256"])
        self.assertTrue((self.output / "START_HERE.md").is_file())
        self.assertTrue((self.output / "skill/work-memory/SKILL.md").is_file())
        self.assertTrue((self.output / "skill/work-memory/scripts/memory.py").is_file())

    def test_private_database_runtime_and_unrecorded_files_are_not_copied(self):
        root, _ = self.project()
        marker = "UNRECORDED_PRIVATE_FIXTURE_84A2EF"
        (root / "transcript.jsonl").write_text(marker, encoding="utf-8")
        (root / ".env").write_text("UNRECORDED_ENV=" + marker, encoding="utf-8")
        (root / ".work-memory/private-extra.txt").write_text(marker, encoding="utf-8")
        (self.state / "host-receipts.sqlite3").write_text(marker, encoding="utf-8")
        bundle.export_bundle(self.output, self.state, [])
        for path in self.output.rglob("*"):
            if not path.is_file():
                continue
            self.assertNotIn(".work-memory", path.relative_to(self.output).parts)
            self.assertNotIn("__pycache__", path.parts)
            self.assertFalse(path.name.startswith("test_"))
            self.assertNotIn(path.suffix, {".sqlite3", ".db", ".pyc", ".jsonl"})
            self.assertNotIn(marker.encode(), path.read_bytes())
            self.assertEqual(stat.S_IMODE(path.stat().st_mode), 0o600)
        self.assertEqual(stat.S_IMODE(self.output.stat().st_mode), 0o700)

    def test_empty_registry_and_unknown_selector_do_not_create_output(self):
        with self.assertRaises(registry.RegistryError):
            bundle.export_bundle(self.output, self.state, [])
        self.assertFalse(self.output.exists())
        self.project()
        with self.assertRaises(registry.RegistryError):
            bundle.export_bundle(self.output, self.state, ["not-registered"])
        self.assertFalse(self.output.exists())

    def test_cli_partial_export_returns_nonzero_and_machine_readable_gaps(self):
        root, _ = self.project()
        root.rename(self.base / "moved")
        result = subprocess.run(
            [sys.executable, "-B", str(Path(bundle.__file__).resolve()), "--out", str(self.output), "--state-dir", str(self.state)],
            capture_output=True, text=True, check=False,
        )
        self.assertEqual(result.returncode, 2, result.stderr)
        response = json.loads(result.stdout)
        self.assertFalse(response["ok"])
        self.assertEqual(len(response["gaps"]), 1)
        self.assertTrue((self.output / "manifest.json").is_file())


if __name__ == "__main__":
    unittest.main()
