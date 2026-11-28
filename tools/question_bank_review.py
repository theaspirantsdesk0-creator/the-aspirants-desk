#!/usr/bin/env python3
"""Apply a two-step review workflow to one practice question record.

This tool never verifies facts itself. A human reviewer must inspect the source
and complete each checklist item before moving a record into review/published.
"""
from __future__ import annotations

import argparse
import json
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urlparse


CHECKS = ("answer", "distractors", "explanation", "metadata", "duplicates")


def load_rows(path: Path) -> list[dict]:
    rows = json.loads(path.read_text(encoding="utf-8"))
    if not isinstance(rows, list):
        raise ValueError("Question file must contain a JSON array.")
    return rows


def save_rows(path: Path, rows: list[dict]) -> None:
    path.write_text(json.dumps(rows, indent=1, ensure_ascii=False) + "\n", encoding="utf-8")


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("file", type=Path, help="JSON file under data/questions")
    parser.add_argument("--id", required=True, help="Question record ID")
    parser.add_argument("--reviewer", required=True, help="Reviewer name or team identifier")
    parser.add_argument("--source-url", required=True, help="HTTPS source actually checked by the reviewer")
    for check in CHECKS:
        parser.add_argument("--check-" + check, action="store_true", help="confirm " + check + " was manually checked")
    parser.add_argument("--publish", action="store_true", help="publish only after a prior review-stage approval")
    args = parser.parse_args()

    parsed = urlparse(args.source_url)
    if parsed.scheme != "https" or not parsed.netloc:
        parser.error("--source-url must be an HTTPS URL")
    if not args.reviewer.strip():
        parser.error("--reviewer cannot be empty")
    missing = [name for name in CHECKS if not getattr(args, "check_" + name)]
    if missing:
        parser.error("complete all manual checks: " + ", ".join(missing))

    rows = load_rows(args.file)
    matches = [row for row in rows if isinstance(row, dict) and row.get("id") == args.id]
    if len(matches) != 1:
        raise SystemExit(f"Expected exactly one record with ID {args.id!r}; found {len(matches)}.")
    row = matches[0]
    if args.publish and row.get("status") != "review":
        raise SystemExit("Publishing requires status='review'. First complete the review stage.")
    if not args.publish and row.get("status") not in {"draft", "review"}:
        raise SystemExit("Only draft/review records can enter or repeat the review stage.")

    now = datetime.now(timezone.utc).isoformat(timespec="seconds")
    row["source_url"] = args.source_url
    row["review"] = {
        "reviewed_by": args.reviewer.strip(),
        "reviewed_at": now,
        "checks": {name: True for name in CHECKS},
    }
    row["status"] = "published" if args.publish else "review"
    save_rows(args.file, rows)
    print(f"{args.id}: status set to {row['status']} (source and five manual checks recorded).")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
