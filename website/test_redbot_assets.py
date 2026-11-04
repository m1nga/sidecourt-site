import hashlib
import io
import json
import pathlib
import tempfile
import unittest
from unittest.mock import patch
from redbot_assets import ensure_redbot_runtime, PINNED_URL, WASM


class RedBotRuntimeTests(unittest.TestCase):
    def fixture(self, directory):
        root = pathlib.Path(directory) / 'website'
        app = root / 'redbot/app'
        vendor = app / 'vendor/transformers'
        vendor.mkdir(parents=True)
        data = b'\0asm-pinned-runtime'
        expected = {'sha256': hashlib.sha256(data).hexdigest(), 'bytes': len(data)}
        (vendor / 'assets.lock.json').write_text(json.dumps({WASM.rsplit('/', 1)[1]: expected}))
        (app / 'APP-SOURCE.json').write_text(json.dumps({'external_build_resources': {WASM: dict(expected, url=PINNED_URL)}}))
        return root, pathlib.Path(directory) / '_site', data

    def test_missing_runtime_downloads_and_verifies(self):
        with tempfile.TemporaryDirectory() as directory:
            root, out, data = self.fixture(directory)
            with patch('redbot_assets.urllib.request.urlopen', return_value=io.BytesIO(data)) as request:
                result = ensure_redbot_runtime(root, out)
            self.assertEqual(result.read_bytes(), data)
            request.assert_called_once_with(PINNED_URL, timeout=180)

    def test_same_size_corrupt_runtime_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root, out, data = self.fixture(directory)
            with patch('redbot_assets.urllib.request.urlopen', return_value=io.BytesIO(b'x' * len(data))):
                with self.assertRaisesRegex(AssertionError, 'checksum mismatch'):
                    ensure_redbot_runtime(root, out)

    def test_truncated_runtime_fails(self):
        with tempfile.TemporaryDirectory() as directory:
            root, out, data = self.fixture(directory)
            with patch('redbot_assets.urllib.request.urlopen', return_value=io.BytesIO(data[:-1])):
                with self.assertRaisesRegex(AssertionError, 'size mismatch'):
                    ensure_redbot_runtime(root, out)

    def test_unpinned_resource_fails_before_download(self):
        with tempfile.TemporaryDirectory() as directory:
            root, out, data = self.fixture(directory)
            path = root / 'redbot/app/APP-SOURCE.json'
            source = json.loads(path.read_text())
            source['external_build_resources'][WASM]['url'] = 'https://example.com/latest.wasm'
            path.write_text(json.dumps(source))
            with patch('redbot_assets.urllib.request.urlopen') as request:
                with self.assertRaisesRegex(AssertionError, 'provenance mismatch'):
                    ensure_redbot_runtime(root, out)
                request.assert_not_called()


if __name__ == '__main__':
    unittest.main()
