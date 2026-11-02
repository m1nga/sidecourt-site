#!/usr/bin/env python3
"""Verify the bundled wheel and run its CLI in a project-local environment."""
import argparse
import hashlib
import json
import os
from pathlib import Path
import subprocess
import sys
import venv


def digest(path):
    result = hashlib.sha256()
    with path.open('rb') as stream:
        for part in iter(lambda: stream.read(1024 * 1024), b''):
            result.update(part)
    return result.hexdigest()


def _run(command, environment):
    result = subprocess.run(command, env=environment, capture_output=True, text=True)
    if result.returncode:
        # Do not echo package-index URLs, environment values, or credentials.
        raise RuntimeError('Runtime installation failed (exit ' + str(result.returncode) + '); verify Python, network/package access, then rerun this bootstrap')
    return result.stdout


def main():
    parser = argparse.ArgumentParser(description='Install and run the checksum-pinned Podcast Revival runtime')
    parser.add_argument('--project', required=True)
    parser.add_argument('--install-only', action='store_true')
    parser.add_argument('--no-deps', action='store_true', help='Isolated package/CLI validation only; not a full media setup')
    parser.add_argument('command', nargs=argparse.REMAINDER)
    args = parser.parse_args()
    try:
        if sys.version_info < (3, 10):
            raise ValueError('Python 3.10 or newer is required')
        skill = Path(__file__).resolve().parents[1]
        manifest = json.loads((skill / 'assets' / 'runtime.json').read_text(encoding='utf-8'))
        filename, checksum, version = (manifest.get(k) for k in ('wheel_filename', 'sha256', 'version'))
        if not filename or not checksum or not version:
            raise ValueError('This skill package has no bound release wheel; obtain a completed release containing assets/runtime.json and its verified wheel')
        if Path(filename).name != filename or not filename.endswith('.whl'):
            raise ValueError('Runtime manifest contains an invalid wheel filename')
        wheel = skill / 'assets' / filename
        if not wheel.is_file() or digest(wheel) != checksum:
            raise ValueError('Bundled wheel is missing or its checksum differs; restore the matching released package before running')
        folder = Path(args.project).expanduser().resolve()
        folder.mkdir(parents=True, exist_ok=True)
        runtime = folder / '.podcast-revival' / ('runtime-' + checksum[:12])
        marker = runtime / 'runtime.json'
        python = runtime / ('Scripts/python.exe' if os.name == 'nt' else 'bin/python')
        environment = dict(os.environ)
        environment.pop('PYTHONPATH', None)
        expected = dict(wheel_sha256=checksum, version=version, distribution=manifest.get('distribution', 'podcast-revival'))
        state = json.loads(marker.read_text()) if marker.exists() else None
        if runtime.exists() and not state:
            raise ValueError('Unrecognized existing runtime directory preserved; choose another project directory')
        if state and any(state.get(k) != v for k, v in expected.items()):
            raise ValueError('Existing runtime identity differs; preserved without modification')
        needs_install = not state or state.get('status') != 'ready' or not python.is_file() or (not args.no_deps and not state.get('dependencies_installed'))
        if needs_install:
            runtime.mkdir(parents=True, exist_ok=True)
            marker.write_text(json.dumps(dict(expected, status='installing', dependencies_installed=False)), encoding='utf-8')
            try:
                if not python.is_file():
                    venv.EnvBuilder(with_pip=True).create(runtime)
                command = [str(python), '-m', 'pip', 'install', '--disable-pip-version-check']
                if args.no_deps:
                    command.append('--no-deps')
                _run(command + [str(wheel)], environment)
                found = _run([str(python), '-c', 'from importlib.metadata import version; print(version("podcast-revival"))'], environment).strip()
                if found != version:
                    raise ValueError('Installed runtime version differs from the bound wheel')
                marker.write_text(json.dumps(dict(expected, status='ready', dependencies_installed=not args.no_deps)), encoding='utf-8')
            except Exception:
                marker.write_text(json.dumps(dict(expected, status='failed', dependencies_installed=False)), encoding='utf-8')
                raise
        if args.install_only:
            print(json.dumps(dict(status='installed', version=version, runtime=str(runtime), dependencies_installed=not args.no_deps)))
            return
        command = args.command[1:] if args.command and args.command[0] == '--' else args.command
        if not command:
            command = ['--help']
        completed = subprocess.run([str(python), '-m', 'revival'] + command, cwd=folder, env=environment)
        raise SystemExit(completed.returncode)
    except (OSError, ValueError, RuntimeError) as exc:
        parser.exit(2, 'Runtime unavailable: ' + str(exc) + '\n')


if __name__ == '__main__':
    main()
