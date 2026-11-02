"""Actual isolated installation of a clearly synthetic wheel; no paid/network calls.

This validates the bootstrap mechanism, not the final product wheel or media.
The final bound product receives its own isolated release verification.
"""
import hashlib
import json
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
import unittest
import zipfile

SKILL = Path(__file__).resolve().parents[1]


@unittest.skipUnless(sys.version_info >= (3, 10), "Bootstrap install tests require supported Python 3.10+")
class BootstrapTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory(prefix='podcast-revival-bootstrap-test-')
        self.root = Path(self.temp.name)
        self.skill = self.root / 'installed skill'
        shutil.copytree(SKILL / 'scripts', self.skill / 'scripts')
        (self.skill / 'assets').mkdir()
        self.project = self.root / 'project with spaces'
    def tearDown(self):
        self.temp.cleanup()
    def manifest(self, value):
        (self.skill / 'assets/runtime.json').write_text(json.dumps(value))
    def invoke(self, *args):
        return subprocess.run([sys.executable, str(self.skill / 'scripts/bootstrap.py'), '--project', str(self.project), *args],
                              capture_output=True, text=True, cwd=self.root, timeout=120)
    def fixture_wheel(self):
        wheel = self.skill / 'assets/podcast_revival-0.0.0-py3-none-any.whl'
        with zipfile.ZipFile(wheel, 'w') as archive:
            archive.writestr('revival/__init__.py', '')
            archive.writestr('revival/__main__.py', 'print("synthetic_fixture CLI smoke; no media or API calls")\n')
            archive.writestr('podcast_revival-0.0.0.dist-info/METADATA', 'Metadata-Version: 2.1\nName: podcast-revival\nVersion: 0.0.0\n')
            archive.writestr('podcast_revival-0.0.0.dist-info/WHEEL', 'Wheel-Version: 1.0\nGenerator: synthetic-test\nRoot-Is-Purelib: true\nTag: py3-none-any\n')
            archive.writestr('podcast_revival-0.0.0.dist-info/RECORD', '')
        self.manifest(dict(wheel_filename=wheel.name, sha256=hashlib.sha256(wheel.read_bytes()).hexdigest(), version='0.0.0', distribution='podcast-revival'))
        return wheel
    def test_missing_release_wheel_is_honest_block_without_writes(self):
        self.manifest(dict(wheel_filename=None, sha256=None, version=None))
        result = self.invoke('--install-only')
        self.assertEqual(result.returncode, 2)
        self.assertIn('no bound release wheel', result.stderr)
        self.assertFalse(self.project.exists())
    def test_tampered_wheel_never_installs(self):
        wheel = self.fixture_wheel()
        wheel.write_bytes(wheel.read_bytes() + b'tampered')
        result = self.invoke('--no-deps', '--install-only')
        self.assertEqual(result.returncode, 2)
        self.assertIn('checksum', result.stderr)
        self.assertFalse(self.project.exists())
    def test_actual_isolated_install_from_other_directory_and_reuse(self):
        self.fixture_wheel()
        result = self.invoke('--no-deps', '--install-only')
        self.assertEqual(result.returncode, 0, result.stderr)
        report = json.loads(result.stdout)
        self.assertEqual(report['version'], '0.0.0')
        self.assertFalse(report['dependencies_installed'])
        runtime = Path(report['runtime'])
        marker_before = (runtime / 'runtime.json').stat().st_mtime_ns
        repeated = self.invoke('--no-deps', '--', '--help')
        self.assertEqual(repeated.returncode, 0, repeated.stderr)
        self.assertIn('synthetic_fixture', repeated.stdout)
        self.assertEqual((runtime / 'runtime.json').stat().st_mtime_ns, marker_before)
        self.assertTrue(runtime.is_relative_to(self.project.resolve()))
    def test_unowned_existing_runtime_is_preserved(self):
        self.fixture_wheel()
        manifest = json.loads((self.skill / 'assets/runtime.json').read_text())
        runtime = self.project / '.podcast-revival' / ('runtime-' + manifest['sha256'][:12])
        runtime.mkdir(parents=True)
        valuable = runtime / 'keep.txt'
        valuable.write_text('existing work')
        result = self.invoke('--no-deps', '--install-only')
        self.assertEqual(result.returncode, 2)
        self.assertEqual(valuable.read_text(), 'existing work')


if __name__ == '__main__':
    unittest.main()
