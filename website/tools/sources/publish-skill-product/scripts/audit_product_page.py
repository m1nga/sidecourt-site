#!/usr/bin/env python3
"""Audit one source skill and its product metadata without changing files."""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path


SECTION_GROUPS = {
    "problem": ("What it does", "The problem it actually solves"),
    "trigger": ("When it fires", "Who it's for"),
    "install": ("Install",),
    "story": ("Design notes", "Why it exists", "Why"),
    "evidence": ("Field-tested", "Validation", "Evidence"),
}


def section_names(text: str) -> set[str]:
    return set(re.findall(r"^##\s+(.+?)\s*$", text, flags=re.MULTILINE))


def frontmatter_name(text: str) -> str | None:
    match = re.search(r"^name:\s*([^\n]+)$", text, flags=re.MULTILINE)
    return match.group(1).strip().strip('"\'') if match else None


def yaml_interface_field(text: str, field: str) -> str | None:
    match = re.search(rf"^\s{{2}}{re.escape(field)}:\s*(.+?)\s*$", text, flags=re.MULTILINE)
    return match.group(1).strip().strip('"\'') if match else None


def readme_h1(text: str) -> str | None:
    match = re.search(r"^#\s+(.+?)\s*$", text, flags=re.MULTILINE)
    return match.group(1) if match else None


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("skill_dir", type=Path)
    parser.add_argument("--product-manifest", type=Path)
    parser.add_argument("--json", action="store_true", dest="json_output")
    args = parser.parse_args()

    skill_dir = args.skill_dir.resolve()
    name = skill_dir.name
    manifest_path = args.product_manifest or skill_dir.parent / "products.json"
    errors: list[str] = []
    warnings: list[str] = []

    required = [skill_dir / "SKILL.md", skill_dir / "README.md", skill_dir / "agents/openai.yaml"]
    for path in required:
        if not path.is_file():
            errors.append(f"missing required file: {path.relative_to(skill_dir)}")

    skill_text = (skill_dir / "SKILL.md").read_text(encoding="utf-8") if required[0].is_file() else ""
    readme = (skill_dir / "README.md").read_text(encoding="utf-8") if required[1].is_file() else ""
    openai_yaml = required[2].read_text(encoding="utf-8") if required[2].is_file() else ""

    if frontmatter_name(skill_text) != name:
        errors.append(f"SKILL.md name must equal directory name: {name}")
    if re.search(r"\[(?:TODO|TBD)(?::|\])", skill_text + "\n" + readme, re.IGNORECASE):
        errors.append("unresolved TODO placeholder")

    try:
        manifest = json.loads(manifest_path.read_text(encoding="utf-8"))
    except (OSError, json.JSONDecodeError) as exc:
        errors.append(f"cannot read product manifest: {exc}")
        manifest = {"products": []}

    matches = [item for item in manifest.get("products", []) if item.get("name") == name]
    if len(matches) != 1:
        errors.append(f"expected exactly one product manifest entry, found {len(matches)}")
        product: dict = {}
    else:
        product = matches[0]

    title = product.get("title", "")
    description = product.get("description", "")
    topics = product.get("topics", [])
    if not title or title.lower() == name.lower():
        errors.append("product title must be human-readable and problem-led")
    if not 50 <= len(description) <= 200:
        errors.append(f"product description must be 50-200 characters (found {len(description)})")
    if not isinstance(topics, list) or not 3 <= len(topics) <= 20:
        errors.append("product must have 3-20 focused topics")
    if title and readme_h1(readme) != title:
        errors.append("README H1 must exactly match the product manifest title")

    display_name = yaml_interface_field(openai_yaml, "display_name")
    short_description = yaml_interface_field(openai_yaml, "short_description")
    if not display_name:
        errors.append("agents/openai.yaml must define interface.display_name")
    elif not 2 <= len(re.findall(r"[\w&]+", display_name)) <= 5:
        errors.append("display_name must use 2-5 plain-language words")
    if not short_description:
        errors.append("agents/openai.yaml must define interface.short_description")
    elif not 25 <= len(short_description) <= 64:
        errors.append(
            f"short_description must be 25-64 characters (found {len(short_description)})"
        )

    sections = section_names(readme)
    for label, alternatives in SECTION_GROUPS.items():
        if not any(section in sections for section in alternatives):
            errors.append(f"missing {label} section; expected one of: {', '.join(alternatives)}")

    if not re.search(r"npx\s+skills\s+add\s+[^\s`]+", readme):
        errors.append("README has no direct skills CLI install command")
    # Page length and language are editorial choices, not evidence of discoverability.

    result = {
        "skill": name,
        "verdict": "PASS" if not errors else "FAIL",
        "errors": errors,
        "warnings": warnings,
    }
    if args.json_output:
        print(json.dumps(result, ensure_ascii=False, indent=2))
    else:
        print(f"VERDICT: {result['verdict']}")
        for item in errors:
            print(f"ERROR: {item}")
        for item in warnings:
            print(f"WARNING: {item}")
    return 1 if errors else 0


if __name__ == "__main__":
    raise SystemExit(main())
