#!/usr/bin/env python3
"""Save a read-only GitHub discovery observation; unknown values stay unknown."""
import argparse
from datetime import datetime, timezone
import json
from pathlib import Path
import re
import subprocess


def gh_json(endpoint, **params):
    command = ["gh", "api", "--method", "GET", endpoint]
    for key, value in params.items():
        command.extend(["-f", f"{key}={value}"])
    try:
        result = subprocess.run(command, capture_output=True, text=True, timeout=45)
    except (OSError, subprocess.TimeoutExpired) as exc:
        return {"status": "unavailable", "error": type(exc).__name__, "data": None}
    if result.returncode:
        return {"status": "unavailable", "exit_code": result.returncode, "data": None}
    try:
        return {"status": "ok", "data": json.loads(result.stdout)}
    except ValueError:
        return {"status": "unavailable", "error": "invalid_json", "data": None}


def collect(repo, queries, traffic=False, fetch=gh_json):
    record = {"schema_version": 1, "observed_at": datetime.now(timezone.utc).isoformat(),
              "repository": repo, "search": [], "attribution": "unknown",
              "web_indexing": "not_checked", "ai_citations": "not_checked"}
    response = fetch(f"repos/{repo}")
    if response["status"] == "ok":
        data = response["data"]
        record["metadata"] = {"status": "ok", **{key: data.get(key) for key in
            ("html_url", "description", "topics", "stargazers_count", "forks_count", "pushed_at")}}
    else:
        record["metadata"] = response
    for query in queries:
        response = fetch("search/repositories", q=query, per_page=20)
        item = {"query": query, "limit": 20, "order": "github_default_best_match", "rank": None}
        if response["status"] != "ok":
            item["status"] = "unavailable"
        else:
            data = response["data"]
            names = [x["full_name"] for x in data.get("items", [])]
            item["results"] = names
            item["incomplete_results"] = data.get("incomplete_results", False)
            rank = next((i+1 for i,n in enumerate(names) if n.lower() == repo.lower()), None)
            item["rank"] = rank
            item["status"] = "found" if rank else ("incomplete" if item["incomplete_results"] else "not_found_in_top_20")
        record["search"].append(item)
    record["traffic"] = ({kind: fetch(f"repos/{repo}/traffic/{kind}") for kind in ("views", "popular/referrers")}
                          if traffic else {"status": "not_checked"})
    return record


def compare(previous, current):
    if previous.get("repository", "").lower() != current["repository"].lower():
        raise ValueError("previous snapshot belongs to another repository")
    before = {x["query"]: x for x in previous.get("search", [])}
    return {"previous_observed_at": previous.get("observed_at"),
            "causal_effect": "not_established",
            "search": [{"query": x["query"], "before_status": before[x["query"]]["status"],
                        "after_status": x["status"], "before_rank": before[x["query"]].get("rank"),
                        "after_rank": x.get("rank")} for x in current["search"] if x["query"] in before]}


def main():
    p = argparse.ArgumentParser(description=__doc__)
    p.add_argument("repository", help="owner/repo")
    p.add_argument("--query", action="append", default=[], help="Fixed GitHub query; repeat up to three times")
    p.add_argument("--traffic", action="store_true", help="Read private 14-day views/referrers; keep output private")
    p.add_argument("--previous", type=Path)
    p.add_argument("--out", required=True, type=Path, help="New snapshot file; existing files are never overwritten")
    args = p.parse_args()
    if not re.fullmatch(r"[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+", args.repository) or len(args.query) > 3:
        p.error("use owner/repo and at most three fixed queries")
    if args.out.exists():
        p.error("output exists; choose a new snapshot name")
    previous = json.loads(args.previous.read_text()) if args.previous else None
    if previous and previous.get("repository", "").lower() != args.repository.lower():
        p.error("previous snapshot belongs to another repository")
    record = collect(args.repository, args.query, args.traffic)
    if previous:
        record["comparison"] = compare(previous, record)
    args.out.parent.mkdir(parents=True, exist_ok=True)
    with args.out.open("x") as file:
        json.dump(record, file, ensure_ascii=False, indent=2)
        file.write("\n")
    print(args.out)
    unavailable = record["metadata"]["status"] != "ok" or any(x["status"] in ("unavailable", "incomplete") for x in record["search"])
    if args.traffic:
        unavailable |= any(x["status"] != "ok" for x in record["traffic"].values())
    return 2 if unavailable else 0


if __name__ == "__main__":
    raise SystemExit(main())
