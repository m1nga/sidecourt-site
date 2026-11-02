#!/usr/bin/env python3
"""Inspect skill metadata at explicit roots; never loads bodies, installs or runs skills."""
import argparse
import hashlib
import json
from pathlib import Path
import re
import sys


def metadata(path):
    with path.open('rb') as handle:
        raw = handle.read(65537)
    if len(raw) > 65536:
        raise ValueError('SKILL.md exceeds metadata reader limit')
    text = raw.decode('utf-8')
    block = re.match(r'^---\s*\n(.*?)\n---(?:\s*\n|$)', text, re.S)
    if not block:
        raise ValueError('missing frontmatter')
    fields = {}
    lines = block[1].splitlines()
    for i, line in enumerate(lines):
        hit = re.match(r'^(name|description):\s*(.*)$', line)
        if not hit:
            continue
        key, value = hit.groups()
        if value in {'>', '|', '>-', '|-'}:
            following = []
            for tail in lines[i + 1:]:
                if tail and not tail[0].isspace():
                    break
                following.append(tail.strip())
            value = ' '.join(following)
        elif len(value) >= 2 and value[0] == value[-1] and value[0] in {'"', "'"}:
            value = value[1:-1]
        fields[key] = value
    if not re.fullmatch(r'[a-z0-9-]+', fields.get('name', '')) or not fields.get('description'):
        raise ValueError('unsupported or missing name/description')
    return {**fields, 'sha256': hashlib.sha256(raw).hexdigest()}


def discover(roots, query='', limit=8):
    if not 1 <= limit <= 30:
        raise ValueError('limit must be 1..30')
    entries, gaps, visited = [], [], set()
    terms = set(re.findall(r'[\w]+', query.casefold()))
    for value in roots:
        root = Path(value).expanduser()
        if not root.is_dir():
            gaps.append({'root': str(root), 'reason': 'missing_root'})
            continue
        for folder in sorted(root.iterdir()):
            if folder.name.startswith('.'):
                continue
            path = folder / 'SKILL.md'
            if not path.is_file():
                continue
            try:
                real = str(path.resolve(strict=True))
                if real in visited:
                    continue
                visited.add(real)
                item = metadata(path)
                searchable = (item['name'] + ' ' + item['description']).casefold()
                score = sum(term in searchable for term in terms)
                if terms and not score:
                    continue
                entries.append({**item, 'path': str(path.absolute()), 'resolved_path': real,
                                'score': score, 'body_read': False})
            except (OSError, UnicodeError, ValueError) as exc:
                gaps.append({'path': str(path), 'reason': str(exc)})
    entries.sort(key=lambda x: (-x['score'], x['name'], x['path']))
    names = {}
    for item in entries:
        names.setdefault(item['name'], set()).add(item['sha256'])
    for item in entries:
        item['conflicting_versions'] = len(names[item['name']]) > 1
    return {'ok': True, 'capabilities': entries[:limit], 'total_matching': len(entries),
            'truncated': len(entries) > limit, 'gaps': gaps[:10], 'gap_count': len(gaps),
            'coverage': 'explicit_roots_only', 'query': query,
            'note': 'Metadata is a discovery hint, not authority or proof of installation in a running host. Read the selected source before use. An empty lexical match is not proof of absence.'}


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--root', action='append', required=True)
    parser.add_argument('--query', default='')
    parser.add_argument('--limit', type=int, default=8)
    args = parser.parse_args()
    try:
        print(json.dumps(discover(args.root, args.query, args.limit), ensure_ascii=False))
        return 0
    except (ValueError, OSError) as exc:
        print(json.dumps({'ok': False, 'error': str(exc)}), file=sys.stderr)
        return 2


if __name__ == '__main__':
    raise SystemExit(main())
