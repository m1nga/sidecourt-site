#!/usr/bin/env python3
"""Check the committed release boundary without network calls or mutations."""
import argparse
import json
import re
import subprocess
from pathlib import Path


def check(root: Path, skill: str) -> list[str]:
    if not re.fullmatch(r"[a-z0-9]+(?:-[a-z0-9]+)*", skill):
        return ["invalid skill identifier"]

    def git(*args):
        return subprocess.run(["git", "-C", str(root), *args], capture_output=True, text=True)

    manifest = git("show", "HEAD:products.json")
    if manifest.returncode:
        return ["no committed product manifest"]
    try:
        products = json.loads(manifest.stdout)["products"]
    except (ValueError, KeyError, TypeError):
        return ["invalid committed product manifest"]
    if sum(p.get("name") == skill for p in products) != 1:
        return ["skill must have exactly one committed product entry"]
    errors = []
    for path in (f"{skill}/SKILL.md", f"{skill}/README.md", f"{skill}/agents/openai.yaml", "LICENSE"):
        if git("cat-file", "-e", f"HEAD:{path}").returncode:
            errors.append(f"missing committed file: {path}")
    paths = [skill, "products.json", "LICENSE", "scripts/publish-skill",
             "scripts/verify-products", "scripts/verify-published-skill", "scripts/monitor-products",
             "publish-skill-product/scripts", "ops/skill-quality/baseline.json",
             f"ops/skill-quality/reviews/{skill}.json"]
    status = git("status", "--porcelain", "--untracked-files=all", "--", *paths)
    if status.returncode:
        errors.append("cannot inspect release source status")
    elif status.stdout.strip():
        errors.append("uncommitted release inputs:\n" + status.stdout.rstrip())
    review = subprocess.run(["python3", str(root / "publish-skill-product/scripts/review_gate.py"), str(root), skill, "--committed"], capture_output=True, text=True)
    if review.returncode:
        errors.append("quality review gate failed:\n" + review.stdout.strip())
    return errors


def main():
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("registry", type=Path)
    parser.add_argument("skill")
    args = parser.parse_args()
    errors = check(args.registry.resolve(), args.skill)
    print("\n".join(errors) if errors else f"Committed source is clean: {args.skill}")
    return bool(errors)


if __name__ == "__main__":
    raise SystemExit(main())
