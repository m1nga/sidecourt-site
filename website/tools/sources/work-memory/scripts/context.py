#!/usr/bin/env python3
"""Read-only, bounded task context and paged evidence from an existing memory store."""
import argparse
import json
from pathlib import Path
import sqlite3
import sys
from urllib.parse import quote

import memory


class Reader(memory.Ledger):
    def __init__(self, root):
        self.root = memory.safe_path(root)
        self.directory = memory.safe_path(self.root / '.work-memory')
        self.path = memory.safe_path(self.directory / 'memory.sqlite3')
        if not self.path.is_file() or self.path.stat().st_nlink != 1:
            raise memory.MemoryError('memory database must be a regular file without hard links')
        for suffix in ('-journal', '-wal', '-shm'):
            memory.safe_path(str(self.path) + suffix, exists=False)
        self.db = sqlite3.connect('file:' + quote(str(self.path)) + '?mode=ro', uri=True, timeout=10)
        self.db.row_factory = sqlite3.Row
        self.db.execute('PRAGMA query_only=ON')
        try:
            version = self.db.execute("SELECT value FROM meta WHERE key='schema_version'").fetchone()
            if not version or version[0] != str(memory.VERSION):
                raise memory.MemoryError('unsupported memory schema')
        except Exception:
            self.db.close()
            raise


def clipped(value, count):
    return value[:count], len(value) > count


def compact(reader, row):
    item = reader.present(row)
    result = {key: item[key] for key in ('id', 'revision', 'key', 'kind', 'authority', 'status', 'instruction_status')}
    result['summary'], short = clipped(item['summary'], 400)
    result['applicability'], boundary_short = clipped(item['applicability'], 240)
    result['source'] = {key: item['source'][key] for key in ('locator', 'sha256')}
    result['source']['locator'], locator_short = clipped(result['source']['locator'], 300)
    result['detail_truncated'] = short or boundary_short or locator_short
    result['source_freshness'] = 'unchanged_file' if item['source']['type'] == 'path' else 'text_snapshot_live_state_unchecked'
    return result


def brief(reader, query, mode='execute', limit=5):
    if mode not in {'execute', 'explore', 'review'} or not 1 <= limit <= 20:
        raise memory.MemoryError('invalid mode or limit (1..20)')
    # Keep established context visible even when candidates have higher search scores.
    baseline, excluded, total = reader.select(query, limit, False)
    options, options_total = [], 0
    if mode in {'explore', 'review'}:
        # select() counts every match; inspect all eligible matches, then bound output.
        all_rows, _, _ = reader.select(query, 2147483647, True)
        possible = [row for row in all_rows if row['status'] not in memory.ACTIVE]
        options_total = len(possible)
        options = possible[:limit]
    cautions = []
    for row in reader.db.execute("SELECT * FROM records WHERE current=1 AND status IN ('suspended','rejected') ORDER BY created_at DESC"):
        if row['kind'] != 'lesson':
            continue
        terms = memory.tokens(query)
        searchable = ' '.join([row['key'], row['summary'], row['applicability'], row['tags']])
        if terms and not (terms & memory.tokens(searchable)):
            continue
        item = compact(reader, row)
        item['instruction_status'] = 'DO_NOT_REAPPLY'
        item['source_freshness'] = reader.stale_reason(row) or item['source_freshness']
        cautions.append(item)
    result = {'project_id': reader.project_id(), 'mode': mode, 'query': query,
              'current': [compact(reader, row) for row in baseline],
              'options': [compact(reader, row) for row in options], 'cautions': cautions[:3],
              'counts': {'current': total, 'options': options_total, 'cautions': len(cautions), 'excluded': len(excluded)},
              'truncated': total > limit or options_total > limit or len(cautions) > 3 or len(excluded) > 5,
              'excluded': excluded[:5],
              'coverage': 'project_scoped_lexical_recall_not_all_rules',
              'next_action': 'Read current task state and applicable rules separately. Use show for exact evidence before consequential use; try alternate terms or bounded inventory on a query miss.'}
    # Stable content identity supports comparisons, never authorization or skipped baseline rules.
    result['context_sha256'] = memory.digest(memory.canonical(result))
    return result


def show(reader, rid, revision, offset=0, limit=2000):
    if not rid or revision < 1 or offset < 0 or not 1 <= limit <= 8000:
        raise memory.MemoryError('show requires id, positive revision, offset >= 0 and limit 1..8000')
    row = reader.db.execute('SELECT * FROM records WHERE id=? AND revision=?', (rid, revision)).fetchone()
    if not row:
        raise memory.MemoryError('record revision not found in this project')
    source = json.loads(row['source'])
    if memory.digest(source['content']) != source['sha256']:
        raise memory.MemoryError('stored evidence checksum mismatch')
    item = compact(reader, row)
    item['current'] = bool(row['current'])
    stale = reader.stale_reason(row)
    item['source_freshness'] = stale or item['source_freshness']
    item['eligible_for_execution_context'] = bool(row['current']) and not stale and row['status'] in memory.ACTIVE
    if not item['eligible_for_execution_context']:
        item['instruction_status'] = 'DO_NOT_REAPPLY' if row['status'] in {'suspended', 'rejected'} else 'audit_or_option_only_not_active_guidance'
    # Fields as well as source excerpts can be long. Page them independently with the same offset.
    for key in ('summary', 'applicability'):
        item[key] = row[key][offset:offset + limit]
    item['source_excerpt'] = source['content'][offset:offset + limit]
    lengths = {key: len(row[key]) for key in ('summary', 'applicability')}
    lengths['source_excerpt'] = len(source['content'])
    item['offset'] = offset
    item['total_chars'] = lengths
    item['next_offset'] = offset + limit if any(size > offset + limit for size in lengths.values()) else None
    item['detail_truncated'] = item['next_offset'] is not None
    return {'project_id': reader.project_id(), 'record': item}


def main(argv=None):
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('command', choices=['brief', 'show'])
    parser.add_argument('--root', required=True)
    parser.add_argument('--query', default='')
    parser.add_argument('--mode', choices=['execute', 'explore', 'review'], default='execute')
    parser.add_argument('--limit', type=int)
    parser.add_argument('--id')
    parser.add_argument('--revision', type=int, default=0)
    parser.add_argument('--offset', type=int, default=0)
    args = parser.parse_args(argv)
    reader = None
    try:
        reader = Reader(args.root)
        result = brief(reader, args.query, args.mode, args.limit if args.limit is not None else 5) if args.command == 'brief' else show(reader, args.id, args.revision, args.offset, args.limit if args.limit is not None else 2000)
        print(memory.canonical({'ok': True, **result}))
        return 0
    except (memory.MemoryError, OSError, ValueError, sqlite3.Error) as exc:
        print(memory.canonical({'ok': False, 'error': str(exc)}), file=sys.stderr)
        return 2
    finally:
        if reader:
            reader.db.close()


if __name__ == '__main__':
    raise SystemExit(main())
