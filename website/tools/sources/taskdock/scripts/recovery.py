"""Recovery reporting for the existing organizer; no automatic rollback or repair.

Keep actionable recovery data after a plan exists, including when a write happened
before its journal entry. Render commands for an explicitly named shell only.
"""
import json
import os
from pathlib import Path
import re
import shlex
import sys

import workspace_ops as ops


def shell_command(argv, shell=None):
    shell = shell or ('powershell' if os.name == 'nt' else 'posix')
    if shell == 'posix':
        return shlex.join(argv)
    if shell == 'powershell':
        # PowerShell treats curly single quotation marks as quote delimiters too.
        def quote(value):
            for char in ("'", '\u2018', '\u2019', '\u201a', '\u201b'):
                value = value.replace(char, char * 2)
            return "'" + value + "'"
        return '& ' + ' '.join(quote(arg) for arg in argv)
    raise ValueError('Supported display shells: posix or powershell; use argv with shell=False')


def recovery_info(root, identity, script):
    root = Path(root).resolve()
    script = Path(script).resolve()
    argv = [sys.executable, str(script), 'rollback', '--path', str(root), '--operation', identity]
    shell = 'powershell' if os.name == 'nt' else 'posix'
    return {'operation_id': identity, 'recovery': '.taskdock/operations/' + identity,
            'rollback_argv': argv, 'rollback_shell': shell,
            'rollback': shell_command(argv, shell),
            'recovery_note': 'Undo this operation only. For multiple operations, undo in reverse order. '
                             'Rollback refuses conflicting newer work; it is not an off-device backup.'}



def selected_recovery(root, task_id, identity, script):
    """Rebind a receipt to an explicitly selected moved/copied task, with no writes.

    A printed command targets one task location; never silently substitute a copy.
    Validate identity and recovery bytes before emitting arguments for the new path.
    Actual rollback still rechecks current files and refuses newer conflicting work.
    """
    _, _, journal = ops.load_operation(root, task_id, identity)
    return {**recovery_info(root, identity, script), 'status': 'recovery_ready',
            'task_id': task_id, 'journal_status': journal['status'],
            'note': 'Read-only command generation for this selected path, not a completed rollback or conflict clearance.'}


def operation_state(root, task_id, identity):
    """Read the journal, never infer zero writes from an empty completed list."""
    try:
        _, _, journal = ops.load_operation(root, task_id, identity)
        status = journal['status']
        state = {'planned': 'not_started', 'applied': 'applied', 'rolled_back': 'rolled_back'}.get(
            status, 'partial_or_unverified')
        return {'journal_status': status, 'mutation_state': state}
    except Exception as error:
        # Even damaged/unreadable metadata must not erase the already known ID.
        return {'journal_status': 'unavailable', 'mutation_state': 'unknown',
                'inspection_error': type(error).__name__ + ': ' + str(error)}


def pending_operations(root, task_id, script, limit=100):
    """Bounded, read-only recovery discovery for a new session or a moved task."""
    items, warnings = [], []
    try:
        base = ops.safe(root, '.taskdock/operations', internal=True)
        if not base.exists():
            return {'operations': [], 'warnings': [], 'complete': True}
        with os.scandir(base) as entries:
            for count, entry in enumerate(entries):
                if count >= limit:
                    warnings.append('Recovery scan limit reached; inspect remaining operation folders explicitly.')
                    break
                identity = entry.name
                if not re.fullmatch(r'[a-f0-9]{32}', identity) or entry.is_symlink():
                    warnings.append('Ignored unexpected recovery entry: ' + identity)
                    continue
                # Skip completed records from metadata alone: resuming must not
                # re-read every historical preimage. Actual apply/rollback validates bytes.
                try:
                    prefix = '.taskdock/operations/' + identity + '/'
                    journal = json.loads(ops.safe(root, prefix + 'journal.json', internal=True).read_text(encoding='utf-8'))
                    plan = json.loads(ops.safe(root, prefix + 'plan.json', internal=True).read_text(encoding='utf-8'))
                    if (plan.get('schema') == 'taskdock-operation/v1' and plan.get('id') == identity
                            and plan.get('task_id') == task_id and journal.get('status') in ('applied', 'rolled_back')):
                        continue
                except (OSError, ValueError, AttributeError):
                    pass
                state = operation_state(root, task_id, identity)
                if state['journal_status'] not in ('applied', 'rolled_back'):
                    items.append({**recovery_info(root, identity, script), **state})
    except (OSError, ValueError) as error:
        warnings.append(str(error))
    return {'operations': items, 'warnings': warnings, 'complete': not warnings}


def organize_task(root, task_id, spec, checker, script):
    """Wrap the existing transaction, retaining its recovery contract on failure."""
    root = Path(root).resolve()
    planned = ops.plan(root, task_id, spec)  # No work-file mutation before this returns.
    identity = planned['operation_id']
    recovery = recovery_info(root, identity, script)
    stage = 'save_recovery'
    applied = None
    try:
        # Persist before apply, so a killed process leaves an inspectable entry.
        path = ops.safe(root, recovery['recovery'] + '/recovery.json', internal=True)
        ops.save(path, recovery)
        stage = 'apply'
        applied = ops.transfer(root, task_id, identity)
        if applied['status'] != 'applied':
            state = operation_state(root, task_id, identity)
            note = ('Stopped before TaskDock changed work files.' if state['mutation_state'] == 'not_started'
                    else 'Changes may already exist. Inspect the saved operation and preserve newer work.')
            return {**recovery, **state, 'status': applied['status'], 'stage': stage,
                    'detail': applied, 'note': note, 'report': [note, 'Recovery: ' + recovery['rollback']]}
        stage = 'check'
        structure = checker(root)
    except (Exception, KeyboardInterrupt) as error:
        state = operation_state(root, task_id, identity)
        # A confirmed applied result is stronger than a later failed journal read.
        if applied and applied.get('status') == 'applied':
            state['mutation_state'] = 'applied'
        note = ('The apply completed, but verification did not complete.' if stage == 'check'
                else 'Organization stopped; inspect the saved operation before retrying.')
        return {**recovery, **state, 'status': 'organized_check_failed' if stage == 'check' else 'organize_error',
                'stage': stage, 'error': type(error).__name__ + ': ' + str(error), 'note': note,
                'report': [note, 'No automatic rollback was attempted.', 'Recovery: ' + recovery['rollback']]}
    moved = [op for op in spec['operations'] if op.get('type') == 'move']
    merged = [op for op in spec['operations'] if op.get('type') == 'merge']
    report = ['Moved: %s \u2192 %s (%s)' % (op['from'], op['to'], op['reason']) for op in moved]
    report += ['Merged into %s (identical copy %s removed; its bytes are kept for rollback)' %
               (op['to'], op['from']) for op in merged]
    report.append('Links repaired: ' + (', '.join(planned['link_repaired']) or 'none needed'))
    report.append('Task notes in this operation: ' + (', '.join(planned.get('notes_updated', [])) or 'none'))
    report.append('Structure check: ' + structure['status'])
    report.append('Undo everything in this operation: ' + recovery['rollback'])
    return {**recovery, 'status': 'organized' if structure['status'] == 'pass' else 'organized_check_failed',
            'stage': 'complete' if structure['status'] == 'pass' else 'check', 'mutation_state': 'applied',
            'moved': moved, 'merged': merged, 'link_repaired': planned['link_repaired'],
            'notes_updated': planned.get('notes_updated', []),
            'check': structure, 'coverage': planned['coverage'], 'report': report}
