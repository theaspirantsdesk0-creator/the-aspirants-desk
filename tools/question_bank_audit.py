#!/usr/bin/env python3
"""Read-only structural and editorial-readiness audit for practice-question JSON."""
from __future__ import annotations

import argparse
import json
import re
from collections import Counter
from pathlib import Path
from urllib.parse import urlparse


def _normalise(value: object) -> str:
    return re.sub(r"\\s+", " ", str(value or "").strip().casefold())


def audit_question_bank(directory: Path) -> dict:
    files = sorted(directory.glob("*.json"))
    errors: list[str] = []
    warnings: list[str] = []
    review_queue: list[dict] = []
    ids: dict[str, str] = {}
    questions: dict[str, str] = {}
    subjects: Counter[str] = Counter()
    difficulties: Counter[str] = Counter()
    statuses: Counter[str] = Counter()
    per_file: list[dict] = []
    total = published = publication_ready = 0

    for path in files:
        try:
            rows = json.loads(path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError) as exc:
            errors.append(f"{path.name}: cannot parse JSON ({exc})")
            continue
        if not isinstance(rows, list):
            errors.append(f"{path.name}: expected a JSON array")
            continue
        count_before = total
        for number, row in enumerate(rows, 1):
            label = f"{path.name} record {number}"
            if not isinstance(row, dict):
                errors.append(f"{label}: expected an object")
                continue
            total += 1
            required = ("id", "subject", "q", "a", "e", "status")
            missing = [key for key in required if not row.get(key)]
            if missing:
                errors.append(f"{label}: missing required fields {', '.join(missing)}")
            choices = row.get("w")
            if not isinstance(choices, list) or len(choices) != 3 or any(not str(x).strip() for x in choices):
                errors.append(f"{label}: expected exactly three non-empty wrong options in 'w'")
                choices = choices if isinstance(choices, list) else []
            elif row.get("a") and len({_normalise(row.get("a")), *(_normalise(x) for x in choices)}) != 4:
                warnings.append(f"{label}: correct answer and wrong options contain duplicates")
            identifier = str(row.get("id", "")).strip()
            if identifier:
                if identifier in ids:
                    errors.append(f"{label}: duplicate ID also found in {ids[identifier]}")
                else:
                    ids[identifier] = f"{path.name}#{number}"
            question_key = _normalise(row.get("subject")) + "|" + _normalise(row.get("q"))
            if row.get("q") and question_key in questions:
                warnings.append(f"{label}: possible duplicate question also found in {questions[question_key]}")
            elif row.get("q"):
                questions[question_key] = f"{path.name}#{number}"

            subject = str(row.get("subject") or "unspecified").strip()
            subjects[subject] += 1
            difficulty = str(row.get("difficulty") or "missing").strip().lower()
            difficulties[difficulty] += 1
            if difficulty not in {"easy", "medium", "hard"}:
                warnings.append(f"{label}: missing or non-standard difficulty '{difficulty}'")
            status = str(row.get("status") or "missing").strip().lower()
            statuses[status] += 1
            if status not in {"draft", "review", "published", "archived"}:
                errors.append(f"{label}: unsupported publication status '{status}'")

            review_note = str(row.get("review_note") or "")
            source_url = str(row.get("source_url") or "").strip()
            parsed = urlparse(source_url)
            valid_source = parsed.scheme == "https" and bool(parsed.netloc)
            review = row.get("review") if isinstance(row.get("review"), dict) else {}
            checks = review.get("checks") if isinstance(review.get("checks"), dict) else {}
            required_checks = ("answer", "distractors", "explanation", "metadata", "duplicates")
            checks_complete = all(checks.get(key) is True for key in required_checks)
            if status == "published":
                published += 1
                problems = []
                if not valid_source:
                    problems.append("missing traceable HTTPS source_url")
                if not checks_complete:
                    problems.append("review checklist incomplete")
                if re.search(r"draft only|verify the answer|not verified|review before", review_note, re.I):
                    problems.append("review_note still indicates draft/unverified")
                if not review.get("reviewed_by") or not review.get("reviewed_at"):
                    problems.append("missing reviewer identity or timestamp")
                if problems:
                    warnings.append(f"{label}: published record is not publication-ready: " + "; ".join(problems))
                    review_queue.append({
                        "file": path.name, "record": number, "id": identifier,
                        "subject": subject, "question": str(row.get("q") or "")[:180],
                        "status": status, "issues": problems,
                    })
                else:
                    publication_ready += 1
            elif status in {"draft", "review"}:
                issues = []
                if not valid_source:
                    issues.append("add traceable HTTPS source_url")
                if not checks_complete:
                    issues.append("complete five review checks")
                if not review.get("reviewed_by"):
                    issues.append("record reviewer")
                review_queue.append({
                    "file": path.name, "record": number, "id": identifier,
                    "subject": subject, "question": str(row.get("q") or "")[:180],
                    "status": status, "issues": issues or ["awaiting final publication approval"],
                })
        per_file.append({"file": path.name, "records": total - count_before})

    return {
        "files_scanned": len(files),
        "total_records": total,
        "unique_ids": len(ids),
        "published_records": published,
        "publication_ready_records": publication_ready,
        "records_requiring_review": len(review_queue),
        "by_file": per_file,
        "subject_distribution": dict(sorted(subjects.items())),
        "difficulty_distribution": dict(sorted(difficulties.items())),
        "status_distribution": dict(sorted(statuses.items())),
        "errors": errors,
        "warnings": warnings,
        "review_queue": review_queue,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    parser.add_argument("--output", type=Path, help="write the JSON report to this path")
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "questions")
    parser.add_argument("--strict-publication", action="store_true", help="return failure when published records are not publication-ready")
    args = parser.parse_args()
    report = audit_question_bank(args.directory)
    rendered = json.dumps(report, indent=2, ensure_ascii=False) + "\n"
    if args.output:
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(rendered, encoding="utf-8")
    if args.json:
        print(rendered, end="")
    else:
        print(f"Question files scanned: {report['files_scanned']}")
        print(f"Question records: {report['total_records']} (unique IDs: {report['unique_ids']})")
        print(f"Published: {report['published_records']} · publication-ready: {report['publication_ready_records']}")
        print(f"Records requiring review: {report['records_requiring_review']}")
        for label, key in (("By file", "by_file"), ("By subject", "subject_distribution"),
                           ("By difficulty", "difficulty_distribution"), ("By status", "status_distribution")):
            print(f"\\n{label}:")
            values = report[key]
            for name, count in (values.items() if isinstance(values, dict) else
                                ((item["file"], item["records"]) for item in values)):
                print(f"  {name}: {count}")
        print(f"\\nStructural errors: {len(report['errors'])}; editorial warnings: {len(report['warnings'])}")
        for issue in report["errors"][:30]:
            print("ERROR:", issue)
        for issue in report["warnings"][:30]:
            print("WARNING:", issue)
    return 1 if report["errors"] or (args.strict_publication and report["records_requiring_review"]) else 0


if __name__ == "__main__":
    raise SystemExit(main())
