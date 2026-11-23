#!/usr/bin/env python3
"""Read-only audit of the site's practice-question JSON files."""
from __future__ import annotations

import argparse
import json
from collections import Counter
from pathlib import Path


def audit_question_bank(directory: Path) -> dict:
    files = sorted(directory.glob("*.json"))
    errors: list[str] = []
    warnings: list[str] = []
    ids: dict[str, str] = {}
    subjects: Counter[str] = Counter()
    difficulties: Counter[str] = Counter()
    statuses: Counter[str] = Counter()
    per_file: list[dict] = []
    total = 0

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
            if not isinstance(choices, list) or len(choices) != 3:
                errors.append(f"{label}: expected exactly three wrong options in 'w'")
            elif row.get("a") and len({str(row.get("a")).strip().casefold(), *(str(x).strip().casefold() for x in choices)}) != 4:
                warnings.append(f"{label}: correct answer and wrong options contain duplicates")
            identifier = str(row.get("id", "")).strip()
            if identifier:
                if identifier in ids:
                    errors.append(f"{label}: duplicate ID also found in {ids[identifier]}")
                else:
                    ids[identifier] = path.name
            subjects[str(row.get("subject") or "unspecified")] += 1
            difficulty = str(row.get("difficulty") or "missing").strip().lower()
            difficulties[difficulty] += 1
            if difficulty not in {"easy", "medium", "hard"}:
                warnings.append(f"{label}: missing or non-standard difficulty '{difficulty}'")
            statuses[str(row.get("status") or "missing")] += 1
        per_file.append({"file": path.name, "records": total - count_before})

    return {
        "files_scanned": len(files),
        "total_records": total,
        "unique_ids": len(ids),
        "by_file": per_file,
        "subject_distribution": dict(sorted(subjects.items())),
        "difficulty_distribution": dict(sorted(difficulties.items())),
        "status_distribution": dict(sorted(statuses.items())),
        "errors": errors,
        "warnings": warnings,
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--json", action="store_true", help="emit machine-readable JSON")
    parser.add_argument("--directory", type=Path, default=Path(__file__).resolve().parents[1] / "data" / "questions")
    args = parser.parse_args()
    report = audit_question_bank(args.directory)
    if args.json:
        print(json.dumps(report, indent=2, ensure_ascii=False))
    else:
        print(f"Question files scanned: {report['files_scanned']}")
        print(f"Question records: {report['total_records']} (unique IDs: {report['unique_ids']})")
        for label, key in (("By file", "by_file"), ("By subject", "subject_distribution"),
                           ("By difficulty", "difficulty_distribution"), ("By status", "status_distribution")):
            print(f"\\n{label}:")
            values = report[key]
            for name, count in (values.items() if isinstance(values, dict) else
                                ((item["file"], item["records"]) for item in values)):
                print(f"  {name}: {count}")
        print(f"\\nStructural errors: {len(report['errors'])}; review warnings: {len(report['warnings'])}")
        for issue in report["errors"][:30]:
            print("ERROR:", issue)
        for issue in report["warnings"][:30]:
            print("WARNING:", issue)
    return 1 if report["errors"] else 0


if __name__ == "__main__":
    raise SystemExit(main())
