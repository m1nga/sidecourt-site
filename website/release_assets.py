"""Fetch immutable release assets with build-time credentials, including drafts.

Never put credentials in generated files or logs. Public visitors use Pages only.
"""
import hashlib
import json
import pathlib
import subprocess
import time

REPO = 'repos/m1nga/cleanpause'

def fetch_asset(entry, destination):
    release_id = int(entry['release_id'])
    release = json.loads(subprocess.check_output(['gh', 'api', f'{REPO}/releases/{release_id}?verify={time.time_ns()}'], text=True))
    name = entry.get('asset_name', pathlib.Path(entry['destination']).name)
    matches = [a for a in release['assets'] if a['name'] == name]
    assert len(matches) == 1, f'Expected one asset: {name}'
    asset = matches[0]
    assert asset['state'] == 'uploaded' and asset['size'] == entry['size'], name
    assert asset['digest'] == 'sha256:' + entry['sha256'], name
    destination = pathlib.Path(destination)
    with destination.open('wb') as output:
        subprocess.run(['gh', 'api', f'{REPO}/releases/assets/{int(asset["id"])}', '-H', 'Accept: application/octet-stream'], stdout=output, check=True)
    assert destination.stat().st_size == entry['size'], name
    assert hashlib.sha256(destination.read_bytes()).hexdigest() == entry['sha256'], name
    return destination
