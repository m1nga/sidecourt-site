#!/usr/bin/env python3
"""Require user-perspective and comparable-skill evidence for the exact release inputs."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import subprocess


def git(root, *args):
    return subprocess.check_output(['git', '-C', str(root), *args])


def read(root, path, committed=False):
    return git(root, 'show', 'HEAD:' + path) if committed else (Path(root) / path).read_bytes()


def fingerprint(root, skill, committed=False):
    if not re.fullmatch(r'[a-z0-9]+(?:-[a-z0-9]+)*', skill):
        raise ValueError('invalid skill identifier')
    products = json.loads(read(root, 'products.json', committed))['products']
    matches = [p for p in products if p.get('name') == skill]
    if len(matches) != 1:
        raise ValueError('exactly one product entry required')
    if committed:
        paths = git(root, 'ls-tree', '-r', '--name-only', '-z', 'HEAD', '--', skill).decode().split('\0')
    else:
        paths = git(root, 'ls-files', '--cached', '--others', '--exclude-standard', '-z', '--', skill).decode().split('\0')
    paths = sorted(set(p for p in paths if p))
    if skill + '/SKILL.md' not in paths:
        raise ValueError('skill source missing')
    digest = hashlib.sha256(json.dumps(matches[0], sort_keys=True, ensure_ascii=False).encode())
    for path in paths:
        content = read(root, path, committed)
        digest.update(path.encode() + b'\0' + content + b'\0')
    return digest.hexdigest()


def check(root, skill, committed=False):
    try:
        sha = fingerprint(root, skill, committed)
        policy = json.loads(read(root, 'ops/skill-quality/baseline.json', committed))
        if policy.get('legacy_unchanged', {}).get(skill) == sha:
            return [], 'legacy-unchanged'
        receipt = json.loads(read(root, 'ops/skill-quality/reviews/' + skill + '.json', committed))
        errors = []
        if receipt.get('schema_version') != 1 or receipt.get('skill') != skill:
            errors.append('wrong review identity/schema')
        if receipt.get('source_sha256') != sha:
            errors.append('review is stale: source or product metadata changed')
        if not receipt.get('reviewed_at'):
            errors.append('missing review date')
        user = receipt.get('user_review', {})
        cases = user.get('scenarios', [])
        if not user.get('method') or len(cases) < 2:
            errors.append('user-perspective review needs method and at least two scenarios')
        for case in cases:
            if not all(isinstance(case.get(k), str) and case[k].strip() for k in ('request', 'expected', 'observed')):
                errors.append('incomplete user scenario')
            if case.get('kind') not in ('executed', 'simulated') or case.get('result') not in ('pass', 'fixed'):
                errors.append('unresolved or unlabelled user scenario')
        comparisons = receipt.get('similar_skills', [])
        if not comparisons:
            errors.append('missing comparable-skill research')
        for item in comparisons:
            if not all(isinstance(item.get(k), str) and item[k].strip() for k in ('url', 'checked_at', 'learned', 'reason')):
                errors.append('incomplete comparable-skill evidence')
            if not item.get('url', '').startswith(('https://', 'http://')):
                errors.append('comparable source needs an inspectable URL')
            if item.get('decision') not in ('adopt', 'adapt', 'reject'):
                errors.append('record what was adopted, adapted or rejected')
        validation = receipt.get('validation', [])
        if not validation or any(not x.get('command') or x.get('result') != 'pass' or not x.get('observed') for x in validation):
            errors.append('missing successful validation evidence')
        if receipt.get('unresolved_blockers') != []:
            errors.append('release blockers are unresolved or unrecorded')
        return errors, 'reviewed'
    except (OSError, ValueError, KeyError, TypeError, AttributeError, subprocess.CalledProcessError) as error:
        return ['quality review unavailable: ' + str(error)], 'missing'


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('registry', type=Path)
    parser.add_argument('skill')
    parser.add_argument('--committed', action='store_true')
    parser.add_argument('--fingerprint', action='store_true')
    args = parser.parse_args()
    if args.fingerprint:
        print(fingerprint(args.registry, args.skill, args.committed))
        return 0
    errors, state = check(args.registry, args.skill, args.committed)
    print('\n'.join(errors) if errors else f'Quality gate passed: {args.skill} ({state})')
    return bool(errors)


if __name__ == '__main__':
    raise SystemExit(main())
