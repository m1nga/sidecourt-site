#!/usr/bin/env python3
"""Read-only structural gate; never grants business authority or sends anything."""
import argparse
import hashlib
import json
from pathlib import Path
from datetime import datetime, timezone


def validate(packet, registry, observation, base, now=None):
    errors = []
    now = now or datetime.now(timezone.utc)
    s = packet.get('source', {})
    raw = s.get('text', '')
    expected = hashlib.sha256(raw.encode()).hexdigest() if isinstance(raw, str) else None
    if s.get('kind') != 'direct_human_instruction' or not raw or not s.get('provenance'):
        errors.append('missing_direct_human_provenance')
    if s.get('sha256') != expected:
        errors.append('source_hash_mismatch')
    for key in ('case_id', 'actions', 'acceptance', 'result_location'):
        if not packet.get(key): errors.append('missing_' + key)
    if not packet.get('intent', {}).get('outcome') or not packet.get('intent', {}).get('audience'):
        errors.append('missing_intent')
    a = packet.get('authority', {})
    if a.get('kind') != 'direct_human_instruction' or a.get('source_hash') != expected or a.get('dispatch_authorized') is not True:
        errors.append('authority_not_grounded')
    scopes = packet.get('scope', [])
    if not scopes or not set(scopes).issubset(set(a.get('allowed_scopes', []))):
        errors.append('scope_expansion')
    owner = packet.get('owner', {})
    if not owner.get('thread_id') or registry.get(owner.get('role')) != owner.get('thread_id'):
        errors.append('wrong_original_owner')
    if not packet.get('rules'): errors.append('missing_rules')
    for rule in packet.get('rules', []):
        if rule.get('source_kind') not in ('direct_human_instruction', 'current_project_rule') or not all(rule.get(k) for k in ('id','text','reason')):
            errors.append('rule_not_authoritative')
    for ref in packet.get('references', []):
        if ref.get('classification') not in ('reference','verified_fact','candidate_lesson') or not ref.get('purpose'):
            errors.append('reference_misclassified')
        try:
            name = ref['path']
            path = Path(name) if Path(name).is_absolute() else Path(base) / name
            if hashlib.sha256(path.read_bytes()).hexdigest() != ref.get('sha256'):
                errors.append('reference_hash_mismatch')
        except (KeyError, OSError, TypeError): errors.append('reference_missing')
    if observation.get('thread_id') != owner.get('thread_id') or observation.get('status') != 'idle' or observation.get('turn_status') != 'completed' or observation.get('error'):
        errors.append('owner_not_terminal')
    try:
        age = (now - datetime.fromisoformat(observation['observed_at'].replace('Z','+00:00'))).total_seconds()
        if not 0 <= age <= 60: errors.append('stale_observation')
    except (KeyError, ValueError, TypeError): errors.append('stale_observation')
    d = packet.get('dispatch', {})
    if d.get('state') != 'pending' or d.get('attempts') != 0:
        errors.append('prior_intent_no_resend')
    return {'dispatch_ready': not errors, 'errors': sorted(set(errors)), 'business_authorized': False, 'side_effects': 0}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument('packet', type=Path);p.add_argument('--registry', required=True, type=Path);p.add_argument('--observation', required=True, type=Path)
    a = p.parse_args()
    try:
        result = validate(json.loads(a.packet.read_text()),json.loads(a.registry.read_text()),json.loads(a.observation.read_text()),a.packet.parent)
    except (OSError,ValueError,TypeError,AttributeError) as exc:
        result={'dispatch_ready':False,'errors':['invalid_input:'+type(exc).__name__],'business_authorized':False,'side_effects':0}
    print(json.dumps(result,ensure_ascii=False));return 0 if result['dispatch_ready'] else 2

if __name__ == '__main__': raise SystemExit(main())
