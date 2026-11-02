#!/usr/bin/env python3
"""Run a reversible sample without touching an existing workspace."""
import argparse
import json
from pathlib import Path
import sys
import taskdock as td
import workspace_ops as ops


def run(output, domain='design'):
    output = Path(output).expanduser().absolute()
    if output.exists() or output.is_symlink():
        raise ValueError('Choose a new output folder; existing files are never replaced')
    task = td.init_task(domain.title() + ' handoff', 'Keep current work findable without losing its history', output.parent/(output.name + '-index.json'), output, language='en')
    names = {'design': ('cover.svg', 'assets/cover.svg', '<svg xmlns="http://www.w3.org/2000/svg" width="240" height="120"><rect width="240" height="120" fill="#275C48"/></svg>'),
             'release': ('release-notes.txt', 'delivery/release-notes.txt', 'Release 1.0: a sample delivery, with separate runtime copy.'),
             'research': ('finding.txt', 'research/finding.txt', 'Sample finding: source evidence and editorial conclusions have separate roles.')}
    old, current, content = names[domain]
    (output / old).write_text(content)
    (output / 'download-copy.txt').write_text(content)
    (output / 'runtime-copy.txt').write_text(content)
    (output / 'history').mkdir()
    (output / 'history/rejected.txt').write_text('Previous direction was rejected. Preserve its reason, not its status as current.')
    (output / 'README.md').write_text('# '+domain.title()+' handoff\n\n[Current result]('+old+')\n\n[State](STATE.md)\n')
    (output / 'STATE.md').write_text('# Current state\n\nThe result linked from README is approved for this sample. Runtime use is recorded separately.\n\nNext: open the current result and continue the handoff.\n')
    before = {str(p.relative_to(output)): p.read_bytes() for p in output.rglob('*') if p.is_file()}
    ops.record(output, task['id'], {'items': [
        {'id':'current-result','path':old,'role':'working','decision':'approved','used_in':['sample-v1'],'evidence':'Explicit sample decision; no production release claimed'},
        {'id':'runtime','path':'runtime-copy.txt','role':'runtime','decision':'approved','used_in':['sample-v1'],'evidence':'Necessary runtime copy, not a redundant download'},
        {'id':'old-direction','path':'history/rejected.txt','role':'history','decision':'rejected','used_in':[],'evidence':'Reason retained in this original history file'}]})
    spec = {'operations': [
        {'type':'move','from':old,'to':current,'reason':'Keep the approved result under its working category'},
        {'type':'merge','from':'download-copy.txt','to':'runtime-copy.txt','reason':'Identical downloaded copy has no separate purpose; runtime remains'}]}
    planned = ops.plan(output,task['id'],spec)
    identity = planned['operation_id']
    applied = ops.transfer(output,task['id'],identity)
    assert applied['status'] == 'applied'
    assert current in (output/'README.md').read_text()
    assert (output/'runtime-copy.txt').read_text() == content
    assert td.check(output)['status'] == 'pass'
    rolled = ops.transfer(output,task['id'],identity,True)
    assert rolled['status'] == 'rolled_back'
    restored = {str(p.relative_to(output)):p.read_bytes() for p in output.rglob('*') if p.is_file() and '.taskdock' not in p.parts}
    assert restored == before
    # Leave a useful organized result after proving rollback, with a fresh operation.
    final = ops.plan(output,task['id'],spec)
    assert ops.transfer(output,task['id'],final['operation_id'])['status'] == 'applied'
    assert ops.reconcile(output)['status'] == 'pass'
    receipt = {'status':'pass','domain':domain,'sample_data':True,'task_id':task['id'],
               'before':['README → '+old, old, 'download-copy.txt', 'runtime-copy.txt', 'history/rejected.txt'],
               'after':['README → '+current,current,'runtime-copy.txt','history/rejected.txt'],
               'verified':['Relative entry repaired','Necessary runtime copy retained','Rejected history preserved','Original visible file bytes restored by rollback','Final artifact paths reconciled'],
               'final_operation':final['operation_id'],'workspace':str(output)}
    print(json.dumps(receipt,ensure_ascii=False,indent=2))
    return receipt


if __name__=='__main__':
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument('--output',type=Path,required=True)
    p.add_argument('--domain',choices=('design','release','research'),default='design')
    a=p.parse_args()
    try:
        run(a.output,a.domain)
    except (OSError,ValueError,AssertionError) as e:
        print(json.dumps({'status':'error','message':str(e)}),file=sys.stderr);sys.exit(1)
