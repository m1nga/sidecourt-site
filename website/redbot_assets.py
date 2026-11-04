"""Materialize the pinned public RedBot runtime in the Pages build output."""
import hashlib
import json
import urllib.request

WASM = 'vendor/transformers/ort-wasm-simd-threaded.jsep.wasm'
PINNED_URL = 'https://raw.githubusercontent.com/m1nga/skills/278e12261fd7f4fefc2a632138665510ccbcad6e/redbot/product-root/source/app/vendor/transformers/ort-wasm-simd-threaded.jsep.wasm'


def ensure_redbot_runtime(root, out):
    app = root / 'redbot/app'
    expected = json.loads((app / 'vendor/transformers/assets.lock.json').read_text())[WASM.rsplit('/', 1)[1]]
    resource = json.loads((app / 'APP-SOURCE.json').read_text())['external_build_resources'][WASM]
    assert resource == {'url': PINNED_URL, 'sha256': expected['sha256'], 'bytes': expected['bytes']}, 'RedBot runtime provenance mismatch'
    destination = out / 'drops/redbot/app' / WASM
    destination.parent.mkdir(parents=True, exist_ok=True)
    if not destination.exists():
        with urllib.request.urlopen(PINNED_URL, timeout=180) as response:
            with destination.open('wb') as output:
                while True:
                    chunk = response.read(1024 * 1024)
                    if not chunk:
                        break
                    output.write(chunk)
    assert destination.stat().st_size == expected['bytes'], 'RedBot runtime size mismatch'
    assert hashlib.sha256(destination.read_bytes()).hexdigest() == expected['sha256'], 'RedBot runtime checksum mismatch'
    print('Verified pinned RedBot runtime', expected['bytes'], flush=True)
    return destination
