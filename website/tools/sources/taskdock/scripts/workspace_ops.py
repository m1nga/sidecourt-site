"""Optional local evidence and reversible organization. Python standard library.

No background work, inferred approval, recursive directory moves or external writes.
Plans preserve byte preimages; transaction locks coordinate TaskDock processes only.
"""
import hashlib
import json
import os
from pathlib import Path, PurePosixPath
import re
import stat
import uuid
from contextlib import contextmanager
from urllib.parse import unquote, quote, urlsplit

CONTROL = {'TASK.json', 'README.md', 'STATE.md', 'PLAN.md', 'AGENTS.md', 'INDEX.md'}
SKIP = {'.git', '.taskdock', 'node_modules', '.venv', 'venv', '__pycache__', '.next', '.cache'}
TEXT = {'.md', '.html', '.htm', '.css', '.svg'}
LIMIT = 2 * 1024 * 1024


def digest(data):
    return hashlib.sha256(data).hexdigest()


def file_hash(path):
    h = hashlib.sha256()
    with path.open('rb') as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b''):
            h.update(chunk)
    return h.hexdigest()


def safe(root, name, internal=False):
    if not isinstance(name, str) or not name or '\\' in name:
        raise ValueError('Use a nonempty relative POSIX file path')
    rel = PurePosixPath(name)
    if rel.is_absolute() or '..' in rel.parts or name != rel.as_posix():
        raise ValueError('Path must stay inside the task: ' + name)
    if not internal and any(part in SKIP for part in rel.parts):
        raise ValueError('Protected directory: ' + name)
    here = root
    for index, part in enumerate(rel.parts):
        here = here / part
        if index < len(rel.parts) - 1 and here.exists() and not here.is_dir():
            raise ValueError('Parent path is not a directory: ' + name)
        if here.is_symlink():
            raise ValueError('Symlink path is not writable: ' + name)
        if here.is_dir() and here != root and (here / '.git').exists():
            raise ValueError('Nested repository is outside this operation: ' + name)
    return root / name


def atomic(path, data, mode=0o600):
    path.parent.mkdir(parents=True, exist_ok=True)
    temp = path.with_name('.' + path.name + '.' + uuid.uuid4().hex + '.tmp')
    try:
        with temp.open('xb') as f:
            f.write(data)
            f.flush()
            os.fsync(f.fileno())
        os.chmod(temp, mode)
        os.replace(temp, path)
    finally:
        if temp.exists():
            temp.unlink()


def save(path, obj):
    atomic(path, (json.dumps(obj, ensure_ascii=False, indent=2) + '\n').encode())


@contextmanager
def lock(root):
    base = safe(root, '.taskdock', internal=True)
    base.mkdir(exist_ok=True)
    path = safe(root, '.taskdock/write.lock', internal=True)
    with path.open('a+b') as f:
        if os.name == 'nt':
            import msvcrt
            if f.tell() == 0:
                f.write(b'0'); f.flush()
            f.seek(0)
            try:
                msvcrt.locking(f.fileno(), msvcrt.LK_NBLCK, 1)
            except OSError:
                raise ValueError('Another TaskDock write is in progress')
        else:
            import fcntl
            try:
                fcntl.flock(f, fcntl.LOCK_EX | fcntl.LOCK_NB)
            except OSError:
                raise ValueError('Another TaskDock write is in progress')
        try:
            yield
        finally:
            if os.name == 'nt':
                f.seek(0); msvcrt.locking(f.fileno(), msvcrt.LK_UNLCK, 1)
            else:
                fcntl.flock(f, fcntl.LOCK_UN)


def scan(root, max_files=10000):
    files, excluded = [], []
    for folder, dirs, names in os.walk(root, followlinks=False):
        for d in list(dirs):
            p = Path(folder) / d
            if d in SKIP or p.is_symlink() or (p / '.git').exists():
                dirs.remove(d)
                excluded.append(p.relative_to(root).as_posix())
        for n in sorted(names):
            p = Path(folder) / n
            if p.is_symlink() or not p.is_file():
                excluded.append(p.relative_to(root).as_posix()); continue
            if len(files) >= max_files:
                raise ValueError('Inventory limit reached; narrow the task before planning')
            files.append(p)
    return sorted(files), sorted(excluded)


def references(text, suffix):
    """Return precise URL spans; fenced Markdown examples are deliberately ignored."""
    if suffix == '.md':
        masked = re.sub(r'(?ms)^```[^\n]*\n.*?^```[^\n]*$', lambda m: ' ' * len(m[0]), text)
        pattern = r'!?\[[^\]\n]*\]\((?:<(?P<angle>[^>]+)>|(?P<plain>[^\s)]+))(?:\s+"[^"\n]*")?\)'
        for m in re.finditer(pattern, masked):
            k = 'angle' if m['angle'] is not None else 'plain'
            yield m.start(k), m.end(k), m[k]
    if suffix in {'.html', '.htm', '.svg'}:
        for m in re.finditer(r'\b(?:src|href)\s*=\s*([\'"])(.*?)\1', text):
            yield m.start(2), m.end(2), m[2]
    if suffix in {'.css', '.html', '.htm', '.svg'}:
        for m in re.finditer(r'url\(\s*([\'"]?)([^)\'"\n]+?)\1\s*\)', text):
            yield m.start(2), m.end(2), m[2]


def target(root, name, url):
    if not url or url.startswith(('#', '/', '//')) or urlsplit(url).scheme:
        return None
    core = re.split(r'[?#]', url, maxsplit=1)[0]
    if not core:
        return None
    p = (root / name).parent / unquote(core)
    try:
        return p.resolve().relative_to(root.resolve()).as_posix()
    except ValueError:
        return None


def inventory(root):
    files, excluded = scan(root)
    entries, groups, links = [], {}, []
    for p in files:
        name = p.relative_to(root).as_posix()
        h = file_hash(p)
        entries.append({'path': name, 'bytes': p.stat().st_size, 'sha256': h})
        groups.setdefault(h, []).append(name)
        if p.suffix in TEXT and p.stat().st_size <= LIMIT:
            try:
                text = p.read_text(encoding='utf-8')
            except UnicodeDecodeError:
                continue
            for _, _, url in references(text, p.suffix):
                t = target(root, name, url)
                if t:
                    links.append({'from': name, 'to': t, 'exists': (root / t).is_file() or (root / t).is_dir()})
    return {'status': 'inventoried', 'files': entries, 'identical_content': [v for v in groups.values() if len(v) > 1],
            'references': links, 'excluded': excluded,
            'coverage': 'Local files and common inline Markdown, HTML src/href and CSS url references. Dynamic, root-relative, absolute, cloud and Office references require separate review. Equal content does not mean redundant purpose.'}


def artifact_path(root):
    return safe(root, '.taskdock/artifacts.json', internal=True)


def artifacts(root):
    p = artifact_path(root)
    if not p.exists():
        return {'schema': 'taskdock-artifacts/v1', 'items': {}}
    obj = json.loads(p.read_text(encoding='utf-8'))
    if obj.get('schema') != 'taskdock-artifacts/v1' or not isinstance(obj.get('items'), dict):
        raise ValueError('Invalid artifact record')
    return obj


def record(root, task_id, spec):
    if not isinstance(spec, dict) or not isinstance(spec.get('items'), list):
        raise ValueError('Artifact spec needs an items array')
    with lock(root):
        obj = artifacts(root)
        for item in spec['items']:
            if not isinstance(item, dict) or not re.fullmatch(r'[a-zA-Z0-9_-]+', str(item.get('id', ''))):
                raise ValueError('Each artifact needs a stable id')
            p = safe(root, item['path'])
            if not p.is_file():
                raise ValueError('Artifact missing: ' + item['path'])
            if item.get('role') not in {'source', 'working', 'runtime', 'delivery', 'reference', 'history'}:
                raise ValueError('Artifact role must describe its purpose')
            if item.get('decision') not in {'proposed', 'approved', 'rejected', 'superseded', 'unknown'}:
                raise ValueError('Decision state required; use unknown when unverified')
            if not isinstance(item.get('evidence'), str) or not item['evidence'].strip():
                raise ValueError('Describe the evidence, including uncertainty')
            if not isinstance(item.get('used_in', []), list) or not all(isinstance(v, str) for v in item.get('used_in', [])):
                raise ValueError('used_in must be a list of version or context labels')
            if not isinstance(item.get('replaces', []), list) or not all(isinstance(v, str) for v in item.get('replaces', [])):
                raise ValueError('replaces must be a list of artifact IDs')
            obj['items'][item['id']] = {**item, 'task_id': task_id, 'sha256': file_hash(p)}
        # Keep facts from the spec, not guessed approval from what happens to be used.
        save(artifact_path(root), obj)
    return {'status': 'recorded', 'count': len(spec['items']), 'path': '.taskdock/artifacts.json'}


def reconcile(root):
    rows, warnings = [], []
    obj = artifacts(root)
    for identity, a in obj['items'].items():
        p = safe(root, a['path'])
        state = 'missing' if not p.is_file() else ('unchanged' if file_hash(p) == a['sha256'] else 'changed')
        rows.append({**a, 'id': identity, 'file_state': state})
        if state != 'unchanged':
            warnings.append(identity + ': ' + state + '; review recorded evidence')
        if a.get('used_in') and a['decision'] in {'rejected', 'superseded'}:
            warnings.append(identity + ': still used in a recorded context despite decision=' + a['decision'])
        for old in a.get('replaces', []):
            if old not in obj['items']:
                warnings.append(identity + ': unknown replaced artifact ' + old)
    return {'status': 'attention' if warnings else 'pass', 'artifacts': rows, 'warnings': warnings,
            'coverage': 'Compares explicitly recorded facts with local content. Does not infer approval, deployment or semantic correctness of prose.'}


def snapshot(path):
    if not path.exists():
        return None
    if not path.is_file() or path.is_symlink():
        raise ValueError('Expected an ordinary file: ' + str(path))
    return {'sha256': file_hash(path), 'mode': stat.S_IMODE(path.stat().st_mode)}


def plan(root, task_id, spec):
    if not isinstance(spec, dict) or not isinstance(spec.get('operations'), list) or not spec['operations']:
        raise ValueError('Spec needs a nonempty operations array')
    # Planning only writes an isolated receipt and content preimages under .taskdock.
    with lock(root):
        # Explicit, compare-and-swap note updates belong to the same recovery unit.
        # Never exempt control files from conflict checks or infer that a later edit is ours.
        notes = spec.get('notes', {})
        if not isinstance(notes, dict):
            raise ValueError('notes must be an object of existing control-file updates')
        for name, note in notes.items():
            if name not in CONTROL - {'TASK.json'} or not isinstance(note, dict):
                raise ValueError('Notes may update existing Markdown control files only')
            if not isinstance(note.get('text'), str) or not note['text'].strip():
                raise ValueError('Each note needs nonempty complete text')
            if len(note['text'].encode('utf-8')) > LIMIT:
                raise ValueError('Note exceeds the reference size limit: ' + name)
            if not re.fullmatch(r'[a-f0-9]{64}', str(note.get('expected_sha256', ''))):
                raise ValueError('Each note needs expected_sha256 from the content actually read')
            path = safe(root, name)
            if not path.is_file() or path.stat().st_size > LIMIT:
                raise ValueError('Note must be an existing ordinary control file within the size limit: ' + name)
        mapping, merges, reasons = {}, {}, {}
        for op in spec['operations']:
            src, dst = op['from'], op['to']
            a, b = safe(root, src), safe(root, dst)
            if src in CONTROL or dst in CONTROL:
                raise ValueError('Keep task control files at the root')
            if not isinstance(op.get('reason'), str) or not op['reason'].strip():
                raise ValueError('Every operation needs a reason')
            if src == dst or src in mapping or dst in mapping or src in mapping.values() or dst in mapping.values():
                raise ValueError('Overlapping moves are not supported; use separate plans')
            if not a.is_file():
                raise ValueError('Source must be a file: ' + src)
            # Case-only renames can alias the source on case-insensitive filesystems.
            if b.exists() and os.path.samefile(a, b):
                raise ValueError('Source and destination alias the same file')
            if op.get('type') == 'merge':
                if not b.is_file() or file_hash(a) != file_hash(b):
                    raise ValueError('Merge requires identical content at both paths')
                merges[src] = dst
            elif op.get('type') == 'move':
                if b.exists():
                    raise ValueError('Destination already exists: ' + dst)
            else:
                raise ValueError('Operation must be move or merge')
            mapping[src], reasons[src] = dst, op['reason']
        # Source snapshots and final bytes define an auditable, reversible patch.
        before, after, data = {}, {}, {}
        def capture(name):
            if name not in before:
                path = safe(root, name, internal=name == '.taskdock/artifacts.json')
                before[name] = snapshot(path)
                if before[name]:
                    data[before[name]['sha256']] = path.read_bytes()
                after[name] = before[name]
        for src, dst in mapping.items():
            capture(src); capture(dst)
            if src not in merges:
                after[dst] = before[src]
            after[src] = None
        files, excluded = scan(root)
        readonly = spec.get('preserve', ['sources', 'history', '历史'])
        if not isinstance(readonly, list) or not all(isinstance(v, str) and v and '..' not in PurePosixPath(v).parts for v in readonly):
            raise ValueError('preserve must list relative files or directory prefixes')
        def protected(name):
            return any(name == x or name.startswith(x.rstrip('/') + '/') for x in readonly)
        def relocate(name, newname, text, suffix):
            edits = []
            for start, end, url in references(text, suffix):
                old = target(root, name, url)
                if old is None:
                    continue
                dest = mapping.get(old, old)
                # Changes to an unmoved broken reference are not silently "fixed".
                if dest == old and name == newname:
                    continue
                rel = os.path.relpath(root / dest, (root / newname).parent).replace(os.sep, '/')
                tail = url[len(re.split(r'[?#]', url, maxsplit=1)[0]):]
                repl = quote(rel, safe='/.-_~') + tail if ('%' in url or ' ' in rel) else rel + tail
                edits.append((start, end, repl))
            for start, end, repl in sorted(set(edits), reverse=True):
                text = text[:start] + repl + text[end:]
            return text
        unresolved, repaired, notes_updated = [], [], []
        for f in files:
            name = f.relative_to(root).as_posix()
            if f.suffix not in TEXT or name in merges or f.stat().st_size > LIMIT:
                continue
            try:
                original = f.read_bytes(); text = original.decode('utf-8')
            except UnicodeDecodeError:
                raise ValueError('Cannot verify references in non-UTF-8 file: ' + name + '; no work files changed')
            capture(name)  # A new reference added after planning must invalidate this view.
            if name in notes:
                expected = notes[name]['expected_sha256']
                if digest(original) != expected or before[name]['sha256'] != expected:
                    raise ValueError('Note changed since it was read: ' + name + '; no work files changed')
                text = notes[name]['text']
            newname = mapping.get(name, name)
            relocated = relocate(name, newname, text, f.suffix)
            modified = relocated.encode('utf-8')
            if modified == original:
                continue
            if protected(name):
                unresolved.append({'path': name, 'reason': 'Preserved original would need link changes; use a separate reading copy or explicitly narrow preserve.'})
                continue
            capture(name); capture(newname)
            h = digest(modified); data[h] = modified
            after[newname] = {'sha256': h, 'mode': stat.S_IMODE(f.stat().st_mode)}
            if relocated != text:
                repaired.append(newname)
            if name in notes:
                notes_updated.append(name)
        if unresolved:
            raise ValueError('Preserved reference conflict: ' + json.dumps(unresolved))
        ap = artifact_path(root)
        if ap.exists():
            obj = artifacts(root); changed = False
            for a in obj['items'].values():
                if a['path'] in mapping:
                    a['path'] = mapping[a['path']]; changed = True
                # Retain recorded hash: a link edit still deserves evidence review.
            if changed:
                name = '.taskdock/artifacts.json'; capture(name)
                raw = (json.dumps(obj, ensure_ascii=False, indent=2) + '\n').encode()
                h = digest(raw); data[h] = raw; after[name] = {'sha256': h, 'mode': stat.S_IMODE(ap.stat().st_mode)}
        entries = [{'path': n, 'before': before[n], 'after': after[n]} for n in sorted(before) if before[n] != after[n]]
        # Merge survivors are read dependencies, even when they do not need rewriting.
        guards = {n: v for n, v in before.items() if before[n] == after[n]}
        identity = uuid.uuid4().hex
        folder = safe(root, '.taskdock/operations/' + identity, internal=True)
        folder.mkdir(parents=True)
        needed = {e[k]['sha256'] for e in entries for k in ('before', 'after') if e[k]}
        for h in sorted(needed):
            atomic(folder / 'blobs' / h, data[h])
        receipt = {'schema': 'taskdock-operation/v1', 'id': identity, 'task_id': task_id,
                   'operations': spec['operations'], 'entries': entries, 'guards': guards,
                   'link_repaired': sorted(set(repaired)), 'notes_updated': sorted(notes_updated), 'excluded': excluded,
                   'reference_files': [f.relative_to(root).as_posix() for f in files if f.suffix in TEXT],
                   'coverage': 'Common relative Markdown/HTML/CSS references within this task. Review dynamic/absolute/Office/cloud dependencies separately.'}
        save(folder / 'plan.json', receipt)
        save(folder / 'journal.json', {'status': 'planned', 'completed': [], 'created_dirs': []})
    return {'status': 'planned', 'operation_id': identity, 'plan': (folder / 'plan.json').relative_to(root).as_posix(),
            'operations': receipt['operations'], 'changes': entries, 'link_repaired': receipt['link_repaired'],
            'notes_updated': receipt['notes_updated'], 'coverage': receipt['coverage']}


def load_operation(root, task_id, identity):
    if not re.fullmatch(r'[a-f0-9]{32}', identity):
        raise ValueError('Invalid operation ID')
    folder = safe(root, '.taskdock/operations/' + identity, internal=True)
    planfile = safe(root, (folder / 'plan.json').relative_to(root).as_posix(), internal=True)
    journalfile = safe(root, (folder / 'journal.json').relative_to(root).as_posix(), internal=True)
    obj = json.loads(planfile.read_text(encoding='utf-8')); journal = json.loads(journalfile.read_text(encoding='utf-8'))
    if obj.get('schema') != 'taskdock-operation/v1' or obj.get('task_id') != task_id or obj.get('id') != identity:
        raise ValueError('Operation belongs to another task')
    for e in obj['entries']:
        safe(root, e['path'], internal=e['path'] == '.taskdock/artifacts.json')
        for label in ('before', 'after'):
            value = e[label]
            if value:
                h = value['sha256']
                if not re.fullmatch(r'[a-f0-9]{64}', h):
                    raise ValueError('Invalid content hash')
                raw = safe(root, (folder / 'blobs' / h).relative_to(root).as_posix(), internal=True).read_bytes()
                if digest(raw) != h:
                    raise ValueError('Recovery content is corrupt')
    return folder, obj, journal


def transfer(root, task_id, identity, rollback=False):
    with lock(root):
        folder, obj, journal = load_operation(root, task_id, identity)
        if journal['status'] == 'rolled_back' and not rollback:
            raise ValueError('This operation was rolled back; make a new plan')
        desired, previous = ('before', 'after') if rollback else ('after', 'before')
        # Check all destinations before writing any. No partial rollback over new work.
        conflicts = []
        for e in obj['entries']:
            current = snapshot(safe(root, e['path'], internal=e['path'] == '.taskdock/artifacts.json'))
            allowed = [e['before']] if journal['status'] == 'planned' else [e['before'], e['after']]
            if journal['status'] in {'applied', 'rolled_back'}:
                allowed = [e['after'] if journal['status'] == 'applied' else e['before']]
            if current not in allowed:
                conflicts.append(e['path'])
        changed_names = {e['path'] for e in obj['entries']}
        observed_text = {f.relative_to(root).as_posix() for f in scan(root)[0] if f.suffix in TEXT}
        expected_text = set(obj['reference_files'])
        conflicts.extend(sorted((observed_text ^ expected_text) - changed_names))
        for name, value in obj['guards'].items():
            if snapshot(safe(root, name)) != value:
                conflicts.append(name)
        if conflicts:
            return {'status': 'conflict', 'paths': sorted(set(conflicts)), 'message': 'Nothing changed in this attempt. Preserve the new work and review the operation.'}
        finished = 'rolled_back' if rollback else 'applied'
        if journal['status'] == finished:
            return {'status': finished, 'operation_id': identity, 'changed': 0}
        if not rollback and journal['status'] == 'rolling_back':
            raise ValueError('Finish rollback before starting another operation')
        journal['status'] = 'rolling_back' if rollback else 'applying'
        save(folder / 'journal.json', journal)
        changes = 0
        # Materialize all survivors first; only then remove old paths. Preimages remain.
        for e in sorted(obj['entries'], key=lambda x: x[desired] is None):
            path = safe(root, e['path'], internal=e['path'] == '.taskdock/artifacts.json')
            current = snapshot(path)
            if current == e[desired]:
                continue
            if current != e[previous]:
                return {'status': 'conflict', 'paths': [e['path']], 'message': 'Source changed during execution; earlier journaled operations may have completed.'}
            if e[desired] is None:
                path.unlink()
            else:
                missing = []
                parent = path.parent
                while parent != root and not parent.exists():
                    missing.append(parent.relative_to(root).as_posix()); parent = parent.parent
                journal['created_dirs'] = sorted(set(journal['created_dirs'] + missing))
                save(folder / 'journal.json', journal)
                raw = (folder / 'blobs' / e[desired]['sha256']).read_bytes()
                atomic(path, raw, e[desired]['mode'])
            changes += 1
            journal['completed'].append({'path': e['path'], 'direction': desired})
            save(folder / 'journal.json', journal)
        if rollback:
            for name in sorted(journal['created_dirs'], key=lambda x: len(PurePosixPath(x).parts), reverse=True):
                d = safe(root, name, internal=name.startswith('.taskdock/'))
                if d.is_dir() and not any(d.iterdir()):
                    d.rmdir()
        journal['status'] = finished
        save(folder / 'journal.json', journal)
        return {'status': finished, 'operation_id': identity, 'changed': changes,
                'recovery': folder.relative_to(root).as_posix(), 'note': 'Preimages retained locally. This is not an off-device backup.'}
